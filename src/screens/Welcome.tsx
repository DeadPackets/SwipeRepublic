import { AnimatePresence, m } from "motion/react";
import type { GameSession } from "../useGame";
import { screenMotion, staggerMotion, useReduced } from "../motion";

export function Welcome({ session }: { session: GameSession }) {
  const reduced = useReduced();
  const { lookup, checking, working, prompt, saves } = session;
  const title = lookup ? (lookup.matches.length ? "A familiar world?" : "Create your world") : "Where will you rule?";
  return (
    <div className="welcome">
      <AnimatePresence mode="wait" initial={false}>
        <m.div key={lookup ? "matches" : "form"} className="welcome-panel" {...screenMotion(reduced)}>
          <h1 tabIndex={-1} data-autofocus>
            {title}
          </h1>
          {!lookup ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void session.findWorlds();
              }}
            >
              <label htmlFor="setting">Describe a society. Any place, any time, any species.</label>
              <textarea
                id="setting"
                value={prompt}
                onChange={(event) => session.setPrompt(event.target.value)}
                disabled={checking}
                minLength={5}
                maxLength={400}
                placeholder="Egypt, 2011. A colony on Mars. A republic of clockwork bees…"
                rows={3}
                required
              />
              <div className="form-row">
                <span className="count" aria-live="off">
                  {prompt.length} / 400
                </span>
                <button className="primary" disabled={prompt.trim().length < 5 || checking} aria-busy={checking}>
                  {checking ? "Looking for similar worlds…" : "Begin"}
                </button>
              </div>
            </form>
          ) : (
            <section className="matches" aria-label="Similar societies">
              <p className="lede">
                {lookup.unavailable
                  ? "We couldn't check the saved societies. You can still create your own."
                  : "These societies are already built. Your dynasty starts fresh in any of them."}
              </p>
              {lookup.matches.map((match, i) => (
                <m.button
                  key={match.id}
                  className="match"
                  disabled={working}
                  onClick={() => void session.create(match.id)}
                  {...staggerMotion(reduced, i)}
                >
                  <span>
                    <strong>{match.name}</strong>
                    <small>
                      {match.era} · {Math.round(match.similarity)}% similar
                    </small>
                    <span>{match.summary}</span>
                  </span>
                  <span aria-hidden="true">→</span>
                </m.button>
              ))}
              <m.button
                className="primary"
                disabled={working}
                onClick={() => void session.create()}
                {...staggerMotion(reduced, lookup.matches.length)}
              >
                Create my own world →
              </m.button>
              <button className="text-button" disabled={working} onClick={session.clearLookup}>
                ← Change the description
              </button>
            </section>
          )}
        </m.div>
      </AnimatePresence>
      {saves.length > 0 && (
        <details className="saves">
          <summary>Saved games ({saves.length})</summary>
          <div className="save-list">
            {saves.map((save) => (
              <button key={save.id} disabled={checking} onClick={() => void session.resume(save.id)}>
                {save.name}
                <span aria-hidden="true">→</span>
              </button>
            ))}
          </div>
        </details>
      )}
      <p className="footnote">A fictional history shaped by your choices.</p>
    </div>
  );
}
