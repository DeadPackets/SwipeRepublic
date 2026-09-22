import { DurableObject } from "cloudflare:workers";
import { z } from "zod";
import {
  freshGame,
  publicGame,
  play,
  abandon,
  nextDraft,
  type Game,
  type World,
  type Card,
  type Draft,
} from "../src/game";
import { generateWorld, generateCards, scoreCards } from "./ai";
import { ART_RESERVATION, backgroundPrompt, generateArt } from "./art";
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
  DYNASTIES: DurableObjectNamespace<Dynasty>;
  LEDGER: DurableObjectNamespace<Ledger>;
  REQUEST_LIMIT: RateLimit;
  OPENROUTER_API_KEY: string;
  DAILY_AI_BUDGET: string;
  GAME_AI_BUDGET: string;
};
type Lease = {
  token: string;
  until: number;
  kind: "world" | "cards" | "callback" | "art";
  reserved: number;
  commitmentId?: string;
  draft?: Draft;
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
  settled: string[];
  reservations: Record<string, number>;
  queued: boolean;
  foundation: { templateId: string; complete: boolean } | null;
};

const MAX_ATTEMPTS = 100;
const DECK_TARGET = 5;
const RESERVE = { world: 0.03, cards: 0.025, callback: 0.002 };
const LEASE_MS = { world: 180000, cards: 90000, callback: 90000, art: 120000 };
const ALLOWANCE = "This dynasty has reached its AI allowance. Your chronicle is saved.";

const uuid = z.uuid();
const mutationSchema = z.object({
  requestId: uuid,
  version: z.number().int().nonnegative(),
});
const choiceSchema = mutationSchema.extend({
  cardId: uuid,
  side: z.union([z.literal(0), z.literal(1)]),
});
const today = (env: Bindings) =>
  env.LEDGER.getByName(new Date().toISOString().slice(0, 10));

