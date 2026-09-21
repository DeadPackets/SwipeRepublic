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
        appearance: z.enum([
          "human",
          "fox",
          "bird",
          "deer",
          "bear",
          "beaver",
          "robot",
          "alien",
        ]),
      }),
    )
    .length(6),
  ambitions: z
    .array(z.object({ name: short(50), description: short(160) }))
    .length(2),
});
export type World = z.infer<typeof worldSchema>;
const actionSchema = z.object({
  label: short(55),
  consequence: short(180),
  advances: z.boolean(),
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
  ambition: number;
};
export type Event = {
  turn: number;
  reign: number;
  title: string;
  action: string;
  consequence: string;
  deltas: number[];
  advanced: boolean;
};
export type Ending = {
  kind: "fall" | "retired" | "term";
  title: string;
  reason: string;
  turn: number;
  ambition: string;
  progress: number;
  ruler: string;
};
export type Reign = {
  number: number;
  ruler: string;
  turn: number;
  ambition: number;
  progress: number;
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
};
export const MAX_TURNS = 36;
export const AMBITION_TARGET = 6;
export const RETIRE_TURN = 24;
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
      ambition: 0,
      progress: 0,
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
    ambition: game.world.ambitions[game.reign.ambition]!.name,
    progress: game.reign.progress,
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
  g.reign.progress = Math.min(
    AMBITION_TARGET,
    g.reign.progress + Number(option.advances),
  );
  if (card.commitmentId)
    g.commitments = g.commitments.filter((p) => p.id !== card.commitmentId);
  if (option.promise && g.commitments.length < 3)
    g.commitments.push({
      ...option.promise,
      id: crypto.randomUUID(),
      due: g.totalTurns + option.promise.after,
      character: card.character,
      source: card.title,
      ambition: g.reign.ambition,
    });
  if (option.legacy && !g.legacies.includes(option.legacy))
    g.legacies = [...g.legacies, option.legacy].slice(-3);
  g.history.push({
    turn: g.totalTurns,
    reign: g.reign.number,
    title: card.title,
    action: option.label,
    consequence: option.consequence,
    deltas,
    advanced: option.advances,
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
  } else if (g.reign.turn >= MAX_TURNS) {
    end(
      g,
      "term",
      g.reign.progress >= AMBITION_TARGET
        ? "A successful term"
        : "Your term has ended",
      g.reign.progress >= AMBITION_TARGET
        ? "You completed your ambition. The next ruler inherits your laws and unfinished promises."
        : "You left office before completing your ambition. Your successor will take over.",
    );
  }
  return g;
}

export function succeed(game: Game, coalition: 0 | 1, ambition: 0 | 1): Game {
  if (!game.reign.ended || game.reign.number >= 5)
    throw new Error("This chronicle is complete. Begin another society.");
  const g = structuredClone(game);
  g.reign = {
    number: g.reign.number + 1,
    ruler:
      coalition === 0
        ? `The ${g.world.factions[0]!.name} candidate`
        : `The ${g.world.factions[2]!.name} candidate`,
    turn: 0,
    ambition,
    progress: 0,
    support: coalition === 0 ? [65, 40, 40, 55] : [40, 55, 65, 40],
    ended: null,
  };
  g.version++;
  g.card = null;
  g.deck = [];
  return g;
}

export function retire(game: Game): Game {
  if (
    game.reign.ended ||
    game.reign.turn < RETIRE_TURN ||
    game.reign.progress < AMBITION_TARGET
  )
    throw new Error(
      "Complete your ambition and govern for 24 decisions before retiring.",
    );
  const g = structuredClone(game);
  g.version++;
  end(
    g,
    "retired",
    "A peaceful handover",
    "You completed your ambition and handed over power. Your laws and unfinished promises remain.",
  );
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
        body: `${due.detail} Your promise from “${due.source}” comes due today.`,
        character: due.character,
        kind: "major",
        options: [due.resolve, due.abandon].map((o) => ({
          ...o,
          advances: o.advances && due.ambition === game.reign.ambition,
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
  return { ...visible, preparing };
}
