import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { animate, m } from "motion/react";
import type { PublicGame } from "./game";
import { FactionIcon, factionStyle } from "./WorldGraphic";
import { Portrait } from "./Portrait";
import { downloadChronicle } from "./chronicle";
import { roman } from "./play/faces";
import { DIALOG, FADE, useReduced } from "./motion";
import { setSound, soundEnabled } from "./feedback";

export type Panel = "menu" | "world" | "people" | "promises" | "chronicle" | "help" | "abandon";
const titles: Record<Panel, string> = {
  menu: "Your game",
  world: "Your society",
  people: "Your people",
  promises: "Promises and laws",
  chronicle: "Chronicle",
  help: "How to play",
  abandon: "Abandon this dynasty?",
};
const order: Panel[] = ["menu", "world", "people", "promises", "chronicle", "help", "abandon"];

export function MenuDialog({
  initial,
  faction,
  game,
  working,
  error,
  reducedPreference,
  onReducedPreference,
  onSavedGames,
  onAbandon,
  onClose,
}: {
  initial: Panel;
  faction: number | null;
  game: PublicGame | null;
  working: boolean;
  error: string;
  reducedPreference: boolean;
  onReducedPreference: (value: boolean) => void;
  onSavedGames: () => void;
  onAbandon: () => void;
  onClose: () => void;
}) {
  const reduced = useReduced();
  const dialog = useRef<HTMLDialogElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [panel, setPanel] = useState<Panel>(initial);
  const [closing, setClosing] = useState(false);
  const [sound, setSoundState] = useState(soundEnabled);
  const previous = useRef({ panel: initial, height: 0 });

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => opener?.focus();
  }, []);

  useLayoutEffect(() => {
    const el = body.current!;
    const from = previous.current;
    const to = el.offsetHeight;
    if (from.panel !== panel) {
      el.scrollTop = 0;
      heading.current?.focus();
      const direction = order.indexOf(panel) > order.indexOf(from.panel) ? 1 : -1;
      if (reduced) animate(el, { opacity: [0, 1] }, FADE);
      else {
        animate(el, { height: [from.height, to] }, DIALOG.spring).then(() => el.style.removeProperty("height"));
        animate(el.firstElementChild!, { opacity: [0, 1], x: [direction * DIALOG.slide, 0] }, { duration: 0.3 });
      }
    }
    previous.current = { panel, height: to };
  }, [panel]);

  useEffect(() => {
    if (panel !== "world" || faction === null) return;
    const target = body.current?.querySelector<HTMLDetailsElement>(`[data-faction="${faction}"]`);
    if (!target) return;
    target.open = true;
    target.scrollIntoView({ block: "nearest" });
  }, []);

  function close() {
    if (closing) return;
    setClosing(true);
    animate(dialog.current!, { opacity: 0, scale: reduced ? 1 : 0.97 }, reduced ? FADE : { duration: 0.16 }).then(() => {
      dialog.current?.close();
      onClose();
    });
  }
  const go = (next: Panel) => () => setPanel(next);
  const row = (label: string, next: Panel) => (
    <button onClick={go(next)}>
      {label}
      <span aria-hidden="true">→</span>
    </button>
  );
  const playing = game?.phase === "playing";

  return (
    <m.dialog
      ref={dialog}
      className="menu-dialog"
      data-closing={closing || undefined}
      role={panel === "abandon" ? "alertdialog" : undefined}
      aria-labelledby="dialog-title"
      initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={reduced ? FADE : DIALOG.spring}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <header className="dialog-header">
        {panel !== "menu" && (
          <button className="icon-button" onClick={go("menu")} aria-label="Back to menu">
            ←
          </button>
        )}
        <h2 id="dialog-title" ref={heading} tabIndex={-1}>
          {panel === "world" && game ? game.world.name : titles[panel]}
        </h2>
        <button className="icon-button" onClick={close} aria-label="Close menu">
          ×
        </button>
      </header>
      <div className="dialog-body" ref={body}>
        <div className="panel" key={panel}>
          {panel === "menu" && (
            <nav className="menu-list" aria-label="Game menu">
              {game && (
                <>
                  {row("Your society", "world")}
                  {row("Your people", "people")}
                  {row("Promises and laws", "promises")}
                  {row("Chronicle", "chronicle")}
                </>
              )}
              {row("How to play", "help")}
              <button
                role="switch"
                aria-checked={sound}
                onClick={() => {
                  setSound(!sound);
                  setSoundState(!sound);
                }}
              >
                Sound<span>{sound ? "On" : "Off"}</span>
              </button>
              <button role="switch" aria-checked={reducedPreference} onClick={() => onReducedPreference(!reducedPreference)}>
                Reduce motion<span>{reducedPreference ? "On" : "Off"}</span>
              </button>
              <button disabled={working} onClick={onSavedGames}>
                Saved games<span aria-hidden="true">→</span>
              </button>
              {playing && (
                <button className="danger" disabled={working} onClick={go("abandon")}>
                  Abandon dynasty<span aria-hidden="true">→</span>
                </button>
              )}
            </nav>
          )}
          {panel === "abandon" && (
            <div className="abandon">
              <p>This ends your dynasty for good. Its chronicle and deaths stay in Saved games.</p>
              <div className="abandon-actions">
                <button className="primary" disabled={working} onClick={close}>
                  Keep ruling
                </button>
                <button className="danger" disabled={working} aria-busy={working} onClick={onAbandon}>
                  {working ? "Ending…" : "Abandon dynasty"}
                </button>
              </div>
              {error && <p className="error-text">{error}</p>}
            </div>
          )}
          {panel === "help" && (
            <div className="help">
              <ol>
                <li>Swipe the card left or right, tap a choice, or hold ← / → for 0.7 s.</li>
                <li>A dot above a faction means it will react. A large dot means a large reaction. You never see which way.</li>
                <li>A faction at 0 or at 100 ends your reign. Too much loyalty is as fatal as none.</li>
                <li>When you fall, pick who backs your successor. Promises, laws and grudges carry on.</li>
                <li>Every faction can end a ruler two ways. Collect all eight deaths.</li>
              </ol>
              <p className="quiet">A flickering dot means the reaction is uncertain and smaller. Choices save automatically.</p>
            </div>
          )}
          {panel === "world" && game && (
            <>
              <p>{game.world.summary}</p>
              <div className="faction-list">
                {game.world.factions.map((f, i) => (
                  <details key={f.name} data-faction={i} style={factionStyle(f)}>
                    <summary>
                      <FactionIcon faction={f} />
                      <span>{f.name}</span>
                      <span className="value">{game.reign.support[i]}</span>
                    </summary>
                    <p>{f.description}</p>
                    <p>
                      <strong>Wants:</strong> {f.priority}
                    </p>
                    <p className="quiet">
                      <strong>Red line:</strong> {f.redLine}
                    </p>
                  </details>
                ))}
              </div>
            </>
          )}
          {panel === "people" && game && (
            <ul className="people">
              {game.world.characters.map((person, i) => (
                <li key={i} style={factionStyle(game.world.factions[person.faction]!)}>
                  <Portrait character={person} />
                  <div>
                    <h3>{person.name}</h3>
                    <p className="quiet">
                      {person.role} · {game.world.factions[person.faction]!.label}
                    </p>
                    <p>{person.relationship}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {panel === "promises" && game && (
            <>
              <h3>Promises</h3>
              {game.commitments.length ? (
                <ul className="promises">
                  {game.commitments.map((p) => (
                    <li key={p.id}>
                      <strong>{p.title}</strong>
                      <span className="quiet">
                        {p.due <= game.totalTurns ? "Due now" : `Due in ${p.due - game.totalTurns} decisions`}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="quiet">No promises outstanding.</p>
              )}
              <h3>Laws</h3>
              {game.legacies.length ? (
                <ul className="laws">
                  {game.legacies.map((law) => (
                    <li key={law}>{law}</li>
                  ))}
                </ul>
              ) : (
                <p className="quiet">No lasting laws yet.</p>
              )}
            </>
          )}
          {panel === "chronicle" && game && (
            <>
              <button onClick={() => downloadChronicle(game)} disabled={!game.history.length}>
                Download the chronicle
              </button>
              {game.history.length === 0 ? (
                <p className="quiet">Your decisions will appear here.</p>
              ) : (
                <ol className="events">
                  {[...game.history].reverse().map((e, i) => (
                    <li key={i}>
                      <span className="quiet">
                        {game.world.calendar} {e.turn} · Reign {roman(e.reign)}
                      </span>
                      <h3>{e.action}</h3>
                      <p>{e.consequence}</p>
                    </li>
                  ))}
                </ol>
              )}
            </>
          )}
        </div>
      </div>
    </m.dialog>
  );
}
