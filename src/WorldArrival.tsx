import { useEffect, useRef, useState } from "react";
import type { World } from "./game";
import { FactionIcon } from "./WorldGraphic";

export type CreationProgress = { done: number; total: number; stage: string };
export function GenerationCountdown() {
  const start = useRef(Date.now());
  const [left, setLeft] = useState(30);
  useEffect(() => {
    const timer = setInterval(
      () =>
        setLeft(
          Math.max(0, 30 - Math.floor((Date.now() - start.current) / 1000)),
        ),
      1000,
    );
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="generation-countdown">
      <span aria-hidden="true">
        {left ? `00:${String(left).padStart(2, "0")}` : "Still preparing…"}
      </span>
      <p>
        {left
          ? "About 30 seconds. Enter as soon as it is ready."
          : "This world needs more time. Progress is saved."}
      </p>
    </div>
  );
}
export function WorldArrival({
  world,
  creation,
  working,
  onStart,
}: {
  world: World;
  creation: CreationProgress | null;
  working: boolean;
  onStart: () => void;
}) {
  const [step, setStep] = useState(0);
  const content = useRef<HTMLDivElement>(null);
  const [changing, setChanging] = useState(false);
  async function change(next: number) {
    if (changing) return;
    setChanging(true);
    const reduced =
      matchMedia("(prefers-reduced-motion: reduce)").matches ||
      document.querySelector('[data-motion="reduced"]');
    if (content.current && !reduced)
      await content.current
        .animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: 180,
          fill: "forwards",
        })
        .finished.catch(() => {});
    setStep(next);
    content.current?.getAnimations().forEach((a) => a.cancel());
    if (content.current && !reduced)
      content.current.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 350,
      });
    setChanging(false);
  }
  return (
    <main className="world-arrival">
      <div ref={content} className="arrival-content">
        <p className="setting-line">{world.era}</p>
        <h1>{step === 0 ? world.name : "Your people"}</h1>
        {step === 0 ? (
          <>
            <p className="arrival-summary">{world.summary}</p>
            <p className="arrival-role">You are {world.role}.</p>
            <div className="arrival-resources">
              {world.resources.map((resource) => (
                <span key={resource}>{resource}</span>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="arrival-factions">
              {world.factions.map((f) => (
                <div key={f.name}>
                  <FactionIcon faction={f} />
                  <div>
                    <h2>{f.name}</h2>
                    <p>{f.priority}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="arrival-rule">
              Keep all four factions above zero.
              {world.pressure
                ? ` Watch your ${world.pressure.resource.toLocaleLowerCase()} supply.`
                : ""}
            </p>
          </>
        )}
      </div>
      <div className="arrival-controls">
        {step === 0 ? (
          <button
            className="primary begin"
            disabled={changing}
            onClick={() => void change(1)}
          >
            Meet your people →
          </button>
        ) : (
          <button
            className="primary begin"
            disabled={working || !!creation || changing}
            onClick={onStart}
          >
            {working || creation
              ? "Preparing your first decision…"
              : "Take office →"}
          </button>
        )}
        {creation && (
          <div className="world-progress">
            <p role="status">{creation.stage}</p>
            <div
              className="world-progress-track"
              role="progressbar"
              aria-label="Preparing your world"
              aria-valuemin={0}
              aria-valuemax={creation.total}
              aria-valuenow={creation.done}
            >
              <i
                style={{
                  transform: `scaleX(${creation.done / creation.total})`,
                }}
              />
            </div>
            <GenerationCountdown />
          </div>
        )}
        {step === 1 && (
          <button
            className="text-button"
            disabled={changing}
            onClick={() => void change(0)}
          >
            ← Look around
          </button>
        )}
      </div>
    </main>
  );
}
