import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import type { Side } from "./game";
import { HoldGesture } from "./holdGesture";

export function useArrowHold({
  enabled,
  cardId,
  surface,
  onSelect,
  onChoose,
}: {
  enabled: boolean;
  cardId?: string;
  surface: RefObject<HTMLElement | null>;
  onSelect: (side: Side | null) => void;
  onChoose: (side: Side) => void;
}) {
  const latest = useRef({ enabled, onSelect, onChoose });
  latest.current = { enabled, onSelect, onChoose };
  const gesture = useRef(new HoldGesture());
  const frame = useRef(0);
  function paint() {
    const node = surface.current;
    if (!node) return;
    const side = gesture.current.side;
    if (side === null) delete node.dataset.holding;
    else node.dataset.holding = String(side);
    node.style.setProperty(
      "--hold-progress",
      String(gesture.current.progress(performance.now())),
    );
  }
  function cancel(clearKeys = false) {
    const hadHold = gesture.current.side !== null;
    gesture.current.cancel(clearKeys);
    cancelAnimationFrame(frame.current);
    paint();
    if (hadHold) latest.current.onSelect(null);
  }
  useEffect(() => {
    cancel();
  }, [enabled, cardId]);
  useEffect(() => {
    function tick(now: number) {
      if (!latest.current.enabled || document.hidden) {
        cancel();
        return;
      }
      paint();
      const side = gesture.current.finish(now);
      if (side !== null) {
        paint();
        latest.current.onChoose(side);
        return;
      }
      if (gesture.current.side !== null)
        frame.current = requestAnimationFrame(tick);
    }
    function down(event: KeyboardEvent) {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (
        target?.closest(".choices button") &&
        (event.key === "Enter" || event.key === " ")
      ) {
        event.preventDefault();
        cancel();
        return;
      }
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
        cancel();
        return;
      }
      if (
        document.querySelector("dialog[open]") ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.shiftKey ||
        target?.closest(
          "input,textarea,select,[contenteditable]:not([contenteditable='false']),[role='textbox']",
        )
      )
        return;
      if (!latest.current.enabled && gesture.current.side === null) {
        gesture.current.down(
          event.key === "ArrowLeft" ? 0 : 1,
          event.repeat,
          performance.now(),
          false,
        );
        return;
      }
      event.preventDefault();
      gesture.current.down(
        event.key === "ArrowLeft" ? 0 : 1,
        event.repeat,
        performance.now(),
        latest.current.enabled,
      );
      cancelAnimationFrame(frame.current);
      latest.current.onSelect(gesture.current.side);
      paint();
      if (gesture.current.side !== null)
        frame.current = requestAnimationFrame(tick);
    }
    function up(event: KeyboardEvent) {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const before = gesture.current.side;
      gesture.current.up(event.key === "ArrowLeft" ? 0 : 1);
      if (before !== null && gesture.current.side === null) {
        cancelAnimationFrame(frame.current);
        latest.current.onSelect(null);
      }
      paint();
    }
    const blur = () => cancel(true);
    const pointer = () => cancel();
    const visibility = () => {
      if (document.hidden) cancel(true);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    window.addEventListener("pointerdown", pointer, true);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      cancelAnimationFrame(frame.current);
      gesture.current.cancel(true);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      window.removeEventListener("pointerdown", pointer, true);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  return { cancel, holding: () => gesture.current.side !== null };
}
