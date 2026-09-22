import { test, expect, mock } from "bun:test";
import { freshGame, type World } from "../src/game";
mock.module("cloudflare:workers", () => ({
  DurableObject: class {
    constructor(
      public ctx: DurableObjectState,
      public env: unknown,
    ) {}
  },
}));
const { Society } = await import("./index");

test("a cheap callback fits the remaining allowance and completion is charged once", async () => {
  const world: World = {
    name: "Test",
    era: "Now",
    role: "Steward",
    summary: "Test",
    calendar: "Day",
    tone: "earth",
    factions: [],
    resources: [],
    characters: [],
  };
  const game = freshGame("test", "Test society", world);
  game.phase = "playing";
  game.commitments = [
    {
      id: "due",
      due: 0,
      title: "Pay the crews",
      detail: "The crews need wages.",
      character: 0,
      source: "Wages",
      after: 3,
      resolve: {
        label: "Pay",
        consequence: "The crews are paid.",
      },
      abandon: {
        label: "Refuse",
        consequence: "The crews strike.",
      },
    },
  ];
  let saved = {
    id: "test",
    owner: "owner",
    prompt: "Test",
    game,
    lease: null,
    error: null,
    requests: [],
    spent: 0.19,
    attempts: 1,
  } as unknown;
  let ready: Promise<unknown> = Promise.resolve();
  let failNextWrite = false;
  const ctx = {
    blockConcurrencyWhile: (fn: () => Promise<unknown>) => {
      ready = fn();
      return ready;
    },
    storage: {
      setAlarm: async () => {},
      get: async () => saved,
      put: async (_: string, value: unknown) => {
        if (failNextWrite) {
          failNextWrite = false;
          throw new Error("storage unavailable");
        }
        saved = structuredClone(value);
      },
    },
  } as unknown as DurableObjectState;
  const society = new Society(ctx, {
    GAME_AI_BUDGET: "0.20",
  } as ConstructorParameters<typeof Society>[1]);
  await ready;
  const work = await society.acquire("owner", false);
  expect(work?.lease.kind).toBe("callback");
  await society.finish("owner", work!.lease.token, {
    cost: 0.002,
    error: "Test failure",
  });
  await society.finish("owner", work!.lease.token, {
    cost: 0.002,
    error: "Test failure",
  });
  expect((saved as { spent: number }).spent).toBeCloseTo(0.192);
  const free = await society.acquire("owner", false);
  await society.finish("owner", free!.lease.token, {
    cost: 0,
    error: "Free completion",
  });
  await society.finish("owner", free!.lease.token, {
    cost: 0.015,
    error: "Repeated delivery",
  });
  expect((saved as { spent: number }).spent).toBeCloseTo(0.192);
  const retry = await society.acquire("owner", false);
  failNextWrite = true;
  await expect(
    society.finish("owner", retry!.lease.token, { cost: 0.002, error: "Test" }),
  ).rejects.toThrow("storage unavailable");
  await society.finish("owner", retry!.lease.token, {
    cost: 0.015,
    error: "Repeated delivery",
  });
  expect((saved as { spent: number }).spent).toBeCloseTo(0.194);
});

function harness(initial: unknown, bindings: Record<string, unknown> = {}) {
  let saved = structuredClone(initial);
  let ready: Promise<unknown> = Promise.resolve();
  const alarms: number[] = [];
  const ctx = {
    blockConcurrencyWhile: (fn: () => Promise<unknown>) => (ready = fn()),
    storage: {
      get: async () => structuredClone(saved),
      put: async (_: string, value: unknown) => {
        saved = structuredClone(value);
      },
      setAlarm: async (time: number) => {
        alarms.push(time);
      },
    },
  } as unknown as DurableObjectState;
  const society = new Society(ctx, {
    GAME_AI_BUDGET: "0.20",
    ...bindings,
  } as ConstructorParameters<typeof Society>[1]);
  return { society, ready, alarms, saved: () => saved as any };
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
};

test("legacy unfinished saves acquire durable generation on retry", async () => {
  const h = harness(emptySave);
  await h.ready;
  await h.society.initialize("owner", "test", "A new society");
  expect(await h.society.continueFoundation("owner")).toBe(true);
  expect(h.society.view("owner").creation?.done).toBe(0);
  expect(h.alarms.length).toBeGreaterThan(0);
  await expect(
    h.society.initialize("other", "test", "A new society"),
  ).rejects.toThrow("Society not found");
});

