import { z } from "zod";

const short = (max: number) => z.string().min(1).max(max);
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const arity: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, C: 6, Q: 4, Z: 0 };
function validPath(d: string) {
  return [...d.matchAll(/([MLHVQCZ])([^MLHVQCZ]*)/g)].every(
    ([, command, args]) => {
      const values = args!.trim().split(/[\s,]+/).filter(Boolean).map(Number);
      const count = arity[command!]!;
      return (
        (count === 0
          ? values.length === 0
          : values.length >= count && values.length % count === 0) &&
        values.every((n) => Number.isFinite(n) && n >= 0 && n <= 100)
      );
    },
  );
}
export const vectorShapeSchema = z.object({
  d: z
    .string()
    .max(1500)
    .regex(/^M[MLHVQCZ0-9.,\s]+Z$/)
    .refine(
      validPath,
      "Use complete absolute path commands with coordinates from 0 to 100",
    ),
  fill: hex,
});
export const graphicSchema = z.array(vectorShapeSchema).min(1).max(14);
export type Graphic = z.infer<typeof graphicSchema>;

const deathSchema = z.object({
  title: short(40).describe("A one-line gallows-humor name for this death"),
  reason: short(120).describe("One sentence: what this faction did to the ruler"),
});
export const factionSchema = z.object({
  name: short(32),
  description: short(160),
  priority: short(120),
  redLine: short(120),
  label: short(16),
  color: hex,
  symbol: graphicSchema,
  collapse: deathSchema.describe("How the ruler dies when this faction's support reaches 0"),
  excess: deathSchema.describe("How the ruler dies when this faction's support reaches 100: too much of their love or control"),
});
export const characterSchema = z.object({
  name: short(40),
  role: short(50),
  faction: z.number().int().min(0).max(3),
  personality: short(120),
  appearance: short(400),
  voice: short(100),
  relationship: short(160),
  silhouette: graphicSchema,
});
export const worldSchema = z.object({
  name: short(70),
  era: short(120),
  role: short(70),
  summary: short(450),
  calendar: short(20),
  factions: z.array(factionSchema).length(4),
  characters: z.array(characterSchema).length(24),
  artDirection: z.object({
    scene: short(700),
    palette: short(160),
    identity: short(300),
  }),
});
export type World = z.infer<typeof worldSchema> & { background?: string };
export type Faction = World["factions"][number];

const actionSchema = z.object({ label: short(55), consequence: short(180) });
export const promiseSchema = z.object({
  title: short(70),
  detail: short(250),
  after: z.number().int().min(3).max(5),
  resolve: actionSchema,
  abandon: actionSchema,
});
export const optionSchema = actionSchema.extend({
  legacy: short(110).nullable(),
  promise: promiseSchema.nullable(),
});
export const draftSchema = z.object({
  title: short(55),
  body: short(320).describe(
    "Only the character’s exact spoken words to the ruler. No narrator, speaker label, stage directions or third-person speech report.",
  ),
  character: z.number().int().nonnegative(),
  kind: z.enum(["ordinary", "major", "relief"]),
  options: z.array(optionSchema).length(2),
});
export type Draft = z.infer<typeof draftSchema>;
export type Side = 0 | 1;
export type Reaction = { delta: number; uncertain: boolean };
export type Card = Draft & {
  id: string;
  reactions: Reaction[][];
  commitmentId?: string;
};
export type Succession = {
  id: string;
  kind: "succession";
  candidates: [number, number];
};
export type Commitment = z.infer<typeof promiseSchema> & {
  id: string;
  due: number;
  character: number;
  source: string;
};
export type Event = {
  turn: number;
  reign: number;
  title: string;
  character?: number;
  action: string;
  consequence: string;
  deltas: number[];
};
export type Ending = {
  kind: "collapse" | "excess" | "abandoned";
  faction: number | null;
  title: string;
  reason: string;
  reign: number;
  turns: number;
  year: number;
};
export type Game = {
  id: string;
  prompt: string;
  world: World;
  version: number;
  totalTurns: number;
  reign: { number: number; turn: number; support: number[] };
  card: Card | Succession | null;
  deck: Card[];
  commitments: Commitment[];
  legacies: string[];
  history: Event[];
  endings: Ending[];
  phase: "intro" | "playing" | "over";
  cost: number;
  generations: number;
};
export type PublicReaction = { size: "small" | "large"; uncertain: boolean } | null;
export type PublicCard = Omit<Card, "reactions"> & { reactions: PublicReaction[][] };
export type PublicGame = Omit<Game, "deck" | "cost" | "generations" | "card"> & {
  card: PublicCard | Succession | null;
  preparing: boolean;
};

export const LARGE_REACTION = 10;
const BACKER = 65;
const RIVAL = 40;

