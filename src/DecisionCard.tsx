import { useRef } from "react";
import type { Card, Side, World } from "./game";
import { Portrait } from "./Portrait";

type Props = {
  card: Card;
  character: World["characters"][number];
  tone: World["tone"];
  selected: Side | null;
  working: boolean;
  leaving: Side | null;
  onSelect: (side: Side | null) => void;
  onChoose: (side: Side) => void;
};

export function DecisionCard({
  card,
  character,
  tone,
  selected,
  working,
  leaving,
  onSelect,
  onChoose,
}: Props) {
  const pointer = useRef<{
    x: number;
    y: number;
    id: number;
    side: Side | null;
  } | null>(null);
  const node = useRef<HTMLElement>(null);
  function reset() {
    pointer.current = null;
    node.current?.style.removeProperty("--drag-x");
    node.current?.style.removeProperty("--drag-rotation");
    node.current?.removeAttribute("data-dragging");
  }
  return (
    <div className="card-arrival" key={card.id}>
      <article
        ref={node}
        className={`decision-card ${selected !== null ? "previewing" : ""} ${leaving !== null ? `leaving leaving-${leaving}` : ""}`}
        data-side={selected ?? undefined}
        aria-busy={working}
        onPointerDown={(event) => {
          if (
            working ||
            leaving !== null ||
            !event.isPrimary ||
            event.button !== 0 ||
            (event.target as HTMLElement).closest("button")
          )
            return;
          pointer.current = {
            x: event.clientX,
            y: event.clientY,
            id: event.pointerId,
            side: null,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const start = pointer.current;
          if (!start || start.id !== event.pointerId) return;
          const x = event.clientX - start.x;
          const y = event.clientY - start.y;
          if (Math.abs(y) > 18 && Math.abs(y) > Math.abs(x)) {
            reset();
            onSelect(null);
            return;
          }
          if (Math.abs(x) < 8) return;
          event.currentTarget.dataset.dragging = "true";
          const offset = Math.max(-150, Math.min(150, x));
          event.currentTarget.style.setProperty("--drag-x", `${offset}px`);
          event.currentTarget.style.setProperty(
            "--drag-rotation",
            `${offset / 28}deg`,
          );
          const side: Side = x < 0 ? 0 : 1;
          if (start.side !== side) {
            start.side = side;
            onSelect(side);
          }
        }}
        onPointerUp={(event) => {
          const start = pointer.current;
          reset();
          if (!start || start.id !== event.pointerId) return;
          const x = event.clientX - start.x;
          const y = event.clientY - start.y;
          if (Math.abs(x) > 85 && Math.abs(x) > Math.abs(y))
            onChoose(x < 0 ? 0 : 1);
        }}
        onPointerCancel={() => {
          reset();
          onSelect(null);
        }}
        onLostPointerCapture={reset}
      >
        <div className="portrait-wrap">
          <Portrait
            character={card.character}
            tone={tone}
            appearance={character.appearance}
            portrait={character.portrait}
          />
          <div className="portrait-shade" />
          {(card.commitmentId || card.kind === "major") && (
            <span className="card-classification">
              {card.commitmentId ? "Promise due" : "Major crisis"}
            </span>
          )}
          <div className="speaker">
            <span>{character.name}</span>
            <span>{character.role}</span>
          </div>
        </div>
        <div className="card-body">
          <h1 className="sr-only">{card.title}</h1>
          <p
            className={`dilemma ${card.body.length > 220 ? "long-dilemma" : ""}`}
          >
            {card.body}
          </p>
        </div>
        <div className="choices">
          {card.options.map((option, i) => (
            <button
              key={i}
              disabled={working || leaving !== null}
              data-selected={selected === i}
              onPointerEnter={(event) => {
                if (event.pointerType === "mouse") onSelect(i as Side);
              }}
              onPointerLeave={(event) => {
                if (document.activeElement !== event.currentTarget)
                  onSelect(null);
              }}
              onFocus={() => onSelect(i as Side)}
              onBlur={() => onSelect(null)}
              onClick={() => onChoose(i as Side)}
            >
              <span aria-hidden="true">{i === 0 ? "←" : "→"}</span>
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      </article>
    </div>
  );
}
