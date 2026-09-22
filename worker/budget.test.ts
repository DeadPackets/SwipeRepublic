import { test, expect, mock } from "bun:test";
import { freshGame, play, type Succession } from "../src/game";
import { testCard, testWorld } from "../src/testWorld";
mock.module("cloudflare:workers", () => ({
  DurableObject: class {
    constructor(
      public ctx: DurableObjectState,
      public env: unknown,
    ) {}
  },
}));
const { Dynasty, Ledger } = await import("./index");

function harness(initial: unknown, bindings: Record<string, unknown> = {}) {
  let saved = structuredClone(initial);
  let ready: Promise<unknown> = Promise.resolve();
  let failNextWrite = false;
  const alarms: number[] = [];
  const ctx = {
    blockConcurrencyWhile: (fn: () => Promise<unknown>) => (ready = fn()),
    storage: {
      get: async () => structuredClone(saved),
      put: async (_: string, value: unknown) => {
        if (failNextWrite) {
          failNextWrite = false;
          throw new Error("storage unavailable");
        }
        saved = structuredClone(value);
      },
      deleteAlarm: async () => {
        alarms.length = 0;
      },
      setAlarm: async (time: number) => {
        alarms.push(time);
      },
    },
  } as unknown as DurableObjectState;
  const dynasty = new Dynasty(ctx, {
    GAME_AI_BUDGET: "0.20",
    ...bindings,
  } as ConstructorParameters<typeof Dynasty>[1]);
  return {
    dynasty,
    ready,
    alarms,
    saved: () => saved as any,
    failNextWrite: () => (failNextWrite = true),
  };
}
const emptySave = {
  id: "test",
  owner: "owner",
  prompt: "A new society",
  game: null,
  lease: null,
  error: null,
  requests: [],
  spent: 0,
  attempts: 0,
  settled: [],
  reservations: {},
  queued: false,
  foundation: null,
};
function playing() {
  const game = freshGame("test", "Test society", testWorld());
  game.phase = "playing";
  return game;
}

test("a cheap callback fits the remaining allowance and completion is charged once", async () => {
  const game = playing();
  game.commitments = [
    { ...testCard().options[0]!.promise!, id: "due", due: 0, character: 0, source: "Wages" },
  ];
  const h = harness({ ...emptySave, game, spent: 0.19, attempts: 1 });
  await h.ready;
  const work = await h.dynasty.acquire("owner", false);
  expect(work?.lease.kind).toBe("callback");
  for (let i = 0; i < 2; i++)
    await h.dynasty.finish("owner", work!.lease.token, { cost: 0.002, error: "Test failure" });
  expect(h.saved().spent).toBeCloseTo(0.192);
  const retry = await h.dynasty.acquire("owner", false);
  h.failNextWrite();
  await expect(
    h.dynasty.finish("owner", retry!.lease.token, { cost: 0.002, error: "Test" }),
  ).rejects.toThrow("storage unavailable");
  await h.dynasty.finish("owner", retry!.lease.token, { cost: 0.015, error: "Repeated delivery" });
  expect(h.saved().spent).toBeCloseTo(0.194);
});

test("a new society schedules durable generation and belongs to its owner", async () => {
  const fresh = harness(undefined);
  await fresh.ready;
  await fresh.dynasty.initialize("owner", "test", "A new society");
  expect(await fresh.dynasty.continueFoundation("owner")).toBe(true);
  expect(fresh.dynasty.view("owner").creation).toMatchObject({ done: 0, total: 3 });
  expect(fresh.alarms.length).toBeGreaterThan(0);
  await expect(fresh.dynasty.initialize("other", "test", "A new society")).rejects.toThrow(
    "Society not found",
  );
});

test("terminated paid calls keep their per-game reservation through a restart", async () => {
  const h = harness({ ...emptySave, spent: 0.16 });
  await h.ready;
  const work = await h.dynasty.acquire("owner", false);
  await h.dynasty.allocated("owner", work!.lease.token);
  await h.dynasty.allocated("owner", work!.lease.token);
  expect(h.saved().spent).toBeCloseTo(0.19);
  expect(h.saved().attempts).toBe(1);
  const restarted = harness({ ...h.saved(), lease: { ...h.saved().lease, until: 0 } });
  await restarted.ready;
  await expect(restarted.dynasty.acquire("owner", false)).rejects.toThrow("allowance");
  await restarted.dynasty.finish("owner", work!.lease.token, { cost: 0.003, error: "Recovered" });
  expect(restarted.saved().spent).toBeCloseTo(0.163);
  await restarted.dynasty.finish("owner", work!.lease.token, { cost: 0.003 });
  expect(restarted.saved().spent).toBeCloseTo(0.163);
});