export function freshGame(id: string, prompt: string, world: World): Game {
  return {
    id,
    prompt,
    world,
    version: 0,
    totalTurns: 0,
    reign: { number: 1, turn: 0, support: [50, 50, 50, 50] },
    card: null,
    deck: [],
    commitments: [],
    legacies: [],
    history: [],
    endings: [],
    phase: "intro",
    cost: 0,
    generations: 0,
  };
}

function nextCard(g: Game) {
  g.card = nextDraft(g)?.commitmentId ? null : (g.deck.shift() ?? null);
}

function succession(support: number[], fatal: number): Succession {
  const [a, b] = [0, 1, 2, 3]
    .filter((i) => i !== fatal)
    .sort((x, y) => support[y]! - support[x]! || x - y);
  return { id: crypto.randomUUID(), kind: "succession", candidates: [a!, b!] };
}

export function play(game: Game, cardId: string, side: Side): Game {
  if (
    game.phase !== "playing" ||
    !game.card ||
    game.card.id !== cardId ||
    (side !== 0 && side !== 1)
  )
    throw new Error("This decision has already passed. Refresh your society.");
  const g = structuredClone(game);
  g.version++;
  const card = g.card!;
  const before = g.reign.support;
  if (card.kind === "succession") {
    const backer = card.candidates[side];
    const rival = card.candidates[side === 0 ? 1 : 0];
    const support = before.map((_, i) =>
      i === backer ? BACKER : i === rival ? RIVAL : 50,
    );
    g.reign = { number: g.reign.number + 1, turn: 0, support };
    g.history.push({
      turn: g.totalTurns,
      reign: g.reign.number,
      title: "A new ruler takes office",
      action: `Backed by the ${g.world.factions[backer]!.name}`,
      consequence: `The ${g.world.factions[rival]!.name} lost the vote.`,
      deltas: support.map((v, i) => v - before[i]!),
    });
    nextCard(g);
    return g;
  }
  const option = card.options[side]!;
  const support = before.map((n, i) =>
    Math.max(0, Math.min(100, n + card.reactions[side]![i]!.delta)),
  );
  g.reign.support = support;
  g.totalTurns++;
  g.reign.turn++;
  if (card.commitmentId)
    g.commitments = g.commitments.filter((p) => p.id !== card.commitmentId);
  if (option.promise && g.commitments.length < 3)
    g.commitments.push({
      ...option.promise,
      id: crypto.randomUUID(),
      due: g.totalTurns + option.promise.after,
      character: card.character,
      source: card.title,
    });
  if (option.legacy && !g.legacies.includes(option.legacy))
    g.legacies = [...g.legacies, option.legacy].slice(-3);
  g.history.push({
    turn: g.totalTurns,
    reign: g.reign.number,
    title: card.title,
    character: card.character,
    action: option.label,
    consequence: option.consequence,
    deltas: support.map((v, i) => v - before[i]!),
  });
  g.history = g.history.slice(-180);
  const collapsed = support.findIndex((v) => v <= 0);
  const fatal = collapsed >= 0 ? collapsed : support.findIndex((v) => v >= 100);
  if (fatal < 0) {
    nextCard(g);
    return g;
  }
  const kind = collapsed >= 0 ? "collapse" : "excess";
  const death = g.world.factions[fatal]![kind];
  g.endings.push({
    kind,
    faction: fatal,
    title: death.title,
    reason: death.reason,
    reign: g.reign.number,
    turns: g.reign.turn,
    year: g.totalTurns,
  });
  g.card = succession(support, fatal);
  return g;
}

export function abandon(game: Game): Game {
  if (game.phase !== "playing")
    throw new Error("This dynasty has already ended.");
  const g = structuredClone(game);
  g.endings.push({
    kind: "abandoned",
    faction: null,
    title: "The dynasty ends",
    reason: "You left office. Your chronicle is saved.",
    reign: g.reign.number,
    turns: g.reign.turn,
    year: g.totalTurns,
  });
  g.phase = "over";
  g.card = null;
  g.deck = [];
  g.version++;
  return g;
}

export function nextDraft(
  game: Game,
): { draft: Draft; commitmentId?: string } | null {
  const due = game.commitments.find((p) => p.due <= game.totalTurns);
  if (due)
    return {
      commitmentId: due.id,
      draft: {
        title: due.title,
        body: due.detail,
        character: due.character,
        kind: "major",
        options: [due.resolve, due.abandon].map((o) => ({
          ...o,
          legacy: null,
          promise: null,
        })),
      },
    };
  return game.deck[0] ? { draft: game.deck[0] } : null;
}

export function publicGame(game: Game, preparing = false): PublicGame {
  const { deck: _d, cost: _c, generations: _g, card, ...visible } = game;
  return {
    ...visible,
    preparing,
    card:
      card && card.kind !== "succession"
        ? {
            ...card,
            reactions: card.reactions.map((side) =>
              side.map((r) =>
                r.delta
                  ? {
                      size: Math.abs(r.delta) >= LARGE_REACTION ? "large" : "small",
                      uncertain: r.uncertain,
                    }
                  : null,
              ),
            ),
          }
        : card,
  };
}
