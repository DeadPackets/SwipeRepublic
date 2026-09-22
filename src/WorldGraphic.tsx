import { memo, useLayoutEffect, useRef } from "react";
import type { CSSProperties } from "react";
import type { Graphic, World } from "./game";

export const WorldGraphic = memo(function WorldGraphic({
  graphic,
  className = "",
  fit = false,
}: {
  graphic: Graphic;
  className?: string;
  fit?: boolean;
}) {
  const ref = useRef<SVGSVGElement>(null);
  useLayoutEffect(() => {
    const svg = ref.current;
    if (!svg || !fit) return;
    const bounds = svg.getBBox();
    const size = Math.max(bounds.width, bounds.height) * 1.1;
    if (!Number.isFinite(size) || size <= 0) return;
    svg.setAttribute(
      "viewBox",
      `${bounds.x + (bounds.width - size) / 2} ${bounds.y + (bounds.height - size) / 2} ${size} ${size}`,
    );
  }, [graphic, fit]);
  return (
    <svg
      ref={ref}
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
    <WorldGraphic graphic={faction.symbol} fit />
  ) : (
    <span className="faction-monogram" aria-hidden="true">
      {faction.name.slice(0, 1)}
    </span>
  );
}
