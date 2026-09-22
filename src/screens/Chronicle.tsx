import { m } from "motion/react";
import type { PublicGame } from "../game";
import { FactionIcon } from "../WorldGraphic";
import { deathsCollected, roman } from "../play/faces";
import { downloadChronicle } from "../chronicle";
import { staggerMotion, useReduced } from "../motion";

export function Chronicle({ game, onNew }: { game: PublicGame; onNew: () => void }) {
  const reduced = useReduced();
  const collected = deathsCollected(game.endings);
  const best = Math.max(0, ...game.endings.map((e) => e.turns));
  return (
    <div className="chronicle">
      <p className="eyebrow">The dynasty ends</p>
      <h1 tabIndex={-1} data-autofocus>
        {game.world.name}
      </h1>
      <dl className="dynasty-stats">
        <div>
          <dt>{game.world.calendar}</dt>
          <dd>{game.totalTurns}</dd>
        </div>
        <div>
          <dt>Rulers</dt>
          <dd>{game.reign.number}</dd>
        </div>
        <div>
          <dt>Best reign</dt>
          <dd>{best}</dd>
        </div>
        <div>
          <dt>Deaths</dt>
          <dd>{collected.size} / 8</dd>
        </div>
      </dl>
      <section aria-label="Deaths collected" className="death-grid">
        {game.world.factions.flatMap((f, i) =>
          (["collapse", "excess"] as const).map((kind, k) => {
            const found = collected.has(`${i}:${kind}`);
            return (
              <m.div
                key={`${i}${kind}`}
                className="death-slot"
                data-found={found || undefined}
                {...staggerMotion(reduced, i * 2 + k)}
              >
                <FactionIcon faction={f} />
                <span>
                  <strong>{found ? f[kind].title : "Undiscovered"}</strong>
                  <small>
                    {f.label} at {kind === "collapse" ? "0" : "100"}
                  </small>
                </span>
              </m.div>
            );
          }),
        )}
      </section>
      <ol className="rulers">
        {game.endings.map((e, i) => (
          <li key={i}>
            <span className="quiet">
              Reign {roman(e.reign)} · {e.turns} {e.turns === 1 ? "decision" : "decisions"}
            </span>
            <strong>{e.title}</strong>
            <p>{e.reason}</p>
          </li>
        ))}
      </ol>
      <div className="chronicle-actions">
        <button className="primary" onClick={onNew}>
          Found a new society →
        </button>
        <button className="text-button" onClick={() => downloadChronicle(game)} disabled={!game.history.length}>
          Download the chronicle
        </button>
      </div>
    </div>
  );
}
