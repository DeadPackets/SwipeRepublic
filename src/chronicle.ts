import type { PublicGame } from "./game";

export function chronicleText(game: PublicGame) {
  const { world } = game;
  return [
    `SWIPE REPUBLIC: ${world.name}`,
    world.era,
    world.summary,
    "",
    "The rulers",
    ...game.endings.map(
      (e) => `${world.role} ${e.reign}, ${e.turns} decisions, fell in ${world.calendar} ${e.year}: ${e.title}. ${e.reason}`,
    ),
    "",
    "The chronicle",
    ...game.history.map(
      (e) =>
        `\n${world.calendar} ${e.turn} · Reign ${e.reign} · ${e.title}\n${e.action}\n${e.consequence}\n${world.factions
          .map((f, i) => `${f.name}: ${e.deltas[i]! > 0 ? "+" : ""}${e.deltas[i]}`)
          .join(" / ")}`,
    ),
    "",
    "What remains",
    ...game.legacies,
  ].join("\n");
}
export function downloadChronicle(game: PublicGame) {
  const url = URL.createObjectURL(new Blob([chronicleText(game)], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `swipe-republic-${game.id.slice(0, 8)}.txt`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
