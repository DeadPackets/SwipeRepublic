import { useEffect, useRef, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import type { World } from "../game";
import type { CreationProgress } from "../useGame";
import { FactionIcon, factionStyle } from "../WorldGraphic";
import { FADE, SCREEN, screenMotion, staggerMotion, useReduced } from "../motion";

export function Countdown() {
  const start = useRef(Date.now());
  const [left, setLeft] = useState(30);
  useEffect(() => {
    const timer = setInterval(() => setLeft(Math.max(0, 30 - Math.floor((Date.now() - start.current) / 1000))), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <p className="countdown">
      <span aria-hidden="true">{left ? `00:${String(left).padStart(2, "0")}` : "Still preparing…"}</span>
      {left ? "About 30 seconds. Enter as soon as it is ready." : "This world needs more time. Progress is saved."}
    </p>
  );
}

export function Progress({ creation }: { creation: CreationProgress }) {
  const reduced = useReduced();
  return (
    <div className="progress">
      <p role="status">{creation.stage}</p>
      <div
        className="progress-track"
        role="progressbar"
        aria-label="Preparing your world"
        aria-valuemin={0}
        aria-valuemax={creation.total}
        aria-valuenow={creation.done}
      >
        <m.i
          initial={false}
          animate={{ scaleX: Math.max(0.04, creation.done / creation.total) }}
          transition={reduced ? FADE : { duration: 0.6, ease: SCREEN.ease }}
        />
      </div>
      <Countdown />
    </div>
  );
}

export function Arrival({
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
  const reduced = useReduced();
  const [step, setStep] = useState(0);
  const waiting = working || !!creation;
  return (
    <div className="arrival">
      <AnimatePresence mode="wait" initial={false}>
        <m.div key={step} className="arrival-content" {...screenMotion(reduced)}>
          <p className="eyebrow">{world.era}</p>
          <h1 tabIndex={-1} data-autofocus>
            {step === 0 ? world.name : "The four factions"}
          </h1>
          {step === 0 ? (
            <>
              <p className="arrival-summary">{world.summary}</p>
              <p className="arrival-role">You are the {world.role}.</p>
            </>
          ) : (
            <>
              <ul className="arrival-factions">
                {world.factions.map((f, i) => (
                  <m.li key={f.name} style={factionStyle(f)} {...staggerMotion(reduced, i)}>
                    <FactionIcon faction={f} />
                    <div>
                      <h2>{f.name}</h2>
                      <p>{f.priority}</p>
                    </div>
                  </m.li>
                ))}
              </ul>
              <m.p className="arrival-rule" {...staggerMotion(reduced, 4)}>
                A faction at 0 <em>or</em> at 100 ends your reign. When you fall, someone else takes your seat.
              </m.p>
            </>
          )}
        </m.div>
      </AnimatePresence>
      <div className="arrival-controls">
        {step === 0 ? (
          <button className="primary" onClick={() => setStep(1)}>
            Meet the factions →
          </button>
        ) : (
          <>
            <button className="primary" disabled={waiting} aria-busy={waiting} onClick={onStart}>
              {waiting ? "Preparing your first visitor…" : "Take office →"}
            </button>
            <button className="text-button" onClick={() => setStep(0)}>
              ← Look around
            </button>
          </>
        )}
        {creation && <Progress creation={creation} />}
      </div>
    </div>
  );
}