test("terminated paid calls keep their per-game reservation through a restart", async () => {
  const h = harness({ ...emptySave, spent: 0.16 });
  await h.ready;
  const work = await h.society.acquire("owner", false);
  await h.society.allocated("owner", work!.lease.token);
  await h.society.allocated("owner", work!.lease.token);
  expect(h.saved().spent).toBeCloseTo(0.19);
  expect(h.saved().attempts).toBe(1);
  const restarted = harness({
    ...h.saved(),
    lease: { ...h.saved().lease, until: 0 },
  });
  await restarted.ready;
  await expect(restarted.society.acquire("owner", false)).rejects.toThrow(
    "allowance",
  );
  await restarted.society.finish("owner", work!.lease.token, {
    cost: 0.003,
    error: "Recovered outcome",
  });
  expect(restarted.saved().spent).toBeCloseTo(0.163);
  await restarted.society.finish("owner", work!.lease.token, { cost: 0.003 });
  expect(restarted.saved().spent).toBeCloseTo(0.163);
});

test("a background failure preserves legacy art and retries only the missing background", async () => {
  const world: World = {
    name: "Test reef",
    era: "Ninth tide",
    role: "Speaker",
    summary: "Octopuses live beneath the sea.",
    calendar: "Tide",
    tone: "night",
    factions: [],
    resources: ["Air", "Copper", "Oil"],
    characters: Array.from({ length: 6 }, () => ({
      name: "Adviser",
      role: "Diver",
      faction: 0,
      personality: "Direct",
      appearance: "An octopus",
    })),
    artDirection: {
      scene: "An underwater city",
      palette: "Teal",
      identity: "Octopus republic",
    },
    art: Object.fromEntries(
      [
        ...Array.from({ length: 6 }, (_, i) => `portrait-${i}`),
        "resource-0",
      ].map((slot) => [slot, `/api/art/test/${slot}`]),
    ),
  };
  const game = freshGame("test", "Private prompt", world);
  game.card = {
    id: "card",
    title: "Air",
    body: "Repair the pump?",
    character: 0,
    kind: "ordinary",
    options: [],
    reactions: [],
  };
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
      {
        ...emptySave,
        game,
        foundation: {
          templateId: "template",
          visitor: "visitor",
          complete: false,
        },
      },
      {
        ART: {
          head: async (key: string) => (images.has(key) ? {} : null),
          put: async (key: string) => {
            images.add(key);
          },
        },
        BUDGET: {
          getByName: () => ({
            reserve: async () => {},
            settle: async (_: string, cost: number) => {
              settlements.push(cost);
            },
          }),
        },
        CAMPAIGNS: {
          prepare: () => ({ bind: (...args: unknown[]) => args }),
          batch: async (items: unknown[]) => {
            published.push(items);
          },
        },
      },
    );
    await h.ready;
    await h.society.alarm();
    expect(Object.keys(h.saved().game.world.art)).toHaveLength(7);
    expect(h.society.view("owner").error).toContain("artwork");
    expect(published).toHaveLength(0);
    expect(calls).toBe(1);
    await h.society.continueFoundation("owner");
    await h.society.alarm();
    expect(calls).toBe(2);
    expect(Object.keys(h.saved().game.world.art)).toHaveLength(8);
    await h.society.alarm();
    await h.society.alarm();
    expect(published).toHaveLength(1);
    expect(h.society.view("owner").creation).toBeNull();
    expect(h.saved().foundation.complete).toBe(true);
    expect(h.saved().spent).toBeCloseTo(settlements.reduce((a, b) => a + b, 0));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("legacy daily creation counts do not block new generation", async () => {
  const { Budget } = await import("./index");
  let ready: Promise<unknown> = Promise.resolve();
  let ledger = {
    spent: 0.1,
    reservations: {} as Record<string, number>,
    visitors: { visitor: { calls: 180, worlds: 4 } },
    creations: Object.fromEntries(
      Array.from({ length: 100 }, (_, i) => [`new-${i}`, "visitor"]),
    ),
    reuses: Object.fromEntries(
      Array.from({ length: 200 }, (_, i) => [`reuse-${i}`, "visitor"]),
    ),
  };
  const ctx = {
    blockConcurrencyWhile: (fn: () => Promise<unknown>) => (ready = fn()),
    storage: {
      get: async () => structuredClone(ledger),
      put: async (_: string, value: typeof ledger) => {
        ledger = structuredClone(value);
      },
      getAlarm: async () => 1,
      setAlarm: async () => {},
    },
  } as unknown as DurableObjectState;
  const budget = new Budget(ctx, {
    DAILY_AI_BUDGET: "1",
  } as ConstructorParameters<typeof Budget>[1]);
  await ready;
  await budget.reserve("new-world", 0.015);
  expect(ledger.reservations["new-world"]).toBe(0.015);
  await budget.reserve("new-world", 0.015);
  expect(Object.keys(ledger.reservations)).toHaveLength(1);
  await budget.settle("new-world", 0.005);
  await budget.settle("new-world", 0.005);
  expect(ledger.spent).toBeCloseTo(0.105);
  expect(ledger.reservations).toEqual({});
  await expect(budget.reserve("over-budget", 1)).rejects.toThrow(
    "AI allowance",
  );
});
