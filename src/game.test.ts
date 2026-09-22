import { test, expect } from "bun:test";
import {
  freshGame,
  play,
  abandon,
  nextDraft,
  type World,
  type Card,
} from "./game";

const world: World = {
  name: "Test colony",
  era: "1 AE",
  role: "Steward",
  summary: "A settlement",
  calendar: "Sol",
  tone: "mars",
  factions: Array.from({ length: 4 }, (_, i) => ({
    name: `Faction ${i}`,
    description: "People",
    priority: "Survive",
    redLine: "Abandonment",
  })),
  resources: ["Air", "Water", "Power"],
  characters: Array.from({ length: 6 }, (_, i) => ({
    name: `Person ${i}`,
    role: "Chief",
    faction: i % 4,
    personality: "Direct",
    appearance: "human" as const,
    portrait: i,
  })),
};
const card: Card = {
  id: "one",
  title: "The pumps",
  body: "Repair the pumps?",
  character: 0,
  kind: "ordinary",
  options: [
    {
      label: "Repair",
      consequence: "Crews begin work.",
      legacy: "Public pumps",
      promise: {
        title: "Pay the crews",
        detail: "The crews await payment.",
        after: 3,
        resolve: {
          label: "Pay",
          consequence: "The debt is settled.",
        },
        abandon: {
          label: "Refuse",
          consequence: "The crews walk.",
        },
      },
    },
    {
      label: "Refuse",
      consequence: "Pumps fail.",
      legacy: null,
      promise: null,
    },
  ],
  reactions: [
    [-6, 0, 12, 6],
    [6, 0, -12, 0],
  ].map((row) => row.map((delta) => ({ delta, uncertain: false }))),
};
function fixture() {
  const g = freshGame("id", "Mars", world);
  g.phase = "playing";
  g.card = structuredClone(card);
  return g;
}

test("a choice changes support once, records history, and carries a promise into a callback", () => {
  const result = play(fixture(), "one", 0);
  expect(result.reign.support).toEqual([44, 50, 62, 56]);
  expect(result.history[0]?.action).toBe("Repair");
  expect(result.legacies).toContain("Public pumps");
  expect(() => play(result, "one", 0)).toThrow();
  result.totalTurns = 4;
  const callback = nextDraft(result);
  expect(callback?.commitmentId).toBe(result.commitments[0]?.id);
  result.card = {
    ...callback!.draft,
    id: "callback",
    commitmentId: callback!.commitmentId,
    reactions: card.reactions,
  };
  expect(play(result, "callback", 0).commitments).toHaveLength(0);
});
test("simultaneous collapse permanently ends the run and preserves its chronicle", () => {
  const g = fixture();
  g.reign.support = [5, 50, 5, 50];
  g.card!.reactions[0]![2]!.delta = -12;
  const result = play(g, "one", 0);
  expect(result.reign.ended?.kind).toBe("fall");
  expect(result.reign.ended?.reason).toContain("Faction 2");
  expect(result.card).toBeNull();
  expect(result.deck).toHaveLength(0);
  expect(result.history).toHaveLength(1);
  expect(() => play(result, "one", 0)).toThrow();
});
test("survival continues beyond 36 decisions without a fixed ending", () => {
  const g = fixture();
  g.reign.turn = 35;
  expect(play(g, "one", 1).reign.ended).toBeNull();
  g.reign.turn = 160;
  expect(play(g, "one", 1).reign.ended).toBeNull();
});

test("abandoning ends the run without adding a decision or losing its chronicle", () => {
  const g = play(fixture(), "one", 0);
  g.card = structuredClone(card);
  const result = abandon(g);
  expect(result.reign.ended?.kind).toBe("abandoned");
  expect(result.totalTurns).toBe(g.totalTurns);
  expect(result.history).toEqual(g.history);
  expect(result.legacies).toEqual(g.legacies);
  expect(result.version).toBe(g.version + 1);
  expect(result.card).toBeNull();
  expect(result.deck).toHaveLength(0);
  expect(g.reign.ended).toBeNull();
  expect(() => play(result, "one", 1)).toThrow();
  expect(() => abandon(result)).toThrow();
});

test("history records actual gains at support limits", () => {
  const g = fixture();
  g.reign.support = [3, 50, 98, 100];
  const result = play(g, "one", 0);
  expect(result.reign.support).toEqual([0, 50, 100, 100]);
  expect(result.history[0]?.deltas).toEqual([-3, 0, 2, 0]);
});

test("a prepared card is promoted atomically unless a promise is due", () => {
  const g = fixture();
  g.deck = [{ ...structuredClone(card), id: "next" }];
  expect(play(g, "one", 1).card?.id).toBe("next");
  const promised = play(g, "one", 0);
  promised.card = { ...structuredClone(card), id: "due-turn" };
  promised.deck = [{ ...structuredClone(card), id: "later" }];
  promised.totalTurns = 3;
  const due = play(promised, "due-turn", 1);
  expect(due.card).toBeNull();
  expect(nextDraft(due)?.commitmentId).toBe(promised.commitments[0]!.id);
  expect(due.deck).toHaveLength(1);
});

test("reserve choices persist, replenish at the cap and cause a real loss at zero", () => {
  const g = fixture();
  g.world.pressure = { resource: "Air", warning: "Air reserves run out" };
  g.reserve = 1;
  g.card!.reserveChanges = [3, 0];
  const supplied = play(g, "one", 0);
  expect(supplied.reserve).toBe(3);
  expect(supplied.reign.ended).toBeNull();
  const lost = play(g, "one", 1);
  expect(lost.reserve).toBe(0);
  expect(lost.reign.ended?.reason).toContain("Air reserves run out");
  expect(() => play(lost, "one", 0)).toThrow();
  g.reserve = 8;
  expect(play(g, "one", 0).reserve).toBe(8);
});
test("legacy cards keep their existing reserve during identity enrichment", () => {
  const g = fixture();
  g.reserve = 6;
  g.world.pressure = { resource: "Air", warning: "Air reserves run out" };
  expect(play(g, "one", 1).reserve).toBe(6);
});
