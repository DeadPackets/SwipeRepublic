import { DurableObject } from "cloudflare:workers";
import { z } from "zod";
import {
  freshGame,
  WORLD_IDENTITY_VERSION,
  publicGame,
  play,
  abandon,
  nextDraft,
  type Game,
  type World,
  type Card,
  type Draft,
} from "../src/game";
import { generateWorld, enrichWorld, generateCards, scoreCards } from "./ai";
import { ART_RESERVATION, artTasks, generateArt } from "./art";
import {
  candidates,
  cloneCampaign,
  getCampaign,
  matchCampaigns,
  MATCH_RESERVATION,
  publishCampaign,
  type Template,
} from "./campaigns";

type Bindings = {
  CAMPAIGNS: D1Database;
  ART: R2Bucket;
  SOCIETIES: DurableObjectNamespace<SocietyV3>;
  BUDGET: DurableObjectNamespace<Budget>;
  REQUEST_LIMIT: RateLimit;
  OPENROUTER_API_KEY: string;
  DAILY_AI_BUDGET: string;
  GAME_AI_BUDGET: string;
};
type Lease = {
  token: string;
  until: number;
  kind: "world" | "identity" | "cards" | "callback" | "art";
  reign: number;
  commitmentId?: string;
  draft?: Draft;
  reserved?: number;
};
type Save = {
  id: string;
  owner: string;
  prompt: string;
  game: Game | null;
  lease: Lease | null;
  error: string | null;
  requests: string[];
  spent: number;
  attempts: number;
  settled?: string[];
  reservations?: Record<string, number>;
  queued?: boolean;
  foundation?: { templateId: string; complete: boolean };
};
const uuid = z.string().uuid();
const mutationSchema = z.object({
  requestId: uuid,
  version: z.number().int().nonnegative(),
});
const choiceSchema = mutationSchema.extend({
  cardId: uuid,
  side: z.union([z.literal(0), z.literal(1)]),
});

