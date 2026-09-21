import { z } from "zod";

const short = (max: number) => z.string().min(1).max(max);
export const factionSchema = z.object({
  name: short(32),
  description: short(160),
  priority: short(120),
  redLine: short(120),
});
export const worldSchema = z.object({
  name: short(70),
  era: short(120),
  role: short(70),
  summary: short(450),
  calendar: short(20),
  tone: z.enum(["earth", "mars", "night", "forest"]),
  factions: z.array(factionSchema).length(4),
  resources: z.array(short(28)).length(3),
  characters: z
    .array(
      z.object({
        name: short(40),
        role: short(50),
        faction: z.number().int().min(0).max(3),
        personality: short(120),
        appearance: short(400),
      }),
    )
    .length(6),
  artDirection: z.object({
    scene: short(700),
    palette: short(160),
    identity: short(300),
  }),
});
type GeneratedWorld = z.infer<typeof worldSchema>;
export type World = Omit<GeneratedWorld, "artDirection" | "characters"> & {
  artDirection?: GeneratedWorld["artDirection"];
  characters: (GeneratedWorld["characters"][number] & {
    portrait?: number | null;
  })[];
  art?: Record<string, string>;
};
const actionSchema = z.object({
  label: short(55),
  consequence: short(180),
});
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
  body: short(320),
  character: z.number().int().min(0).max(5),
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
  action: string;
  consequence: string;
  deltas: number[];
};
export type Ending = {
  kind: "fall" | "retired" | "term";
  title: string;
  reason: string;
  turn: number;
  ruler: string;
};
export type Reign = {
  number: number;
  ruler: string;
  turn: number;
  support: number[];
  ended: Ending | null;
};
export type Game = {
  id: string;
  prompt: string;
  world: World;
  version: number;
  totalTurns: number;
  reign: Reign;
  card: Card | null;
  deck: Card[];
  commitments: Commitment[];
  legacies: string[];
  history: Event[];
  endings: Ending[];
  phase: "intro" | "playing";
  cost: number;
  generations: number;
};
export type PublicGame = Omit<Game, "deck" | "cost" | "generations"> & {
  preparing: boolean;
  nextPortrait?: string;
};
export function freshGame(id: string, prompt: string, world: World): Game {
  return {
    id,
    prompt,
    world,
    version: 0,
    totalTurns: 0,
    reign: {
      number: 1,
      ruler: world.role,
      turn: 0,
      support: [50, 50, 50, 50],
      ended: null,
    },
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
function end(game: Game, kind: Ending["kind"], title: string, reason: string) {
  const ending = {
    kind,
    title,
    reason,
    turn: game.reign.turn,
    ruler: game.reign.ruler,
  };
  game.reign.ended = ending;
  game.endings.push(ending);
  game.card = null;
  game.deck = [];
}

export function play(game: Game, cardId: string, side: Side): Game {
  if (
    game.phase !== "playing" ||
    game.reign.ended ||
    !game.card ||
    game.card.id !== cardId ||
    (side !== 0 && side !== 1)
  )
    throw new Error("This decision has already passed. Refresh your society.");
  const g = structuredClone(game);
  const card = g.card!;
  const option = card.options[side]!;
  const deltas = card.reactions[side]!.map((r) => r.delta);
  const raw = g.reign.support.map((n, i) => n + deltas[i]!);
  g.reign.support = raw.map((n) => Math.max(0, Math.min(100, n)));
  g.totalTurns++;
  g.reign.turn++;
  g.version++;
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
    action: option.label,
    consequence: option.consequence,
    deltas: g.reign.support.map((value, i) => value - game.reign.support[i]!),
  });
  g.history = g.history.slice(-180);
  g.card = null;
  const fallen = raw
    .map((n, i) => ({ n, i }))
    .filter((f) => f.n <= 0)
    .sort((a, b) => a.n - b.n || a.i - b.i);
  if (fallen.length) {
    const names = fallen.map((f) => g.world.factions[f.i]!.name).join(" and ");
    end(
      g,
      "fall",
      [
        "Removed from office",
        "Forced to resign",
        "A general strike",
        "The council withdraws its support",
      ][fallen[0]!.i]!,
      `${names} withdrew their support. ${option.consequence}`,
    );
  } else if (!nextDraft(g)?.commitmentId) {
    g.card = g.deck.shift() ?? null;
  }
  return g;
}

export function succeed(game: Game, coalition: 0 | 1): Game {
  if (!game.reign.ended)
    throw new Error("This chronicle is complete. Begin another society.");
  const g = structuredClone(game);
  g.reign = {
    number: g.reign.number + 1,
    ruler:
      coalition === 0
        ? `The ${g.world.factions[0]!.name} candidate`
        : `The ${g.world.factions[2]!.name} candidate`,
    turn: 0,
    support: coalition === 0 ? [65, 40, 40, 55] : [40, 55, 65, 40],
    ended: null,
  };
  g.version++;
  g.card = null;
  g.deck = [];
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
  const {
    deck: _deck,
    cost: _cost,
    generations: _generations,
    ...visible
  } = game;
  return {
    ...visible,
    preparing,
    nextPortrait: game.deck[0]
      ? game.world.art?.[`portrait-${game.deck[0].character}`]
      : undefined,
  };
}
