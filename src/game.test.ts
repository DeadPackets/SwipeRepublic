import { test, expect } from "bun:test";
import { freshGame, play, abandon, nextDraft, publicGame, type Game, type Succession } from "./game";
import { testCard, testWorld } from "./testWorld";

function fixture(support = [50, 50, 50, 50]): Game {
  const g = freshGame("id", "Mars", testWorld());
  g.phase = "playing";
  g.card = testCard("one");
  g.reign.support = support;
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
  result.card = { ...testCard("callback"), ...callback!.draft, commitmentId: callback!.commitmentId };
  expect(play(result, "callback", 0).commitments).toHaveLength(0);
});

test.each([
  ["collapse at 0, lower index wins a tie", [5, 50, 5, 50], [-6, 0, -12, 6], 0, "collapse", [3, 1]],
  ["excess at 100", [50, 50, 95, 50], [-6, 0, 12, 6], 2, "excess", [3, 1]],
  ["history keeps actual gains at the limits", [3, 50, 98, 100], [-6, 0, 12, 6], 0, "collapse", [2, 3]],
] as const)("death: %s", (_, support, deltas, faction, kind, candidates) => {
  const g = fixture([...support]);
  g.card = testCard("one", [[...deltas], [0, 0, 0, 0]]);
  g.deck = [testCard("next")];
  const result = play(g, "one", 0);
  const ending = result.endings.at(-1)!;
  expect(ending).toMatchObject({ kind, faction, reign: 1, turns: 1, year: 1 });
  expect(ending.title).toBe(testWorld().factions[faction]![kind].title);
  expect((result.card as Succession).candidates).toEqual([...candidates]);
  expect(result.deck).toHaveLength(1);
  expect(result.phase).toBe("playing");
  expect(result.history[0]!.deltas).toEqual(
    result.reign.support.map((v, i) => v - support[i]!),
  );
});

test("succession seats the backer, keeps the dynasty, and draws the next card", () => {
  const g = fixture([5, 50, 50, 70]);
  g.card = testCard("one", [[-6, 0, 0, 0], [0, 0, 0, 0]]);
  g.deck = [testCard("next")];
  g.commitments = [{ ...testCard().options[0]!.promise!, id: "p", due: 99, character: 0, source: "Old" }];
  const dead = play(g, "one", 0);
  const seat = dead.card as Succession;
  expect(seat.candidates).toEqual([3, 1]);
  const next = play(dead, seat.id, 1);
  expect(next.reign).toEqual({ number: 2, turn: 0, support: [50, 65, 50, 40] });
  expect(next.totalTurns).toBe(dead.totalTurns);
  expect(next.card?.id).toBe("next");
  expect(next.commitments.map((p) => p.id)).toContain("p");
  expect(next.history.at(-1)!.action).toBe("Backed by the Faction 1");
  expect(() => play(next, seat.id, 0)).toThrow();
});

test("abandoning ends the dynasty without adding a decision or losing its chronicle", () => {
  const g = play(fixture(), "one", 0);
  g.card = testCard("again");
  const result = abandon(g);
  expect(result.phase).toBe("over");
  expect(result.endings.at(-1)?.kind).toBe("abandoned");
  expect(result.totalTurns).toBe(g.totalTurns);
  expect(result.history).toEqual(g.history);
  expect(result.card).toBeNull();
  expect(() => play(result, "again", 1)).toThrow();
  expect(() => abandon(result)).toThrow();
});

test("a prepared card is promoted atomically unless a promise is due", () => {
  const g = fixture();
  g.deck = [testCard("next")];
  expect(play(g, "one", 1).card?.id).toBe("next");
  const promised = play(g, "one", 0);
  promised.card = testCard("due-turn");
  promised.deck = [testCard("later")];
  promised.totalTurns = 3;
  const due = play(promised, "due-turn", 1);
  expect(due.card).toBeNull();
  expect(nextDraft(due)?.commitmentId).toBe(promised.commitments[0]!.id);
  expect(due.deck).toHaveLength(1);
});

test("the public game hides reaction direction and the deck", () => {
  const g = fixture();
  g.deck = [testCard("next")];
  g.card = testCard("one", [[-6, 0, 12, 6], [6, 0, -12, 0]]);
  (g.card.reactions[1]![3] = { delta: -6, uncertain: true });
  const view = publicGame(g);
  expect(view.card && "reactions" in view.card && view.card.reactions).toEqual([
    [{ size: "small", uncertain: false }, null, { size: "large", uncertain: false }, { size: "small", uncertain: false }],
    [{ size: "small", uncertain: false }, null, { size: "large", uncertain: false }, { size: "small", uncertain: true }],
  ]);
  expect(JSON.stringify(view)).not.toContain("delta");
  expect("deck" in view).toBe(false);
});