export class SocietyV3 extends DurableObject<Bindings> {
  private save: Save | null = null;
  constructor(ctx: DurableObjectState, env: Bindings) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.save = (await ctx.storage.get<Save>("save")) ?? null;
    });
  }
  private own(owner: string) {
    if (!this.save || this.save.owner !== owner)
      throw new Error("Society not found");
    return this.save;
  }
  private async persist() {
    await this.ctx.storage.put("save", this.save);
  }
  async initialize(
    owner: string,
    id: string,
    prompt: string,
    template?: Template,
  ) {
    if (this.save) {
      const existing = this.own(owner);
      if (!existing.game && !existing.foundation) {
        existing.foundation = {
          templateId: crypto.randomUUID(),
          complete: false,
        };
        existing.error = null;
        await this.persist();
        await this.ctx.storage.setAlarm(Date.now() + 100);
      }
      return;
    }
    this.save = {
      id,
      owner,
      prompt,
      game: template ? cloneCampaign(id, prompt, template) : null,
      lease: null,
      error: null,
      requests: [],
      spent: 0,
      attempts: 0,
      ...(!template
        ? {
            foundation: {
              templateId: crypto.randomUUID(),
              complete: false,
            },
          }
        : {}),
    };
    await this.persist();
    if (!template) await this.ctx.storage.setAlarm(Date.now() + 100);
  }
  view(owner: string) {
    const s = this.own(owner);
    const creating = !!s.foundation && !s.foundation.complete;
    const busy =
      (!!s.lease && s.lease.until > Date.now()) ||
      ((creating || s.queued) && !s.error);
    return {
      id: s.id,
      game: s.game ? publicGame(s.game, busy) : null,
      busy,
      error: creating || !s.game?.card ? s.error : null,
      creation: creating
        ? {
            done:
              (s.game ? 1 : 0) +
              (s.game
                ? artTasks(s.game.world).filter(
                    (t) => s.game!.world.art?.[t.slot],
                  ).length
                : 0) +
              (s.game?.card ? 1 : 0),
            total: 2 + (s.game ? artTasks(s.game.world).length : 1),
            stage: !s.game
              ? "Shaping your society"
              : artTasks(s.game.world).some((t) => !s.game!.world.art?.[t.slot])
                ? "Painting your world"
                : "Preparing your first visitor",
          }
        : null,
    };
  }
  async mutate(owner: string, operation: string, raw: unknown) {
    const s = this.own(owner);
    const input = mutationSchema.parse(raw);
    if (s.requests.includes(input.requestId)) return this.view(owner);
    if (!s.game) throw new Error("Your society is still being prepared.");
    if (s.game.version !== input.version)
      throw new Error(
        "Your society changed in another tab. Refresh to continue.",
      );
    if (operation === "choose") {
      const body = choiceSchema.parse(raw);
      s.game = play(s.game, body.cardId, body.side);
    } else if (operation === "start") {
      if (s.foundation && !s.foundation.complete)
        throw new Error("Your society is still being prepared.");
      if (s.game.phase !== "intro")
        throw new Error("Your reign has already begun.");
      s.game.phase = "playing";
      s.game.version++;
    } else if (operation === "abandon") {
      s.game = abandon(s.game);
      s.lease = null;
      s.queued = false;
      await this.ctx.storage.deleteAlarm();
    } else throw new Error("Unknown action");
    s.requests = [...s.requests, input.requestId].slice(-40);
    s.error = null;
    await this.persist();
    return this.view(owner);
  }
  async acquire(owner: string, background: boolean) {
    const s = this.own(owner);
    if (s.lease && s.lease.until > Date.now()) return null;
    const g = s.game;
    if (g?.reign.ended) return null;
    if (
      g?.phase === "intro" &&
      s.foundation &&
      !s.foundation.complete &&
      artTasks(g.world).some((t) => !g.world.art?.[t.slot])
    )
      return null;
    if (g && !g.card) {
      const due = nextDraft(g);
      if (due && !due.commitmentId) {
        g.card = g.deck.shift()!;
        s.error = null;
        await this.persist();
        return null;
      }
    }
    const enrich =
      !!g?.card &&
      background &&
      g.world.identityVersion !== WORLD_IDENTITY_VERSION &&
      s.spent + 0.03 <= Number(this.env.GAME_AI_BUDGET);
    if (!enrich && g?.card && (!background || g.deck.length >= 2)) return null;
    if (!enrich && g && !g.card && background) return null;
    const due = g && !g.card ? nextDraft(g) : null;
    const reserve = !g || enrich ? 0.03 : due?.commitmentId ? 0.002 : 0.015;
    if (
      s.spent + reserve > Number(this.env.GAME_AI_BUDGET) ||
      s.attempts >= 100
    )
      throw new Error(
        "This society has reached its AI allowance. Your chronicle is saved.",
      );
    const lease: Lease = {
      token: crypto.randomUUID(),
      until: Date.now() + (!g || enrich ? 180000 : 60000),
      kind: !g
        ? "world"
        : enrich
          ? "identity"
          : due?.commitmentId
            ? "callback"
            : "cards",
      reserved: reserve,
      reign: g?.reign.number ?? 0,
      ...(due?.commitmentId
        ? { commitmentId: due.commitmentId, draft: due.draft }
        : {}),
    };
    s.lease = lease;
    s.error = null;
    await this.persist();
    await this.ctx.storage.setAlarm(lease.until + 100);
    return { lease, prompt: s.prompt, game: g };
  }
  async allocated(owner: string, token: string) {
    const s = this.own(owner);
    if (s.lease?.token !== token) return false;
    const reservations = (s.reservations ??= {});
    if (!(token in reservations)) {
      reservations[token] =
        s.lease.reserved ?? (s.lease.kind === "callback" ? 0.002 : 0.015);
      s.spent += reservations[token];
      s.attempts++;
    }
    await this.persist();
    return true;
  }
  async finish(
    owner: string,
    token: string,
    payload: {
      world?: World;
      cards?: Card[];
      art?: Record<string, string>;
      cost: number;
      error?: string;
    },
  ) {
    const s = this.own(owner);
    if (s.settled?.includes(token)) {
      await this.persist();
      return;
    }
    s.settled = [...(s.settled ?? []), token].slice(-256);
    s.spent += payload.cost - (s.reservations?.[token] ?? 0);
    if (s.reservations) delete s.reservations[token];
    if (s.lease?.token !== token) {
      await this.persist();
      return;
    }
    const lease = s.lease;
    s.lease = null;
    if (payload.art && s.game) {
      s.game.world.art = { ...s.game.world.art, ...payload.art };
      s.game.version++;
    }
    if (payload.error) s.error = payload.error;
    else if (payload.world && !s.game)
      s.game = freshGame(s.id, s.prompt, payload.world);
    else if (payload.world && s.game && lease.kind === "identity") {
      s.game.world = payload.world;
      if (payload.world.pressure) s.game.reserve ??= 6;
    } else if (
      payload.cards &&
      s.game &&
      !s.game.reign.ended &&
      s.game.reign.number === lease.reign
    ) {
      if (
        lease.kind === "callback" &&
        s.game.commitments.some((p) => p.id === lease.commitmentId)
      ) {
        s.game.card = {
          ...payload.cards[0]!,
          commitmentId: lease.commitmentId,
        };
      } else if (lease.kind === "cards") {
        s.game.deck.push(...payload.cards);
        if (!s.game.card && !nextDraft(s.game)?.commitmentId)
          s.game.card = s.game.deck.shift()!;
      }
    }
    if (s.game) {
      s.game.cost = s.spent;
      s.game.generations = s.attempts;
    }
    await this.persist();
  }
  async continueFoundation(owner: string) {
    const s = this.own(owner);
    if (!s.foundation || s.foundation.complete) return false;
    if (!s.lease || s.lease.until <= Date.now()) {
      s.error = null;
      await this.persist();
      await this.ctx.storage.setAlarm(Date.now() + 100);
    }
    return true;
  }
  async queuePreparation(owner: string) {
    const s = this.own(owner);
    if (
      !s.game ||
      s.game.reign.ended ||
      (s.foundation && !s.foundation.complete)
    )
      return;
    if (
      s.game.world.identityVersion === WORLD_IDENTITY_VERSION &&
      s.game.card &&
      s.game.deck.length >= 2
    )
      return;
    s.queued = true;
    s.error = null;
    await this.persist();
    await this.ctx.storage.setAlarm(
      s.lease && s.lease.until > Date.now()
        ? s.lease.until + 100
        : Date.now() + 100,
    );
  }
  async alarm() {
    const s = this.save;
    if (!s || s.error) return;
    if (s.lease && s.lease.until > Date.now()) {
      await this.ctx.storage.setAlarm(s.lease.until + 100);
      return;
    }
    if (!s.foundation || s.foundation.complete) {
      if (!s.queued) return;
      try {
        await prepare(this.env, this, s.owner, !!s.game?.card);
      } catch (error) {
        s.error = /allowance/.test((error as Error).message)
          ? (error as Error).message
          : "The next visitor could not be prepared. Please retry.";
      }
      s.queued = false;
      await this.persist();
      if (!s.error && s.game && !s.game.card && !s.game.reign.ended)
        await this.queuePreparation(s.owner);
      return;
    }
    try {
      if (!s.game) {
        await prepare(this.env, this, s.owner);
      } else {
        const missing = artTasks(s.game.world)
          .filter((task) => !s.game!.world.art?.[task.slot])
          .slice(0, 5);
        if (missing.length) {
          const reserved = missing.length * ART_RESERVATION;
          if (
            s.spent + reserved > Number(this.env.GAME_AI_BUDGET) ||
            s.attempts >= 100
          )
            throw new Error(
              "This society has reached its AI allowance. Your progress is saved.",
            );
          const token = crypto.randomUUID();
          s.lease = {
            token,
            until: Date.now() + 120000,
            kind: "art",
            reign: 1,
            reserved,
          };
          await this.persist();
          await this.ctx.storage.setAlarm(s.lease.until + 100);
          const budget = this.env.BUDGET.getByName(
            new Date().toISOString().slice(0, 10),
          );
          let allocated = false;
          let cost = 0;
          const art: Record<string, string> = {};
          try {
            await budget.reserve(token, reserved);
            allocated = true;
            await this.allocated(s.owner, token);
            const outcomes = await Promise.allSettled(
              missing.map(async (task) => {
                const key = `${s.foundation!.templateId}/${task.slot}`;
                const existing = await this.env.ART.head(key);
                if (!existing) {
                  const result = await generateArt(
                    this.env.OPENROUTER_API_KEY,
                    task,
                  );
                  cost += result.cost;
                  await this.env.ART.put(key, result.bytes, {
                    httpMetadata: {
                      contentType: result.contentType,
                      cacheControl: "public, max-age=31536000, immutable",
                    },
                  });
                }
                art[task.slot] = `/api/art/${key}`;
              }),
            );
            if (outcomes.some((r) => r.status === "rejected")) {
              // Unknown provider outcomes retain their reservation; successful images stay saved.
              cost = Math.max(cost, reserved);
              throw new Error(
                "Some artwork could not be prepared. Retry to finish the missing images.",
              );
            }
            await this.finish(s.owner, token, { art, cost });
          } catch (error) {
            if (allocated && cost === 0) cost = reserved;
            await this.finish(s.owner, token, {
              art,
              cost,
              error: allocated
                ? "Some artwork could not be prepared. Retry to finish the missing images."
                : (error as Error).message,
            });
          } finally {
            if (allocated) await budget.settle(token, cost);
          }
        } else if (!s.game.card) {
          await prepare(this.env, this, s.owner);
        } else {
          await publishCampaign(
            this.env.CAMPAIGNS,
            s.foundation.templateId,
            s.game.world,
            [s.game.card, ...s.game.deck],
          );
          s.foundation.complete = true;
          s.game.version++;
          await this.persist();
        }
      }
      if (!s.error && !s.foundation.complete)
        await this.ctx.storage.setAlarm(Date.now() + 100);
    } catch (error) {
      s.error = /allowance/.test((error as Error).message)
        ? (error as Error).message
        : "Your world could not be finished. Retry to continue from the last saved step.";
      await this.persist();
    }
  }
}

