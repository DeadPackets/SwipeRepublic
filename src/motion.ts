import { createContext, useContext } from "react";

export const ReducedMotion = createContext(false);
export const useReduced = () => useContext(ReducedMotion);

const settle = [0.16, 1, 0.3, 1] as const;
export const FADE = { duration: 0.12 };
export const DRAG = {
  rotateDiv: 16,
  maxRotate: 9,
  tiltDiv: 12,
  maxTilt: 16,
  lift: 0.03,
  parallax: 0.05,
  threshold: 0.26,
  rubber: 0.5,
  flickDistance: 30,
  flickSpeed: 800,
  keySpeed: 1200,
};
export const SNAP = { type: "spring", stiffness: 240, damping: 16 } as const;
export const THROW = {
  duration: 0.62,
  ease: [0.5, 0, 0.3, 1] as const,
  drop: 60,
  dropEase: [0.55, 0, 1, 0.45] as const,
  rotate: 24,
};
export const ENTER = {
  y: 34,
  scale: 0.9,
  blur: 6,
  spring: { type: "spring", stiffness: 160, damping: 18 } as const,
  flip: { duration: 0.55, ease: [0.4, 0, 0.2, 1] as const },
  words: { duration: 0.35, gap: 0.018 },
};
export const DOT = { duration: 0.55, ease: settle };
export const METER = {
  spring: { type: "spring", stiffness: 120, damping: 12 } as const,
  gap: 0.09,
  flash: 0.9,
  shake: 0.36,
  edgeLow: 15,
  edgeHigh: 85,
};
export const MOURN = { flare: { duration: 1.4, ease: settle }, hold: 500 };
export const SCREEN = { duration: 0.5, ease: settle, y: 12, blur: 4 };
export const DIALOG = {
  spring: { type: "spring", stiffness: 300, damping: 26 } as const,
  slide: 24,
};
export const STAGGER = 0.06;
export const TOAST = { spring: { type: "spring", stiffness: 400, damping: 24 } as const, hold: 1600 };
export const MILESTONES = [5, 10, 20, 40, 60, 100];

export function screenMotion(reduced: boolean) {
  return reduced
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: FADE }
    : {
        initial: { opacity: 0, y: SCREEN.y, filter: `blur(${SCREEN.blur}px)` },
        animate: { opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } },
        exit: { opacity: 0, y: -SCREEN.y / 2, filter: `blur(${SCREEN.blur}px)` },
        transition: { duration: SCREEN.duration, ease: SCREEN.ease },
      };
}
export function staggerMotion(reduced: boolean, index: number) {
  return reduced
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: FADE }
    : {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.45, ease: SCREEN.ease, delay: 0.1 + index * STAGGER },
      };
}
