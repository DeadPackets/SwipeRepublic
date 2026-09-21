import { generateWorld, generateCards } from "../worker/ai";
import { freshGame } from "../src/game";
const key = process.env.OPENROUTER_API_KEY!;
const prompt =
  process.argv[2] ??
  "Future 1 AE Mars colony. Fragile independence, dry humor.";
const t = Date.now();
const world = await generateWorld(key, prompt);
const g = freshGame(crypto.randomUUID(), prompt, world.value);
g.phase = "playing";
const cards = await generateCards(key, g);
await Bun.write(
  "artifacts/chapter.json",
  JSON.stringify({ world: world.value, cards: cards.value }, null, 2),
);
console.log(
  JSON.stringify({
    totalMs: Date.now() - t,
    worldCost: world.cost,
    chapterCost: cards.cost,
    cardTitles: cards.value.map((c) => c.title),
    costPerCard: cards.cost / cards.value.length,
  }),
);