export class Dynasty extends DurableObject<Bindings> {
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
  private async wake(at = Date.now() + 100) {
    await this.ctx.storage.setAlarm(at);
  }
  private affordable(s: Save, amount: number) {
    return (
      s.spent + amount <= Number(this.env.GAME_AI_BUDGET) &&
      s.attempts < MAX_ATTEMPTS
    );
  }
  async initialize(owner: string, id: string, prompt: string, template?: Template) {
    if (this.save) {
      this.own(owner);
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
      settled: [],
      reservations: {},
      queued: false,
      foundation: template
        ? null
        : { templateId: crypto.randomUUID(), complete: false },
    };
    await this.persist();
    if (!template) await this.wake();
  }
  view(owner: string) {
    const s = this.own(owner);
    const g = s.game;
    const creating = !!s.foundation && !s.foundation.complete;
    const busy =
      (!!s.lease && s.lease.until > Date.now()) ||
      ((creating || s.queued) && !s.error);
    return {
      id: s.id,
      game: g ? publicGame(g, busy) : null,
      busy,
      error: creating || !g?.card ? s.error : null,
      creation: creating
        ? {
            done: (g ? 1 : 0) + (g?.world.background ? 1 : 0) + (g?.card ? 1 : 0),
            total: 3,
            stage: !g
              ? "Shaping your society"
              : !g.world.background
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
      throw new Error("Your society changed in another tab. Refresh to continue.");
    if (operation === "choose") {
      const body = choiceSchema.parse(raw);
      s.game = play(s.game, body.cardId, body.side);
    } else if (operation === "start") {
      if (s.foundation && !s.foundation.complete)
        throw new Error("Your society is still being prepared.");
      if (s.game.phase !== "intro") throw new Error("Your reign has already begun.");
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
    if (g?.phase === "over") return null;
    if (g && !g.world.background && s.foundation && !s.foundation.complete)
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
    if (g?.card && (!background || g.deck.length >= DECK_TARGET)) return null;
    if (g && !g.card && background) return null;
    const due = g && !g.card ? nextDraft(g) : null;
    const kind = !g ? "world" : due?.commitmentId ? "callback" : "cards";
    const reserved = RESERVE[kind];
    if (!this.affordable(s, reserved)) throw new Error(ALLOWANCE);
    const lease: Lease = {
      token: crypto.randomUUID(),
      until: Date.now() + LEASE_MS[kind],
      kind,
      reserved,
      ...(due?.commitmentId
        ? { commitmentId: due.commitmentId, draft: due.draft }
        : {}),
    };
    s.lease = lease;
    s.error = null;
    await this.persist();
    await this.wake(lease.until + 100);
    return { lease, prompt: s.prompt, game: g };
  }
  async allocated(owner: string, token: string) {
    const s = this.own(owner);
    if (s.lease?.token !== token) return false;
    if (!(token in s.reservations)) {
      s.reservations[token] = s.lease.reserved;
      s.spent += s.lease.reserved;
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
      background?: string;
      cost: number;
      error?: string;
    },
  ) {
    const s = this.own(owner);
    if (s.settled.includes(token)) return;
    s.settled = [...s.settled, token].slice(-256);
    s.spent += payload.cost - (s.reservations[token] ?? 0);
    delete s.reservations[token];
    const lease = s.lease?.token === token ? s.lease : null;
    if (lease) s.lease = null;
    const g = s.game;
    if (lease && g?.phase !== "over") {
      if (payload.error) s.error = payload.error;
      else if (payload.background && g) {
        g.world.background = payload.background;
        g.version++;
      } else if (payload.world && !g) s.game = freshGame(s.id, s.prompt, payload.world);
      else if (payload.cards && g) {
        if (lease.kind === "callback") {
          if (g.commitments.some((p) => p.id === lease.commitmentId))
            g.card = { ...payload.cards[0]!, commitmentId: lease.commitmentId };
        } else {
          g.deck.push(...payload.cards);
          if (!g.card && !nextDraft(g)?.commitmentId) g.card = g.deck.shift()!;
        }
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
      await this.wake();
    }
    return true;
  }
  async queuePreparation(owner: string) {
    const s = this.own(owner);
    const g = s.game;
    if (!g || g.phase === "over" || (s.foundation && !s.foundation.complete)) return;
    if (g.card && g.deck.length >= DECK_TARGET) return;
    s.queued = true;
    s.error = null;
    await this.persist();
    await this.wake(s.lease && s.lease.until > Date.now() ? s.lease.until + 100 : undefined);
  }
  async alarm() {
    const s = this.save;
    if (!s || s.error) return;
    if (s.lease && s.lease.until > Date.now()) {
      await this.wake(s.lease.until + 100);
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
      if (!s.error && s.game && !s.game.card && s.game.phase !== "over")
        await this.queuePreparation(s.owner);
      return;
    }
    try {
      const g = s.game;
      if (!g) await prepare(this.env, this, s.owner);
      else if (!g.world.background) await this.paint(s, g.world);
      else if (!g.card) await prepare(this.env, this, s.owner);
      else {
        await publishCampaign(this.env.CAMPAIGNS, s.foundation.templateId, g.world, [
          g.card as Card,
          ...g.deck,
        ]);
        s.foundation.complete = true;
        g.version++;
        await this.persist();
      }
      if (!s.error && !s.foundation.complete) await this.wake();
    } catch (error) {
      s.error = /allowance/.test((error as Error).message)
        ? (error as Error).message
        : "Your world could not be finished. Retry to continue from the last saved step.";
      await this.persist();
    }
  }
  private async paint(s: Save, world: World) {
    if (!this.affordable(s, ART_RESERVATION)) throw new Error(ALLOWANCE);
    const token = crypto.randomUUID();
    s.lease = {
      token,
      until: Date.now() + LEASE_MS.art,
      kind: "art",
      reserved: ART_RESERVATION,
    };
    await this.persist();
    await this.wake(s.lease.until + 100);
    const ledger = today(this.env);
    const key = s.foundation!.templateId;
    let allocated = false;
    let cost = 0;
    try {
      await ledger.reserve(token, ART_RESERVATION);
      allocated = true;
      await this.allocated(s.owner, token);
      if (!(await this.env.ART.head(key))) {
        const result = await generateArt(this.env.OPENROUTER_API_KEY, backgroundPrompt(world));
        cost = result.cost;
        await this.env.ART.put(key, result.bytes, {
          httpMetadata: {
            contentType: result.contentType,
            cacheControl: "public, max-age=31536000, immutable",
          },
        });
      }
      await this.finish(s.owner, token, { background: `/api/art/${key}`, cost });
    } catch (error) {
      // An unknown provider outcome keeps its reservation.
      if (allocated && cost === 0) cost = ART_RESERVATION;
      await this.finish(s.owner, token, {
        cost,
        error: allocated
          ? "The artwork could not be prepared. Retry to finish it."
          : (error as Error).message,
      });
    } finally {
      if (allocated) await ledger.settle(token, cost);
    }
  }
}

type LedgerState = { spent: number; reservations: Record<string, number> };
export class Ledger extends DurableObject<Bindings> {
  private ledger: LedgerState = { spent: 0, reservations: {} };
  constructor(ctx: DurableObjectState, env: Bindings) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.ledger = (await ctx.storage.get<LedgerState>("ledger")) ?? this.ledger;
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
  stub: Pick<Dynasty, "acquire" | "allocated" | "finish">,
  owner: string,
  background = false,
) {
  const work = await stub.acquire(owner, background);
  if (!work) return;
  const { lease } = work;
  const ledger = today(env);
  let allocated = false;
  let cost = lease.reserved;
  try {
    await ledger.reserve(lease.token, lease.reserved);
    allocated = true;
    if (!(await stub.allocated(owner, lease.token))) {
      cost = 0;
      return;
    }
    if (lease.kind === "world") {
      const result = await generateWorld(env.OPENROUTER_API_KEY, work.prompt);
      cost = result.cost;
      await stub.finish(owner, lease.token, { world: result.value, cost });
    } else {
      const result =
        lease.kind === "callback"
          ? await scoreCards(env.OPENROUTER_API_KEY, work.game!.world, [lease.draft!])
          : await generateCards(env.OPENROUTER_API_KEY, work.game!);
      cost = result.cost;
      await stub.finish(owner, lease.token, { cards: result.value, cost });
    }
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "preparation_failed",
        kind: lease.kind,
        error: error instanceof Error ? error.name : "unknown",
      }),
    );
    await stub.finish(owner, lease.token, {
      cost: allocated ? lease.reserved : 0,
      error: allocated
        ? "The next dispatch could not be prepared. Your choices are saved. Please retry."
        : error instanceof Error
          ? error.message
          : "",
    });
  } finally {
    if (allocated) await ledger.settle(lease.token, cost);
  }
}

const security = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "same-origin",
};
const userErrors =
  /Society not found|Refresh|already|allowance|still being|changed in another/;