type Ledger = {
  spent: number;
  reservations: Record<string, number>;
};
export class Budget extends DurableObject<Bindings> {
  private ledger: Ledger = { spent: 0, reservations: {} };
  constructor(ctx: DurableObjectState, env: Bindings) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.ledger = (await ctx.storage.get<Ledger>("ledger")) ?? this.ledger;
    });
  }
  async reserve(token: string, amount: number) {
    const l = this.ledger;
    if (token in l.reservations) return;
    const reserved = Object.values(l.reservations).reduce((a, b) => a + b, 0);
    if (l.spent + reserved + amount > Number(this.env.DAILY_AI_BUDGET))
      throw new Error(
        "The republic is resting. Today’s AI allowance is used; your progress is saved for tomorrow.",
      );
    l.reservations[token] = amount;
    await this.ctx.storage.put("ledger", l);
    if (!(await this.ctx.storage.getAlarm()))
      await this.ctx.storage.setAlarm(Date.now() + 3 * 86400000);
  }
  async settle(token: string, cost: number) {
    if (!(token in this.ledger.reservations)) return;
    this.ledger.spent += cost;
    delete this.ledger.reservations[token];
    await this.ctx.storage.put("ledger", this.ledger);
  }
  async alarm() {
    await this.ctx.storage.deleteAll();
  }
}

