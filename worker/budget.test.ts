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
    ambitions: [],
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
      ambition: 0,
      after: 3,
      resolve: {
        label: "Pay",
        consequence: "The crews are paid.",
        advances: true,
      },
      abandon: {
        label: "Refuse",
        consequence: "The crews strike.",
        advances: false,
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
