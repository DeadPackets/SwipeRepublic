import { expect, test } from "bun:test";
import {
  cloneCampaign,
  qualifyingMatches,
  type CampaignCandidate,
} from "./campaigns";
import { backgroundPrompt } from "./art";
import type { Card } from "../src/game";
import { testWorld } from "../src/testWorld";

const candidates: CampaignCandidate[] = Array.from({ length: 5 }, (_, i) => ({
  id: String(i),
  name: `World ${i}`,
  era: "Now",
  summary: "A city",
  identity: "Private generated matching metadata",
}));
test("only finite similarity scores strictly above 85 qualify, independent of confidence", () => {
  const matches = qualifyingMatches(candidates, [85, 85.01, NaN, 99, 101]);
  expect(matches.map((m) => m.id)).toEqual(["3", "1"]);
  expect(matches.every((m) => !("identity" in m))).toBe(true);
});

const world = { ...testWorld(), background: "/api/art/template" };
const card = {
  id: "shared-card",
  title: "The air",
  body: "We need air.",
  character: 0,
  kind: "ordinary",
  options: [],
  reactions: [],
} as Card;
test("campaign reuse creates independent private reigns and unique cards while sharing artwork", () => {
  const template = { world, cards: [card] };
  const first = cloneCampaign("first", "My private prompt", template);
  const second = cloneCampaign("second", "Another private prompt", template);
  first.reign.support[0] = 1;
  first.world.characters[0]!.name = "Changed";
  first.history.push({
    turn: 1,
    reign: 1,
    title: "A decision",
    action: "Yes",
    consequence: "Saved",
    deltas: [0, 0, 0, 0],
  });
  expect(second.reign.support).toEqual([50, 50, 50, 50]);
  expect(second.history).toHaveLength(0);
  expect(second.commitments).toHaveLength(0);
  expect(second.world.characters[0]!.name).toBe("Person 0");
  expect(first.card!.id).not.toBe(second.card!.id);
  expect(second.card!.id).not.toBe(card.id);
  expect(second.world.background).toBe(world.background);
  expect(template.cards[0]!.id).toBe("shared-card");
});
test("the background prompt carries the world's own scene", () => {
  const prompt = backgroundPrompt(world);
  expect(prompt).toContain(world.summary);
  expect(prompt).toContain(world.artDirection.scene);
});
