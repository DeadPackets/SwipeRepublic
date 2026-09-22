import { useEffect, useLayoutEffect, useRef } from "react";
import type { Card, Side, World } from "./game";
import { Portrait } from "./Portrait";
import { FactionIcon, factionStyle } from "./WorldGraphic";

export const SWIPE_MS = 620;
type Props = {
  image?: string;
  card: Card;
  character: World["characters"][number];
  faction: World["factions"][number];
  calendar: string;
  turn: number;
  selected: Side | null;
  working: boolean;
  leaving: Side | null;
  reducedMotion: boolean;
  onSelect: (side: Side | null) => void;
  onChoose: (side: Side) => void;
};
export function DecisionCard({
  card,
  image,
  character,
  faction,
  calendar,
  turn,
  selected,
  working,
  leaving,
  reducedMotion,
  onSelect,
  onChoose,
}: Props) {
  const node = useRef<HTMLElement>(null);
  const pointer = useRef<{
    id: number;
    startX: number;
    y: number;
    lastX: number;
    time: number;
    velocity: number;
    moved: boolean;
  } | null>(null);
  const frame = useRef(0),
    offset = useRef(0),
    rotation = useRef(0);
  const motion = useRef<Animation | null>(null);
  const committed = useRef(false);
  function takeOver() {
    if (!motion.current || !node.current) return;
    const matrix = new DOMMatrixReadOnly(
      getComputedStyle(node.current).transform,
    );
    offset.current = matrix.m41;
    rotation.current = (Math.atan2(matrix.m12, matrix.m11) * 180) / Math.PI;
    motion.current.cancel();
    motion.current = null;
    node.current.style.transform = `translate3d(${offset.current}px,0,0) rotate(${rotation.current}deg)`;
  }
  function paint() {
    frame.current = 0;
    rotation.current = Math.max(-4, Math.min(4, offset.current / 65));
    if (node.current)
      node.current.style.transform = `translate3d(${offset.current}px,0,0) rotate(${rotation.current}deg)`;
  }
  function settle() {
    cancelAnimationFrame(frame.current);
    frame.current = 0;
    pointer.current = null;
    const el = node.current;
    if (!el || committed.current) return;
    const transform = getComputedStyle(el).transform;
    motion.current?.cancel();
    el.style.transform = "";
    if (!reducedMotion && offset.current)
      motion.current = el.animate(
        [{ transform }, { transform: "translate3d(0,0,0) rotate(0deg)" }],
        { duration: 360, easing: "cubic-bezier(.22,1,.36,1)" },
      );
    offset.current = 0;
    rotation.current = 0;
    onSelect(null);
  }
  useLayoutEffect(() => {
    if (!node.current) return;
    if (leaving === null) {
      if (committed.current) {
        motion.current?.cancel();
        node.current.style.transform = "";
        offset.current = 0;
        rotation.current = 0;
        node.current.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: reducedMotion ? 0 : 300,
        });
      }
      committed.current = false;
      return;
    }
    committed.current = true;
    cancelAnimationFrame(frame.current);
    pointer.current = null;
    takeOver();
    const el = node.current,
      direction = leaving === 0 ? -1 : 1;
    const from = getComputedStyle(el).transform;
    const travel = Math.max(
      innerWidth / 2 + el.getBoundingClientRect().width,
      Math.abs(offset.current) + el.clientWidth,
    );
    motion.current = el.animate(
      reducedMotion
        ? [{ opacity: 1 }, { opacity: 0 }]
        : [
            { transform: from, opacity: 1, offset: 0 },
            {
              transform: `translate3d(${direction * travel * 0.58}px,-8px,0) rotate(${direction * 8}deg)`,
              opacity: 0.9,
              offset: 0.65,
            },
            {
              transform: `translate3d(${direction * travel}px,-18px,0) rotate(${direction * 12}deg)`,
              opacity: 0,
              offset: 1,
            },
          ],
      {
        duration: reducedMotion ? 120 : SWIPE_MS,
        easing: "cubic-bezier(.32,0,.18,1)",
        fill: "forwards",
      },
    );
  }, [leaving]);
  useEffect(() => {
    if (reducedMotion) motion.current?.finish();
  }, [reducedMotion]);
  useEffect(() => {
    const blur = () => {
      if (pointer.current) settle();
    };
    const hidden = () => {
      if (document.hidden) blur();
    };
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      cancelAnimationFrame(frame.current);
      motion.current?.cancel();
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, []);
  const side = leaving ?? selected;
  return (
    <div
      className={`card-arrival ${leaving !== null ? "outgoing-card" : ""}`}
      aria-hidden={leaving !== null || undefined}
      inert={leaving !== null || undefined}
    >
      <article
        ref={node}
        className={`decision-card ${side !== null ? "previewing" : ""}`}
        style={factionStyle(faction, character.faction)}
        data-side={side ?? undefined}
        aria-busy={working}
        onPointerDown={(event) => {
          if (
            working ||
            leaving !== null ||
            !event.isPrimary ||
            event.button !== 0
          )
            return;
          takeOver();
          pointer.current = {
            id: event.pointerId,
            startX: event.clientX - offset.current,
            y: event.clientY,
            lastX: event.clientX,
            time: event.timeStamp,
            velocity: 0,
            moved: false,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const start = pointer.current;
          if (!start || start.id !== event.pointerId) return;
          const x = event.clientX - start.startX,
            y = event.clientY - start.y;
          if (!start.moved && Math.abs(y) > 14 && Math.abs(y) > Math.abs(x)) {
            settle();
            return;
          }
          if (Math.abs(x) < 5 && !start.moved) return;
          start.moved = true;
          start.velocity =
            (event.clientX - start.lastX) /
            Math.max(1, event.timeStamp - start.time);
          start.lastX = event.clientX;
          start.time = event.timeStamp;
          offset.current = x;
          if (!frame.current) frame.current = requestAnimationFrame(paint);
          const next = Math.abs(x) < 10 ? null : x < 0 ? 0 : 1;
          if (next !== selected) onSelect(next);
        }}
        onPointerUp={(event) => {
          const start = pointer.current;
          if (!start || start.id !== event.pointerId) return;
          const x = event.clientX - start.startX,
            velocity = event.timeStamp - start.time < 90 ? start.velocity : 0;
          const threshold = Math.min(
            92,
            event.currentTarget.clientWidth * 0.25,
          );
          if (
            start.moved &&
            (Math.abs(x) > threshold ||
              (Math.abs(x) > 28 &&
                Math.abs(velocity) > 0.55 &&
                Math.sign(x) === Math.sign(velocity)))
          ) {
            pointer.current = null;
            cancelAnimationFrame(frame.current);
            offset.current = x;
            paint();
            committed.current = true;
            onChoose(x < 0 ? 0 : 1);
          } else settle();
        }}
        onPointerCancel={settle}
        onLostPointerCapture={() => {
          if (pointer.current) settle();
        }}
      >
        <div className="answer-wash" aria-hidden="true" />
        <div className="on-card-answer" aria-hidden="true">
          {side !== null ? card.options[side]?.label : ""}
        </div>
        <div className="card-mark">
          <span>
            {calendar} {turn}
          </span>
          <span>
            {card.commitmentId
              ? "Promise due"
              : card.kind === "major"
                ? "Major crisis"
                : ""}
          </span>
        </div>
        <h1 className="dilemma">{card.body}</h1>
        <div className="speaker">
          <div className="speaker-info">
            <strong>{character.name}</strong>
            <span>{character.role}</span>
            <small>
              <FactionIcon faction={faction} />
              {faction.label ?? faction.name}
            </small>
          </div>
          <Portrait character={character} image={image} />
        </div>
        <div className="card-edge" aria-hidden="true" />
      </article>
      <div className="choices">
        {card.options.map((option, i) => (
          <button
            key={i}
            disabled={working || leaving !== null}
            data-selected={side === i}
            aria-pressed={side === i}
            aria-keyshortcuts={i === 0 ? "ArrowLeft" : "ArrowRight"}
            aria-describedby="decision-controls"
            onPointerEnter={(e) => {
              if (e.pointerType === "mouse") onSelect(i as Side);
            }}
            onPointerLeave={(e) => {
              if (document.activeElement !== e.currentTarget) onSelect(null);
            }}
            onFocus={() => onSelect(i as Side)}
            onBlur={() => onSelect(null)}
            onClick={() => onChoose(i as Side)}
          >
            {i === 0 && <span aria-hidden="true">←</span>}
            <span>{option.label}</span>
            {i === 1 && <span aria-hidden="true">→</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
