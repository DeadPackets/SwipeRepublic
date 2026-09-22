import type { Card, World } from "./game";

const shape = [{ d: "M10 90 C10 40 30 10 50 10 Q90 10 90 90 Z", fill: "#42535a" }];
export const testWorld = (): World => ({
  name: "Test colony",
  era: "1 AE",
  role: "Steward",
  summary: "A settlement",
  calendar: "Sol",
  factions: Array.from({ length: 4 }, (_, i) => ({
    name: `Faction ${i}`,
    description: "People",
    priority: "Survive",
    redLine: "Abandonment",
    label: `F${i}`,
    color: "#42535a",
    symbol: shape,
    collapse: { title: `Dropped by ${i}`, reason: `Faction ${i} walked away.` },
    excess: { title: `Smothered by ${i}`, reason: `Faction ${i} loved you too much.` },
  })),
  characters: Array.from({ length: 24 }, (_, i) => ({
    name: `Person ${i}`,
    role: "Chief",
    faction: i % 4,
    personality: "Direct",
    appearance: "Human",
    voice: "Plain",
    relationship: "Knows everyone",
    silhouette: shape,
  })),
  artDirection: { scene: "Domes on red sand", palette: "Rust", identity: "A Mars colony" },
});

export const testCard = (id: string = crypto.randomUUID(), deltas = [[-6, 0, 12, 6], [6, 0, -12, 0]]): Card => ({
  id,
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
        resolve: { label: "Pay", consequence: "The debt is settled." },
        abandon: { label: "Refuse", consequence: "The crews walk." },
      },
    },
    { label: "Refuse", consequence: "Pumps fail.", legacy: null, promise: null },
  ],
  reactions: deltas.map((row) => row.map((delta) => ({ delta, uncertain: false }))),
});
