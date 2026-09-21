import { DurableObject } from "cloudflare:workers";
import { z } from "zod";
import {
  freshGame,
  publicGame,
  play,
  succeed,
  retire,
  nextDraft,
  type Game,
  type World,
  type Card,
  type Draft,
} from "../src/game";
import { generateWorld, generateCards, scoreCards } from "./ai";

type Bindings = {
  SOCIETIES: DurableObjectNamespace<Society>;
  BUDGET: DurableObjectNamespace<Budget>;
  REQUEST_LIMIT: RateLimit;
  OPENROUTER_API_KEY: string;
  DAILY_AI_BUDGET: string;
  GAME_AI_BUDGET: string;
};
type Lease = {
  token: string;
  until: number;
  kind: "world" | "cards" | "callback";
  reign: number;
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
  settled?: string[];
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
const startSchema = mutationSchema.extend({
  ambition: z.union([z.literal(0), z.literal(1)]),
});
const successorSchema = startSchema.extend({
  coalition: z.union([z.literal(0), z.literal(1)]),
});

export class Society extends DurableObject<Bindings> {
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
  async initialize(owner: string, id: string, prompt: string) {
    if (this.save) {
      this.own(owner);
      return;
    }
    this.save = {
      id,
      owner,
      prompt,
      game: null,
      lease: null,
      error: null,
      requests: [],
      spent: 0,
      attempts: 0,
    };
    await this.persist();
  }
  view(owner: string) {
    const s = this.own(owner);
    const busy = !!s.lease && s.lease.until > Date.now();
    return {
      id: s.id,
      game: s.game ? publicGame(s.game, busy) : null,
      busy,
      error: s.game?.card ? null : s.error,
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
      const body = startSchema.parse(raw);
      if (s.game.phase !== "intro")
        throw new Error("Your reign has already begun.");
      s.game.phase = "playing";
      s.game.reign.ambition = body.ambition;
      s.game.version++;
    } else if (operation === "succeed") {
      const body = successorSchema.parse(raw);
      s.game = succeed(s.game, body.coalition, body.ambition);
      s.lease = null;
    } else if (operation === "retire") {
      s.game = retire(s.game);
      s.lease = null;
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
    if (g && (g.phase !== "playing" || g.reign.ended)) return null;
    if (g && !g.card) {
      const due = nextDraft(g);
      if (due && !due.commitmentId) {
        g.card = g.deck.shift()!;
        s.error = null;
        await this.persist();
        return null;
      }
    }
    if (g?.card && (!background || g.deck.length > 0)) return null;
    if (g && !g.card && background) return null;
    const due = g && !g.card ? nextDraft(g) : null;
    const reserve = due?.commitmentId ? 0.002 : 0.015;
    if (
      s.spent + reserve > Number(this.env.GAME_AI_BUDGET) ||
      s.attempts >= 100
    )
      throw new Error(
        "This society has reached its AI allowance. Your chronicle is saved.",
      );
    const lease: Lease = {
      token: crypto.randomUUID(),
      until: Date.now() + 60000,
      kind: !g ? "world" : due?.commitmentId ? "callback" : "cards",
      reign: g?.reign.number ?? 0,
      ...(due?.commitmentId
        ? { commitmentId: due.commitmentId, draft: due.draft }
        : {}),
    };
    s.lease = lease;
    s.error = null;
    await this.persist();
    return { lease, prompt: s.prompt, game: g };
  }
  async allocated(owner: string, token: string) {
    const s = this.own(owner);
    if (s.lease?.token !== token) return false;
    s.attempts++;
    await this.persist();
    return true;
  }
  async finish(
    owner: string,
    token: string,
    payload: { world?: World; cards?: Card[]; cost: number; error?: string },
  ) {
    const s = this.own(owner);
    if (s.settled?.includes(token)) {
      await this.persist();
      return;
    }
    s.settled = [...(s.settled ?? []), token].slice(-256);
    s.spent += payload.cost;
    if (s.lease?.token !== token) {
      await this.persist();
      return;
    }
    const lease = s.lease;
    s.lease = null;
    if (payload.error) s.error = payload.error;
    else if (payload.world && !s.game)
      s.game = freshGame(s.id, s.prompt, payload.world);
    else if (
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
}

type Ledger = {
  spent: number;
  reservations: Record<string, number>;
  visitors: Record<string, { calls: number; worlds: number }>;
  creations?: Record<string, string>;
};
export class Budget extends DurableObject<Bindings> {
  private ledger: Ledger = { spent: 0, reservations: {}, visitors: {} };
  constructor(ctx: DurableObjectState, env: Bindings) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.ledger = (await ctx.storage.get<Ledger>("ledger")) ?? this.ledger;
    });
  }
  async admitWorld(visitor: string, id: string) {
    const creations = (this.ledger.creations ??= {});
    if (creations[id]) return;
    const visitors = Object.values(creations);
    if (
      visitors.length >= 100 ||
      visitors.filter((v) => v === visitor).length >= 4
    )
      throw new Error(
        "Today’s new-society allowance is used. Existing societies remain available; try again tomorrow.",
      );
    creations[id] = visitor;
    await this.ctx.storage.put("ledger", this.ledger);
    if (!(await this.ctx.storage.getAlarm()))
      await this.ctx.storage.setAlarm(Date.now() + 3 * 86400000);
  }
  async reserve(
    visitor: string,
    token: string,
    world: boolean,
    amount: number,
  ) {
    const l = this.ledger;
    const v = l.visitors[visitor] ?? { calls: 0, worlds: 0 };
    if (v.calls >= 180 || (world && v.worlds >= 4))
      throw new Error(
        "Today’s creation allowance is used. Your existing societies are saved; try again tomorrow.",
      );
    const reserved = Object.values(l.reservations).reduce((a, b) => a + b, 0);
    if (l.spent + reserved + amount > Number(this.env.DAILY_AI_BUDGET))
      throw new Error(
        "The republic is resting. Today’s AI allowance is used; your progress is saved for tomorrow.",
      );
    v.calls++;
    if (world) v.worlds++;
    l.visitors[visitor] = v;
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
  stub: DurableObjectStub<Society>,
  owner: string,
  visitor: string,
  background = false,
) {
  const work = await stub.acquire(owner, background);
  if (!work) return;
  const budget = env.BUDGET.getByName(new Date().toISOString().slice(0, 10));
  const reserved = work.lease.kind === "callback" ? 0.002 : 0.015;
  let allocated = false;
  let cost = reserved;
  try {
    await budget.reserve(
      visitor,
      work.lease.token,
      work.lease.kind === "world",
      reserved,
    );
    allocated = true;
    if (!(await stub.allocated(owner, work.lease.token))) {
      cost = 0;
      return;
    }
    if (work.lease.kind === "world") {
      const result = await generateWorld(env.OPENROUTER_API_KEY, work.prompt);
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
        return json({ status: "ok", version: 1 });
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
        /^\/api\/games(?:\/([0-9a-f-]{36})(?:\/(start|choose|prepare|succeed|retire))?)?$/,
      );
      if (!path) return json({ error: "Not found" }, 404);
      const visitorBytes = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(
          `${new Date().toISOString().slice(0, 10)}:${request.headers.get("CF-Connecting-IP") ?? "local"}`,
        ),
      );
      const visitor = Array.from(new Uint8Array(visitorBytes))
        .slice(0, 12)
        .map((n) => n.toString(16).padStart(2, "0"))
        .join("");
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
      if (!path[1] && request.method === "POST") {
        const body = z
          .object({ id: uuid, prompt: z.string().trim().min(5).max(400) })
          .parse(raw);
        await env.BUDGET.getByName(
          new Date().toISOString().slice(0, 10),
        ).admitWorld(visitor, body.id);
        const stub = env.SOCIETIES.getByName(body.id);
        await stub.initialize(session, body.id, body.prompt);
        await prepare(env, stub, session, visitor);
        return json(await stub.view(session));
      }
      if (!path[1]) return json({ error: "Not found" }, 404);
      const id = uuid.parse(path[1]);
      const stub = env.SOCIETIES.getByName(id);
      if (request.method === "GET" && !path[2]) {
        const state = await stub.view(session);
        if (state.game?.card && !state.busy)
          ctx.waitUntil(
            prepare(env, stub, session, visitor, true).catch(() => {}),
          );
        return json(state);
      }
      if (request.method !== "POST" || !path[2])
        return json({ error: "Not found" }, 404);
      if (path[2] === "prepare") {
        await prepare(env, stub, session, visitor);
        const state = await stub.view(session);
        if (state.game?.card && !state.busy)
          ctx.waitUntil(
            prepare(env, stub, session, visitor, true).catch(() => {}),
          );
        return json(state);
      }
      return json(await stub.mutate(session, path[2], raw));
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
