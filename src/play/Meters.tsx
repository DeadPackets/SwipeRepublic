import { useEffect, useRef } from "react";
import { animate, m, useMotionValue, useTransform } from "motion/react";
import type { Event, Faction, PublicReaction } from "../game";
import { FactionIcon, factionStyle } from "../WorldGraphic";
import { DOT, FADE, METER, MOURN, useReduced } from "../motion";
import { haptic, tick } from "../feedback";

function Meter({
  faction,
  index,
  value,
  reaction,
  delta,
  hit,
  fatal,
  flare,
  onOpen,
}: {
  faction: Faction;
  index: number;
  value: number;
  reaction: PublicReaction | undefined;
  delta: number;
  hit: number;
  fatal: boolean;
  flare: boolean;
  onOpen: () => void;
}) {
  const reduced = useReduced();
  const level = useMotionValue(value);
  const fill = useTransform(level, (v) => Math.max(0, Math.min(100, v)) / 100);
  const icon = useRef<HTMLSpanElement>(null);
  const arrow = useRef<HTMLSpanElement>(null);
  const first = useRef(true);

  useEffect(() => {
    if (reduced) level.jump(value);
    else animate(level, value, { ...METER.spring, delay: index * METER.gap });
  }, [value]);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!delta) return;
    const el = icon.current!;
    const up = delta > 0;
    const wait = setTimeout(
      () => {
        tick(up);
        if (reduced) {
          animate(arrow.current!, { opacity: [1, 0] }, { duration: 0.6 });
          return;
        }
        animate(arrow.current!, { opacity: [0, 1, 0], y: [4, -8, -16] }, { duration: METER.flash, ease: "easeOut" });
        animate(el, { color: [up ? "#c4d0ad" : "#efac9c", getComputedStyle(el).color] }, { duration: METER.flash }).then(
          () => el.style.removeProperty("color"),
        );
        if (Math.abs(delta) >= 10) {
          haptic(20);
          animate(el, { x: [0, -5, 5, -3, 3, 0], scale: [1, 1.14, 1] }, { duration: METER.shake });
        } else animate(el, { scale: [1, 1.08, 1] }, { duration: 0.35 });
      },
      reduced ? 0 : index * METER.gap * 1000,
    );
    return () => clearTimeout(wait);
  }, [hit]);

  useEffect(() => {
    if (!flare || !icon.current) return;
    if (reduced) animate(icon.current, { opacity: [0.4, 1] }, FADE);
    else animate(icon.current, { scale: [1, 1.6, 1.25] }, MOURN.flare);
  }, [flare]);

  const edge = value < METER.edgeLow || value > METER.edgeHigh;
  const size = reaction ? reaction.size : null;
  return (
    <m.button
      className="meter"
      data-edge={edge || undefined}
      data-fatal={fatal || undefined}
      style={{ ...factionStyle(faction), "--fill": fill } as never}
      onClick={onOpen}
      aria-haspopup="dialog"
      aria-label={`${faction.name}: ${value} of 100${size ? `. Reacts ${reaction!.uncertain ? "uncertainly, " : ""}${size === "large" ? "strongly" : "a little"}` : ""}`}
    >
      <span className="meter-dot-row" aria-hidden="true">
        <m.span
          className="meter-dot"
          data-size={size ?? undefined}
          data-uncertain={reaction?.uncertain || undefined}
          initial={false}
          animate={{ scale: size ? 1 : 0, opacity: size ? 1 : 0 }}
          transition={reduced ? FADE : size ? DOT : { duration: 0.15 }}
        />
        <span ref={arrow} className="meter-arrow" data-up={delta > 0 || undefined}>
          {delta > 0 ? "▲" : "▼"}
        </span>
      </span>
      <span ref={icon} className="meter-icon" aria-hidden="true">
        <FactionIcon faction={faction} className="meter-base" />
        <FactionIcon faction={faction} className="meter-fill" />
      </span>
      <span className="meter-label">{faction.label}</span>
    </m.button>
  );
}

export function Meters({
  factions,
  support,
  reactions,
  last,
  hit,
  fatal,
  flare,
  onOpen,
}: {
  factions: Faction[];
  support: number[];
  reactions: PublicReaction[] | null;
  last: Event | undefined;
  hit: number;
  fatal: number | null;
  flare: boolean;
  onOpen: (index: number) => void;
}) {
  return (
    <div className="meters" role="group" aria-label="Faction support">
      {factions.map((faction, i) => (
        <Meter
          key={i}
          faction={faction}
          index={i}
          value={support[i]!}
          reaction={reactions?.[i] ?? undefined}
          delta={last?.deltas[i] ?? 0}
          hit={hit}
          fatal={fatal === i}
          flare={flare && fatal === i}
          onOpen={() => onOpen(i)}
        />
      ))}
    </div>
  );
}
