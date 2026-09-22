import { expect, test } from "bun:test";
import {
  cloneCampaign,
  qualifyingMatches,
  type CampaignCandidate,
} from "./campaigns";
import { artTasks } from "./art";
import type { Card, World } from "../src/game";

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

const world: World = {
  name: "Glass reef",
  era: "The ninth tide",
  role: "Speaker",
  calendar: "Tide",
  tone: "night",
  summary: "Octopuses govern a drowned city.",
  factions: [],
  resources: ["Air", "Copper", "Algae"],
  characters: Array.from({ length: 6 }, (_, i) => ({
    name: `Adviser ${i}`,
    role: "Diver",
    faction: i % 4,
    personality: "Direct",
    appearance: "An elderly octopus wearing a copper diving hood",
  })),
  artDirection: {
    scene: "Copper bells beneath a black ocean",
    palette: "Teal and copper",
    identity: "An underwater octopus republic",
  },
  art: { background: "/api/art/template/background" },
};
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
  expect(second.world.characters[0]!.name).toBe("Adviser 0");
  expect(first.card!.id).not.toBe(second.card!.id);
  expect(second.card!.id).not.toBe(card.id);
  expect(second.world.art!.background).toBe(world.art!.background);
  expect(template.cards[0]!.id).toBe("shared-card");
});
test("only the world background uses an image call", () => {
  const tasks = artTasks(world);
  expect(tasks.map((t) => t.slot)).toEqual(["background"]);
  expect(tasks[0]!.prompt).toContain(world.summary);
  expect(tasks[0]!.prompt).toContain(world.artDirection!.scene);
});
