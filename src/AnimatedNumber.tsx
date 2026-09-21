import { useEffect, useRef } from "react";

export function AnimatedNumber({
  value,
  reducedMotion = false,
}: {
  value: number;
  reducedMotion?: boolean;
}) {
  const node = useRef<HTMLSpanElement>(null);
  const displayed = useRef(value);
  const initial = useRef(value);
  useEffect(() => {
    const element = node.current;
    if (!element) return;
    if (
      reducedMotion ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      element.textContent = String(value);
      displayed.current = value;
      return;
    }
    const from = displayed.current;
    const start = performance.now();
    let frame = 0;
    const tick = (time: number) => {
      const progress = Math.min(1, (time - start) / 650);
      displayed.current = Math.round(
        from + (value - from) * (1 - (1 - progress) ** 4),
      );
      element.textContent = String(displayed.current);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, reducedMotion]);
  return (
    <span ref={node} aria-hidden="true">
      {initial.current}
    </span>
  );
}
