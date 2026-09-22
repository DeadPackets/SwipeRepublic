import { memo } from "react";
import type { CSSProperties } from "react";
import type { Graphic, World } from "./game";

export const WorldGraphic = memo(function WorldGraphic({
  graphic,
  className = "",
}: {
  graphic: Graphic;
  className?: string;
}) {
  return (
    <svg
      className={`world-graphic ${className}`}
      viewBox="0 0 100 100"
      aria-hidden="true"
    >
      {graphic.map((shape, i) =>
        "d" in shape ? (
          <path key={i} d={shape.d} fill={shape.fill} />
        ) : (
          <polygon
            key={i}
            points={shape.points.map((p) => p.join(",")).join(" ")}
            fill={shape.fill}
          />
        ),
      )}
    </svg>
  );
});
const fallback = ["#67502d", "#793f36", "#39575d", "#485b38"];
export function factionStyle(
  faction: World["factions"][number],
  index: number,
): CSSProperties {
  const hex =
    faction.color && /^#[0-9a-f]{6}$/i.test(faction.color)
      ? faction.color
      : fallback[index % 4]!;
  const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return {
    "--paper": `rgb(${rgb.map((n) => Math.round(n * 0.18 + 240 * 0.82)).join(" ")})`,
    "--faction-ink": `rgb(${rgb.map((n) => Math.min(n, 110)).join(" ")})`,
  } as CSSProperties;
}
export function FactionIcon({
  faction,
}: {
  faction: World["factions"][number];
}) {
  return faction.symbol ? (
    <WorldGraphic graphic={faction.symbol} />
  ) : (
    <span className="faction-monogram" aria-hidden="true">
      {faction.name.slice(0, 1)}
    </span>
  );
}
