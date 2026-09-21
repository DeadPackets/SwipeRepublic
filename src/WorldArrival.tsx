import { useEffect, useRef, useState } from "react";
import type { World } from "./game";

export type CreationProgress = { done: number; total: number; stage: string };
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
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (step) heading.current?.focus({ preventScroll: true });
  }, [step]);
  const progress = creation
    ? Math.round((creation.done / creation.total) * 100)
    : 100;
  return (
    <main className={`world-arrival arrival-step-${step}`}>
      <div className="arrival-content" key={step}>
        <p className="setting-line">{world.era}</p>
        <h1 ref={heading} tabIndex={-1}>
          {step === 0 ? world.name : "Your people"}
        </h1>
        {step === 0 ? (
          <>
            <p className="arrival-summary">{world.summary}</p>
            <div className="arrival-resources" aria-label="Scarce resources">
              {world.resources.map((name, i) => (
                <span key={name}>
                  {world.art?.[`resource-${i}`] && (
                    <img
                      src={world.art[`resource-${i}`]}
                      alt=""
                      width="44"
                      height="44"
                    />
                  )}
                  {name}
                </span>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="arrival-summary">
              You are {world.role}. Keep their support.
            </p>
            <div className="arrival-factions">
              {world.factions.map((faction, i) => {
                const person = world.characters.findIndex(
                  (person) => person.faction === i,
                );
                const portrait = world.art?.[`portrait-${person}`];
                return (
                  <div
                    key={faction.name}
                    style={{ "--order": i } as React.CSSProperties}
                  >
                    {portrait && (
                      <img src={portrait} alt="" width="56" height="56" />
                    )}
                    <div>
                      <h2>{faction.name}</h2>
                      <p>{faction.priority}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="arrival-rule">
              If one falls to zero, your reign ends.
            </p>
          </>
        )}
      </div>
      <div className="arrival-controls">
        {creation && step === 0 && (
          <button className="primary begin" onClick={() => setStep(1)}>
            Enter your society →
          </button>
        )}
        {creation ? (
          <div className="world-progress" role="status">
            <p>
              {creation.stage}
              <span>
                {creation.done}/{creation.total}
              </span>
            </p>
            <div
              role="progressbar"
              aria-label="Preparing your world"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
            >
              <i style={{ transform: `scaleX(${progress / 100})` }} />
            </div>
            <span>Saved as it takes shape. You can return later.</span>
          </div>
        ) : (
          <>
            <button
              className="primary begin"
              disabled={working}
              onClick={step === 0 ? () => setStep(1) : onStart}
            >
              {working
                ? "Taking office…"
                : step === 0
                  ? "Enter your society"
                  : "Take office"}
              <span aria-hidden="true"> →</span>
            </button>
            {step === 1 && (
              <button
                className="text-button"
                disabled={working}
                onClick={() => setStep(0)}
              >
                ← Look around
              </button>
            )}
          </>
        )}
      </div>
    </main>
  );
}
