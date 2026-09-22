import { Fragment, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { animate, m, stagger, useMotionValue, useTransform } from "motion/react";
import type { Side } from "../game";
import { DRAG, ENTER, FADE, SNAP, THROW, useReduced } from "../motion";
import { haptic, tick } from "../feedback";

export type Leaving = { side: Side; velocity: number };
export type CardView = {
  key: string;
  kind: string;
  label: string;
  style: CSSProperties;
  options: [string, string];
  face: ReactNode;
  back: ReactNode;
};
const clamp = (limit: number, value: number) => Math.max(-limit, Math.min(limit, value));
const sideOf = (x: number): Side | null => (Math.abs(x) < 12 ? null : x < 0 ? 0 : 1);

export function Words({ text }: { text: string }) {
  return text.split(/\s+/).map((word, i) => (
    <Fragment key={i}>
      {i > 0 && " "}
      <span className="w">{word}</span>
    </Fragment>
  ));
}

export function DecisionCard({
  view,
  preview,
  leaving,
  disabled,
  onPreview,
  onChoose,
  onGone,
}: {
  view: CardView;
  preview: Side | null;
  leaving: Leaving | null;
  disabled: boolean;
  onPreview: (side: Side | null) => void;
  onChoose: (side: Side, velocity: number) => boolean;
  onGone?: () => void;
}) {
  const reduced = useReduced();
  const node = useRef<HTMLElement>(null);
  const latest = useRef({ onPreview, onChoose, onGone });
  latest.current = { onPreview, onChoose, onGone };
  const x = useMotionValue(0);
  const drop = useMotionValue(0);
  const spin = useMotionValue(0);
  const scale = useMotionValue(1);
  const blur = useMotionValue(0);
  const flip = useMotionValue(0);
  const opacity = useMotionValue(1);
  const shown = useMotionValue(0);
  const rotate = useTransform(() => clamp(DRAG.maxRotate, x.get() / DRAG.rotateDiv) + spin.get());
  const rotateY = useTransform(x, (v) => (reduced ? 0 : clamp(DRAG.maxTilt, v / DRAG.tiltDiv)));
  const y = useTransform(() => drop.get() - Math.abs(x.get()) * DRAG.lift);
  const filter = useTransform(blur, (b) => (b > 0.05 ? `blur(${b}px)` : "none"));
  const parallax = useTransform(x, (v) => `${reduced ? 0 : -v * DRAG.parallax}px`);
  const answer = useTransform(() =>
    Math.max(shown.get(), Math.min(1, Math.max(0, (Math.abs(x.get()) - 12) / 70))),
  );
  const [side, setSide] = useState<Side | null>(null);
  const [ready, setReady] = useState(false);
  const drag = useRef<{ id: number; start: number; y: number; moved: boolean; crossed: boolean } | null>(null);
  const gone = useRef(false);

  useEffect(
    () =>
      x.on("change", (v) => {
        const next = sideOf(v);
        setSide((previous) => (previous === next ? previous : next));
        if (drag.current) latest.current.onPreview(next);
      }),
    [x],
  );

  useEffect(() => {
    let cancelled = false;
    const el = node.current!;
    void (async () => {
      if (reduced) {
        opacity.jump(0);
        await animate(opacity, 1, FADE);
      } else {
        drop.jump(ENTER.y);
        scale.jump(ENTER.scale);
        blur.jump(ENTER.blur);
        flip.jump(180);
        animate(blur, 0, { duration: 0.4 });
        animate(drop, 0, ENTER.spring);
        await animate(scale, 1, ENTER.spring);
        if (cancelled) return;
        await animate(flip, 0, ENTER.flip);
        if (cancelled || gone.current) return;
        const words = el.querySelectorAll(".w");
        if (words.length)
          animate(words, { opacity: [0, 1], y: [6, 0] }, { duration: ENTER.words.duration, delay: stagger(ENTER.words.gap) });
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    animate(shown, preview !== null && !drag.current ? 1 : 0, { duration: reduced ? 0 : 0.2 });
  }, [preview]);

  useEffect(() => {
    if (!leaving || gone.current) return;
    gone.current = true;
    drag.current = null;
    [x, drop, scale, blur, flip].forEach((v) => v.stop());
    flip.jump(0);
    blur.jump(0);
    scale.jump(1);
    setReady(true);
    const el = node.current!;
    void (async () => {
      if (reduced) await animate(opacity, 0, FADE);
      else {
        const dir = leaving.side ? 1 : -1;
        const target = dir * (innerWidth / 2 + el.offsetWidth * 1.2);
        await Promise.all([
          animate(x, target, { duration: THROW.duration, ease: THROW.ease }),
          animate(drop, THROW.drop, { duration: THROW.duration, ease: THROW.dropEase }),
          animate(spin, dir * THROW.rotate, { duration: THROW.duration, ease: "easeIn" }),
          animate(opacity, [1, 1, 0], { duration: THROW.duration }),
        ]);
      }
      latest.current.onGone?.();
    })();
  }, [leaving]);

  function release() {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    const el = node.current!;
    const offset = x.get();
    const velocity = x.getVelocity();
    const threshold = el.offsetWidth * DRAG.threshold;
    const flick =
      Math.abs(offset) > DRAG.flickDistance &&
      Math.abs(velocity) > DRAG.flickSpeed &&
      Math.sign(velocity) === Math.sign(offset);
    if (d.moved && (Math.abs(offset) >= threshold || flick) && latest.current.onChoose(offset < 0 ? 0 : 1, velocity))
      return;
    latest.current.onPreview(null);
    if (reduced) x.jump(0);
    else animate(x, 0, { ...SNAP, velocity });
  }
  useEffect(() => {
    const cancel = () => release();
    const hidden = () => document.hidden && release();
    window.addEventListener("blur", cancel);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("blur", cancel);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, []);

  const shownSide = side ?? preview;
  return (
    <m.article
      ref={node}
      className="card"
      data-kind={view.kind}
      data-ready={ready || undefined}
      tabIndex={leaving ? -1 : 0}
      aria-label={view.label}
      aria-describedby="controls-hint"
      aria-hidden={leaving ? true : undefined}
      style={{
        ...view.style,
        x,
        y,
        rotate,
        rotateY,
        scale,
        opacity,
        filter,
        transformPerspective: 1000,
        "--parallax": parallax,
        "--answer": answer,
      } as never}
      onPointerDown={(e) => {
        if (disabled || !ready || leaving || !e.isPrimary || e.button !== 0) return;
        x.stop();
        drag.current = { id: e.pointerId, start: e.clientX - x.get(), y: e.clientY, moved: false, crossed: false };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d || d.id !== e.pointerId) return;
        let offset = e.clientX - d.start;
        const vertical = Math.abs(e.clientY - d.y);
        if (!d.moved && vertical > 14 && vertical > Math.abs(offset)) return release();
        if (!d.moved && Math.abs(offset) < 4) return;
        d.moved = true;
        const threshold = e.currentTarget.offsetWidth * DRAG.threshold;
        if (Math.abs(offset) > threshold)
          offset = Math.sign(offset) * (threshold + (Math.abs(offset) - threshold) * DRAG.rubber);
        const crossed = Math.abs(offset) >= threshold;
        if (crossed !== d.crossed) {
          d.crossed = crossed;
          if (crossed) {
            haptic(8);
            tick(true);
          }
        }
        x.set(offset);
      }}
      onPointerUp={release}
      onPointerCancel={release}
    >
      <m.div className="card-flip" style={{ rotateY: flip }}>
        <div className="card-face card-front">
          <div className="answer" data-side={shownSide ?? undefined} aria-hidden="true">
            {shownSide !== null ? view.options[shownSide] : ""}
          </div>
          {view.face}
        </div>
        <div className="card-face card-back" aria-hidden="true">
          {view.back}
        </div>
      </m.div>
    </m.article>
  );
}