async function readJson(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return {};
  const decoder = new TextDecoder();
  let text = "";
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 4096) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }
  return JSON.parse(text + decoder.decode()) as unknown;
}

export default {
  async fetch(request: Request, env: Bindings, ctx: ExecutionContext) {
    const url = new URL(request.url);
    let session = request.headers
      .get("Cookie")
      ?.match(/(?:^|;\s*)sr_session=([0-9a-f-]{36})(?:;|$)/)?.[1];
    const headers: Record<string, string> = { ...security };
    if (!session) {
      session = crypto.randomUUID();
      headers["Set-Cookie"] =
        `sr_session=${session}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000${url.protocol === "https:" ? "; Secure" : ""}`;
    }
    const json = (body: unknown, status = 200) =>
      Response.json(body, { status, headers });
    try {
      if (url.pathname === "/api/health") return json({ status: "ok" });
      const art = url.pathname.match(/^\/api\/art\/([0-9a-f-]{36})$/);
      if (art && request.method === "GET") {
        const cacheKey = new Request(`${url.origin}${url.pathname}`);
        const cache = await caches.open("world-art");
        const cached = await cache.match(cacheKey);
        if (cached) return cached;
        const object = await env.ART.get(art[1]!);
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
      const limit = await env.REQUEST_LIMIT.limit({
        key: request.headers.get("CF-Connecting-IP") ?? "local",
      });
      if (!limit.success)
        return json(
          { error: "Too many requests. Wait a minute, then resume your society." },
          429,
        );
      if (request.method !== "GET" && request.method !== "POST")
        return json({ error: "Method not allowed" }, 405);
      let raw: unknown = {};
      if (request.method === "POST") {
        const origin = request.headers.get("Origin");
        if (origin && origin !== url.origin)
          return json({ error: "Invalid origin" }, 403);
        if (!request.headers.get("Content-Type")?.startsWith("application/json"))
          return json({ error: "JSON required" }, 415);
        if (Number(request.headers.get("Content-Length") ?? 0) > 4096)
          return json({ error: "Request too large" }, 413);
        raw = await readJson(request);
        if (raw === null) return json({ error: "Request too large" }, 413);
      }
      if (url.pathname === "/api/campaigns/match" && request.method === "POST") {
        const { prompt } = z
          .object({ prompt: z.string().trim().min(5).max(400) })
          .parse(raw);
        const entries = await candidates(env.CAMPAIGNS, prompt);
        if (!entries.length) return json({ matches: [] });
        const token = crypto.randomUUID();
        const ledger = today(env);
        let reserved = false;
        let cost = MATCH_RESERVATION;
        try {
          await ledger.reserve(token, MATCH_RESERVATION);
          reserved = true;
          const result = await matchCampaigns(env.OPENROUTER_API_KEY, prompt, entries);
          cost = result.cost;
          return json({ matches: result.matches });
        } catch {
          return json({ matches: [], unavailable: true });
        } finally {
          if (reserved) await ledger.settle(token, cost);
        }
      }
      const path = url.pathname.match(
        /^\/api\/games(?:\/([0-9a-f-]{36})(?:\/(start|choose|prepare|abandon))?)?$/,
      );
      if (!path) return json({ error: "Not found" }, 404);
      if (!path[1]) {
        if (request.method !== "POST") return json({ error: "Not found" }, 404);
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
            { error: "That society is no longer available. Create a new world instead." },
            404,
          );
        const stub = env.DYNASTIES.getByName(body.id);
        await stub.initialize(session, body.id, body.prompt, template ?? undefined);
        await stub.continueFoundation(session);
        return json(await stub.view(session));
      }
      const stub = env.DYNASTIES.getByName(path[1]);
      const refill = async () => {
        const state = await stub.view(session);
        if (state.game?.card && !state.busy && !state.creation)
          await stub.queuePreparation(session);
        return json(await stub.view(session));
      };
      if (request.method === "GET" && !path[2]) return await refill();
      if (request.method !== "POST" || !path[2])
        return json({ error: "Not found" }, 404);
      if (path[2] === "prepare") {
        if (await stub.continueFoundation(session))
          return json(await stub.view(session));
        await stub.queuePreparation(session);
        return await refill();
      }
      const state = await stub.mutate(session, path[2], raw);
      if (state.game?.phase !== "over" && !state.busy)
        await stub.queuePreparation(session);
      return json(await stub.view(session));
    } catch (error) {
      if (error instanceof z.ZodError || error instanceof SyntaxError)
        return json({ error: "Please check the request and try again." }, 400);
      const message = error instanceof Error ? error.message : "";
      return json(
        {
          error: userErrors.test(message)
            ? message
            : "Something went wrong. Your saved choices are safe; please retry.",
        },
        message.includes("Society not found") ? 404 : 409,
      );
    }
  },
} satisfies ExportedHandler<Bindings>;
