import { test, expect } from "bun:test";
import {
  freshGame,
  play,
  succeed,
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
test("simultaneous collapse is terminal and succession preserves the world without an instant repeat defeat", () => {
  const g = fixture();
  g.reign.support = [5, 50, 5, 50];
  g.card!.reactions[0]![2]!.delta = -12;
  const result = play(g, "one", 0);
  expect(result.reign.ended?.kind).toBe("fall");
  expect(result.reign.ended?.reason).toContain("Faction 2");
  const next = succeed(result, 1);
  expect(next.reign.number).toBe(2);
  expect(next.reign.support.every((n) => n >= 35)).toBe(true);
  expect(next.legacies).toContain("Public pumps");
  expect(next.commitments).toHaveLength(1);
});
test("survival continues beyond 36 decisions and five reigns", () => {
  const g = fixture();
  g.reign.turn = 35;
  expect(play(g, "one", 1).reign.ended).toBeNull();
  g.reign.turn = 160;
  expect(play(g, "one", 1).reign.ended).toBeNull();
  g.reign.number = 5;
  g.reign.support[0] = 1;
  expect(succeed(play(g, "one", 0), 1).reign.number).toBe(6);
});

test("an inherited promise remains a real decision", () => {
  const g = fixture();
  g.reign.support[0] = 5;
  const next = succeed(play(g, "one", 0), 1);
  next.totalTurns = 4;
  const callback = nextDraft(next)!;
  next.card = {
    ...callback.draft,
    id: "inherited",
    commitmentId: callback.commitmentId,
    reactions: card.reactions,
  };
  expect(play(next, "inherited", 0).commitments).toHaveLength(0);
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