async function prepare(
  env: Bindings,
  stub: Pick<SocietyV3, "acquire" | "allocated" | "finish">,
  owner: string,
  background = false,
) {
  const work = await stub.acquire(owner, background);
  if (!work) return;
  const budget = env.BUDGET.getByName(new Date().toISOString().slice(0, 10));
  const reserved =
    work.lease.reserved ?? (work.lease.kind === "callback" ? 0.002 : 0.015);
  let allocated = false;
  let cost = reserved;
  try {
    await budget.reserve(work.lease.token, reserved);
    allocated = true;
    if (!(await stub.allocated(owner, work.lease.token))) {
      cost = 0;
      return;
    }
    if (work.lease.kind === "world") {
      const result = await generateWorld(env.OPENROUTER_API_KEY, work.prompt);
      cost = result.cost;
      await stub.finish(owner, work.lease.token, { world: result.value, cost });
    } else if (work.lease.kind === "identity") {
      const result = await enrichWorld(
        env.OPENROUTER_API_KEY,
        work.game!.world,
      );
      cost = result.cost;
      await stub.finish(owner, work.lease.token, { world: result.value, cost });
    } else if (work.lease.kind === "callback") {
      const result = await scoreCards(
        env.OPENROUTER_API_KEY,
        work.game!.world,
        [work.lease.draft!],
      );
      cost = result.cost;
      await stub.finish(owner, work.lease.token, { cards: result.value, cost });
    } else {
      const result = await generateCards(env.OPENROUTER_API_KEY, work.game!);
      cost = result.cost;
      await stub.finish(owner, work.lease.token, { cards: result.value, cost });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const safe = !allocated
      ? message
      : "The next dispatch could not be prepared. Your choices are saved. Please retry.";
    console.error(
      JSON.stringify({
        event: "preparation_failed",
        kind: work.lease.kind,
        error: error instanceof Error ? error.name : "unknown",
      }),
    );
    await stub.finish(owner, work.lease.token, {
      cost: allocated ? reserved : 0,
      error: safe,
    });
  } finally {
    if (allocated) await budget.settle(work.lease.token, cost);
  }
}

const security = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "same-origin",
};
export default {
  async fetch(request: Request, env: Bindings, ctx: ExecutionContext) {
    const url = new URL(request.url);
    let session = request.headers
      .get("Cookie")
      ?.match(/(?:^|;\s*)sr_session=([0-9a-f-]{36})(?:;|$)/)?.[1];
    const newSession = !session;
    session ??= crypto.randomUUID();
    const headers: Record<string, string> = { ...security };
    if (newSession)
      headers["Set-Cookie"] =
        `sr_session=${session}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000${url.protocol === "https:" ? "; Secure" : ""}`;
    const json = (body: unknown, status = 200) =>
      Response.json(body, { status, headers });
    try {
      if (url.pathname === "/api/health")
        return json({ status: "ok", version: 2 });
      const asset = url.pathname.match(
        /^\/api\/art\/([0-9a-f-]{36})\/(background|portrait-[0-5]|resource-[0-2])$/,
      );
      if (asset && request.method === "GET") {
        const cacheKey = new Request(`${url.origin}${url.pathname}`);
        const cache = await caches.open("world-art-v3");
        const cached = await cache.match(cacheKey);
        if (cached) return cached;
        const object = await env.ART.get(`${asset[1]}/${asset[2]}`);
        if (!object) return json({ error: "Not found" }, 404);
        const response = new Response(object.body, {
          headers: {
            "Content-Type": object.httpMetadata?.contentType ?? "image/webp",
            "Cache-Control": "public, max-age=31536000, immutable",
            ETag: object.httpEtag,
            "X-Content-Type-Options": "nosniff",
          },
        });
        ctx.waitUntil(cache.put(cacheKey, response.clone()));
        return response;
      }
      if (
        !(
          await env.REQUEST_LIMIT.limit({
            key: request.headers.get("CF-Connecting-IP") ?? "local",
          })
        ).success
      )
        return json(
          {
            error:
              "Too many requests. Wait a minute, then resume your society.",
          },
          429,
        );
      if (request.method !== "GET" && request.method !== "POST")
        return json({ error: "Method not allowed" }, 405);
      if (request.method === "POST") {
        if (
          request.headers.get("Origin") &&
          request.headers.get("Origin") !== url.origin
        )
          return json({ error: "Invalid origin" }, 403);
        if (
          !request.headers.get("Content-Type")?.startsWith("application/json")
        )
          return json({ error: "JSON required" }, 415);
        if (Number(request.headers.get("Content-Length") ?? 0) > 4096)
          return json({ error: "Request too large" }, 413);
      }
      const path = url.pathname.match(
        /^\/api\/games(?:\/([0-9a-f-]{36})(?:\/(start|choose|prepare|abandon))?)?$/,
      );
      const lookup =
        url.pathname === "/api/campaigns/match" && request.method === "POST";
      if (!path && !lookup) return json({ error: "Not found" }, 404);
      let raw: unknown = {};
      if (request.method === "POST") {
        const reader = request.body?.getReader();
        const decoder = new TextDecoder();
        let text = "",
          size = 0;
        if (reader)
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > 4096) {
              await reader.cancel();
              return json({ error: "Request too large" }, 413);
            }
            text += decoder.decode(value, { stream: true });
          }
        text += decoder.decode();
        raw = JSON.parse(text);
      }
      if (lookup) {
        const { prompt } = z
          .object({ prompt: z.string().trim().min(5).max(400) })
          .parse(raw);
        const entries = await candidates(env.CAMPAIGNS, prompt);
        if (!entries.length) return json({ matches: [] });
        const token = crypto.randomUUID();
        const budget = env.BUDGET.getByName(
          new Date().toISOString().slice(0, 10),
        );
        let reserved = false;
        let cost = MATCH_RESERVATION;
        try {
          await budget.reserve(token, MATCH_RESERVATION);
          reserved = true;
          const result = await matchCampaigns(
            env.OPENROUTER_API_KEY,
            prompt,
            entries,
          );
          cost = result.cost;
          return json({ matches: result.matches });
        } catch {
          return json({ matches: [], unavailable: true });
        } finally {
          if (reserved) await budget.settle(token, cost);
        }
      }
      if (!path) return json({ error: "Not found" }, 404);
      if (!path[1] && request.method === "POST") {
        const body = z
          .object({
            id: uuid,
            prompt: z.string().trim().min(5).max(400),
            campaignId: uuid.optional(),
          })
          .parse(raw);
        const template = body.campaignId
          ? await getCampaign(env.CAMPAIGNS, body.campaignId)
          : undefined;
        if (body.campaignId && !template)
          return json(
            {
              error:
                "That society is no longer available. Create a new world instead.",
            },
            404,
          );
        const stub = env.SOCIETIES.getByName(body.id);
        await stub.initialize(
          session,
          body.id,
          body.prompt,
          template ?? undefined,
        );
        await stub.continueFoundation(session);
        return json(await stub.view(session));
      }
      if (!path[1]) return json({ error: "Not found" }, 404);
      const id = uuid.parse(path[1]);
      const stub = env.SOCIETIES.getByName(id);
      if (request.method === "GET" && !path[2]) {
        const state = await stub.view(session);
        if (state.game?.card && !state.busy && !state.creation)
          await stub.queuePreparation(session);
        return json(await stub.view(session));
      }
      if (request.method !== "POST" || !path[2])
        return json({ error: "Not found" }, 404);
      if (path[2] === "prepare") {
        if (await stub.continueFoundation(session))
          return json(await stub.view(session));
        await stub.queuePreparation(session);
        const state = await stub.view(session);
        if (state.game?.card && !state.busy && !state.creation)
          await stub.queuePreparation(session);
        return json(await stub.view(session));
      }
      const state = await stub.mutate(session, path[2], raw);
      if (!state.game?.reign.ended && !state.busy)
        await stub.queuePreparation(session);
      return json(await stub.view(session));
    } catch (error) {
      if (error instanceof z.ZodError || error instanceof SyntaxError)
        return json({ error: "Please check the request and try again." }, 400);
      const message = error instanceof Error ? error.message : "";
      const allowed =
        /Society not found|Refresh|refresh|already|allowance|still being|Complete your|chronicle is complete|changed in another/;
      return json(
        {
          error: allowed.test(message)
            ? message
            : "Something went wrong. Your saved choices are safe; please retry.",
        },
        message.includes("Society not found") ? 404 : 409,
      );
    }
  },
} satisfies ExportedHandler<Bindings>;
