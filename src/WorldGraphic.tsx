import { memo, useLayoutEffect, useRef } from "react";
import type { CSSProperties } from "react";
import type { Faction, Graphic } from "./game";

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
    <svg ref={ref} className={`world-graphic ${className}`} viewBox="0 0 100 100" aria-hidden="true">
      {graphic.map((shape, i) => (
        <path key={i} d={shape.d} fill={shape.fill} />
      ))}
    </svg>
  );
});

export function factionStyle(faction: Faction): CSSProperties {
  const rgb = [1, 3, 5].map((i) => parseInt(faction.color.slice(i, i + 2), 16));
  return {
    "--faction": faction.color,
    "--paper": `rgb(${rgb.map((n) => Math.round(n * 0.18 + 240 * 0.82)).join(" ")})`,
    "--faction-ink": `rgb(${rgb.map((n) => Math.min(n, 110)).join(" ")})`,
  } as CSSProperties;
}
export function FactionIcon({ faction, className }: { faction: Faction; className?: string }) {
  return <WorldGraphic graphic={faction.symbol} className={className} fit />;
}