test("a failed background retries, then the finished world is published once", async () => {
  const game = freshGame("test", "Private prompt", testWorld());
  game.card = testCard();
  const images = new Set<string>();
  const published: unknown[] = [];
  const settlements: number[] = [];
  let calls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    calls++;
    if (calls === 1) return new Response("unavailable", { status: 502 });
    return Response.json({
      data: [{ b64_json: "AQID", media_type: "image/webp" }],
      usage: { cost: 0.01 },
    });
  }) as unknown as typeof fetch;
  try {
    const h = harness(
      { ...emptySave, game, foundation: { templateId: "template", complete: false } },
      {
        ART: {
          head: async (key: string) => (images.has(key) ? {} : null),
          put: async (key: string) => void images.add(key),
        },
        LEDGER: {
          getByName: () => ({
            reserve: async () => {},
            settle: async (_: string, cost: number) => void settlements.push(cost),
          }),
        },
        CAMPAIGNS: {
          prepare: () => ({ bind: (...args: unknown[]) => args }),
          batch: async (items: unknown[]) => void published.push(items),
        },
      },
    );
    await h.ready;
    await h.dynasty.alarm();
    expect(h.dynasty.view("owner").error).toContain("artwork");
    expect(h.saved().game.world.background).toBeUndefined();
    await h.dynasty.continueFoundation("owner");
    await h.dynasty.alarm();
    expect(calls).toBe(2);
    expect(h.saved().game.world.background).toBe("/api/art/template");
    await h.dynasty.alarm();
    await h.dynasty.alarm();
    expect(published).toHaveLength(1);
    expect(h.dynasty.view("owner").creation).toBeNull();
    expect(h.saved().spent).toBeCloseTo(settlements.reduce((a, b) => a + b, 0));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("the daily ledger reserves and settles once and refuses overspending", async () => {
  let ready: Promise<unknown> = Promise.resolve();
  let state = { spent: 0.1, reservations: {} as Record<string, number> };
  const ctx = {
    blockConcurrencyWhile: (fn: () => Promise<unknown>) => (ready = fn()),
    storage: {
      get: async () => structuredClone(state),
      put: async (_: string, value: typeof state) => void (state = structuredClone(value)),
      getAlarm: async () => 1,
      setAlarm: async () => {},
    },
  } as unknown as DurableObjectState;
  const ledger = new Ledger(ctx, { DAILY_AI_BUDGET: "1" } as ConstructorParameters<typeof Ledger>[1]);
  await ready;
  await ledger.reserve("a", 0.025);
  await ledger.reserve("a", 0.025);
  expect(Object.keys(state.reservations)).toHaveLength(1);
  await ledger.settle("a", 0.005);
  await ledger.settle("a", 0.005);
  expect(state.spent).toBeCloseTo(0.105);
  await expect(ledger.reserve("big", 1)).rejects.toThrow("AI allowance");
});

test("a succession card still lets the deck refill and keeps its place", async () => {
  const game = playing();
  game.reign.support = [5, 50, 50, 50];
  game.card = testCard("dying", [[-6, 0, 0, 0], [0, 0, 0, 0]]);
  const dead = play(game, "dying", 0);
  const h = harness({ ...emptySave, game: dead });
  await h.ready;
  const work = await h.dynasty.acquire("owner", true);
  expect(work?.lease).toMatchObject({ kind: "cards", reserved: 0.025 });
  await h.dynasty.finish("owner", work!.lease.token, {
    cards: [testCard(), testCard(), testCard(), testCard(), testCard()],
    cost: 0.002,
  });
  expect((h.saved().game.card as Succession).kind).toBe("succession");
  expect(h.saved().game.deck).toHaveLength(5);
  expect(await h.dynasty.acquire("owner", true)).toBeNull();
});

test("abandoning stops queued work and ignores an in-flight generation result", async () => {
  const game = playing();
  const h = harness({ ...emptySave, game, queued: true });
  await h.ready;
  const work = await h.dynasty.acquire("owner", false);
  await h.dynasty.allocated("owner", work!.lease.token);
  const action = { version: 0, requestId: crypto.randomUUID() };
  await h.dynasty.mutate("owner", "abandon", action);
  await h.dynasty.mutate("owner", "abandon", action);
  await h.dynasty.finish("owner", work!.lease.token, { cards: [testCard()], cost: 0.004 });
  expect(h.saved().game.phase).toBe("over");
  expect(h.saved().game.endings).toHaveLength(1);
  expect(h.saved().game.deck).toHaveLength(0);
  expect(h.saved().queued).toBe(false);
  expect(h.alarms).toHaveLength(0);
  expect(h.saved().spent).toBeCloseTo(0.004);
  expect(await h.dynasty.acquire("owner", false)).toBeNull();
  await expect(
    h.dynasty.mutate("owner", "succeed", { version: 1, requestId: crypto.randomUUID() }),
  ).rejects.toThrow("Unknown action");
  await expect(
    h.dynasty.mutate("other", "abandon", { version: 1, requestId: crypto.randomUUID() }),
  ).rejects.toThrow("Society not found");
});
