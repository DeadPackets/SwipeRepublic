import { useEffect, useRef, useState } from "react";
import type { PublicGame, Side } from "./game";
import { AMBITION_TARGET, MAX_TURNS, RETIRE_TURN } from "./game";
import { Portrait } from "./Portrait";

type Envelope = {
  game: PublicGame | null;
  busy: boolean;
  error?: string;
  id: string;
};
type Save = { id: string; prompt: string; name: string };
type Action = { path: string; body: Record<string, unknown> };
const SAVE_KEY = "swipe-republic:societies";
const ACTIVE_KEY = "swipe-republic:active";
function read<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
async function api(
  path: string,
  body?: Record<string, unknown>,
): Promise<Envelope> {
  const response = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await response.json().catch(() => null)) as Envelope | null;
  if (!response.ok || !data)
    throw new Error(
      data?.error ||
        (response.status === 404
          ? "This society could not be found in this browser."
          : "The republic lost its connection. Your last saved decision is safe."),
    );
  return data;
}
const factionPaths = [
  "M12 2 20 6v6c0 5-8 10-8 10S4 17 4 12V6ZM12 6v11M8 10h8",
  "M4 5h13v15H4ZM17 9h3v11H7M7 9h7M7 12h7M7 15h4",
  "M5 21V10l6 3V8l8 4v9ZM8 3v5M12 3v3M8 16v2M12 16v2M16 16v2",
  "M12 3c1 6 6 6 6 12a6 6 0 0 1-12 0c0-4 3-5 3-8 1 2 2 3 3 4 1-3 1-5 0-8Z",
];
function Icon({ index }: { index: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      aria-hidden="true"
    >
      <path d={factionPaths[index]} />
    </svg>
  );
}
function download(game: PublicGame) {
  const text = [
    `SWIPE REPUBLIC — ${game.world.name}`,
    game.world.era,
    game.world.summary,
    "",
    ...game.endings.map(
      (e, i) =>
        `Reign ${i + 1}: ${e.ruler}\n${e.title}. ${e.reason}\n${e.ambition}: ${e.progress}/${AMBITION_TARGET}\n`,
    ),
    "The chronicle",
    ...game.history.map(
      (e) =>
        `\n${game.world.calendar} ${e.turn} · Reign ${e.reign} · ${e.title}\n${e.action}\n${e.consequence}\n${game.world.factions.map((f, i) => `${f.name}: ${e.deltas[i] > 0 ? "+" : ""}${e.deltas[i]}`).join(" / ")}`,
    ),
    "",
    "What remains",
    ...game.legacies,
  ].join("\n");
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/plain;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `swipe-republic-${game.id.slice(0, 8)}.txt`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function App() {
  const [saves, setSaves] = useState<Save[]>(() => read(SAVE_KEY, []));
  const [id, setId] = useState<string | null>(() => read(ACTIVE_KEY, null));
  const active = useRef(id);
  const [game, setGame] = useState<PublicGame | null>(null);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [working, setWorking] = useState(Boolean(id));
  const lock = useRef(false);
  const [error, setError] = useState("");
  const [storageOK, setStorageOK] = useState(true);
  const [selected, setSelected] = useState<Side | null>(null);
  const [ambition, setAmbition] = useState<Side>(0);
  const [coalition, setCoalition] = useState<Side>(0);
  const [dialog, setDialog] = useState<"chronicle" | "world" | "help" | null>(
    null,
  );
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pointer = useRef<{ x: number; y: number; id: number } | null>(null);
  const [drag, setDrag] = useState(0);
  const gameRef = useRef(game);
  gameRef.current = game;

  function remember(save: Save) {
    setSaves((previous) => {
      const next = [save, ...previous.filter((s) => s.id !== save.id)].slice(
        0,
        30,
      );
      setStorageOK(write(SAVE_KEY, next));
      return next;
    });
  }
  function switchId(next: string | null) {
    active.current = next;
    setId(next);
    setStorageOK(write(ACTIVE_KEY, next));
  }
  function accept(data: Envelope, expected: string) {
    if (active.current !== expected) return;
    setGame(data.game);
    setBusy(data.busy);
    setError(
      data.error ||
        (!data.game && !data.busy
          ? "Your society is not ready yet. Retry to finish preparing it."
          : ""),
    );
    setRevision((value) => value + 1);
    if (data.game)
      remember({
        id: data.game.id,
        prompt: data.game.prompt,
        name: data.game.world.name,
      });
  }
  async function resume(target: string) {
    switchId(target);
    setError("");
    setWorking(true);
    setGame(null);
    setSelected(null);
    try {
      accept(await api(`/api/games/${target}`), target);
    } catch (cause) {
      if (active.current === target) setError((cause as Error).message);
    } finally {
      if (active.current === target) setWorking(false);
    }
  }
  useEffect(() => {
    if (active.current) void resume(active.current);
  }, []);

  async function create() {
    const setting = prompt.trim();
    if (setting.length < 5 || lock.current) return;
    const pending = saves.find(
      (s) => s.prompt === setting && s.name === "A republic taking shape",
    );
    const target = pending?.id || crypto.randomUUID();
    switchId(target);
    remember({ id: target, prompt: setting, name: "A republic taking shape" });
    setGame(null);
    setError("");
    setWorking(true);
    setBusy(false);
    lock.current = true;
    try {
      await api("/api/health");
      accept(await api("/api/games", { id: target, prompt: setting }), target);
    } catch (cause) {
      if (active.current === target) setError((cause as Error).message);
    } finally {
      lock.current = false;
      if (active.current === target) setWorking(false);
    }
  }
  async function mutate(kind: string, extra: Record<string, unknown> = {}) {
    const current = gameRef.current;
    if (!current || lock.current) return;
    const target = current.id;
    const action = {
      path: `/api/games/${target}/${kind}`,
      body: {
        ...extra,
        requestId: crypto.randomUUID(),
        version: current.version,
      },
    };
    write(`swipe-republic:action:${target}`, action);
    lock.current = true;
    setWorking(true);
    setError("");
    setSelected(null);
    setDrag(0);
    try {
      const data = await api(action.path, action.body);
      write(`swipe-republic:action:${target}`, null);
      accept(data, target);
    } catch (cause) {
      if (active.current === target) setError((cause as Error).message);
    } finally {
      lock.current = false;
      if (active.current === target) setWorking(false);
    }
  }
  async function retry() {
    if (!id || lock.current) return;
    const target = id;
    lock.current = true;
    setWorking(true);
    setError("");
    try {
      let data: Envelope;
      const save = saves.find((s) => s.id === target);
      try {
        data = await api(`/api/games/${target}`);
      } catch (cause) {
        if (save?.name !== "A republic taking shape") throw cause;
        data = await api("/api/games", { id: target, prompt: save.prompt });
      }
      const action = read<Action | null>(
        `swipe-republic:action:${target}`,
        null,
      );
      if (action) {
        if (!data.game || data.game.version === action.body.version)
          data = await api(action.path, action.body);
        write(`swipe-republic:action:${target}`, null);
      }
      if (!data.busy && !data.game && save) {
        await api("/api/health");
        data = await api("/api/games", { id: target, prompt: save.prompt });
      }
      if (
        !data.busy &&
        data.game?.phase === "playing" &&
        !data.game.card &&
        !data.game.reign.ended
      )
        data = await api(`/api/games/${target}/prepare`, {});
      accept(data, target);
    } catch (cause) {
      if (active.current === target) setError((cause as Error).message);
    } finally {
      lock.current = false;
      if (active.current === target) setWorking(false);
    }
  }

  useEffect(() => {
    if (!id || working || error || !busy || game?.card || game?.reign.ended)
      return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const data = await api(`/api/games/${id}`);
        if (!cancelled) accept(data, id);
      } catch (cause) {
        if (!cancelled) setError((cause as Error).message);
      }
    }, 1100);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [id, busy, game, working, error, revision]);

  useEffect(() => {
    if (
      !game ||
      game.phase !== "playing" ||
      game.reign.ended ||
      game.card ||
      busy ||
      working ||
      error ||
      lock.current
    )
      return;
    const target = game.id;
    lock.current = true;
    setWorking(true);
    void api(`/api/games/${target}/prepare`, {})
      .then((data) => {
        accept(data, target);
        if (
          active.current === target &&
          !data.busy &&
          !data.game?.card &&
          !data.game?.reign.ended
        )
          setError("The next petition is not ready. Try again to continue.");
      })
      .catch((cause) => {
        if (active.current === target) setError((cause as Error).message);
      })
      .finally(() => {
        lock.current = false;
        if (active.current === target) setWorking(false);
      });
  }, [game, busy, working, error]);

  function choose(side: Side) {
    if (game?.card && !working)
      void mutate("choose", { cardId: game.card.id, side });
  }
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (
        dialog ||
        !game?.card ||
        working ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        (event.target instanceof HTMLElement &&
          event.target.closest(
            "input,textarea,select,button,[contenteditable]",
          ))
      )
        return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        setSelected(event.key === "ArrowLeft" ? 0 : 1);
      }
      if (event.key === "Escape") setSelected(null);
      if (event.key === "Enter" && selected !== null) {
        event.preventDefault();
        choose(selected);
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [dialog, game, working, selected]);
  useEffect(() => {
    const element = dialogRef.current;
    if (dialog && element && !element.open) element.showModal();
  }, [dialog]);

  const newSociety = () => {
    switchId(null);
    setGame(null);
    setBusy(false);
    setWorking(false);
    setError("");
    setSelected(null);
    setDialog(null);
  };
  const last = game?.history.at(-1);
  const currentAmbition = game?.world.ambitions[game.reign.ambition];
  const card = game?.card;
  const character = game && card ? game.world.characters[card.character] : null;
  const reactions = card && selected !== null ? card.reactions[selected] : null;
  const doomed = reactions?.some(
    (r, i) => r.delta < 0 && game!.reign.support[i] + r.delta <= 0,
  );
  const loading = working || busy;

  const ambitions = game && (
    <fieldset className="ambition-options">
      <legend>What will you be remembered for?</legend>
      {game.world.ambitions.map((a, i) => (
        <label key={a.name}>
          <input
            type="radio"
            name="ambition"
            checked={ambition === i}
            onChange={() => setAmbition(i as Side)}
          />
          <span>
            <strong>{a.name}</strong>
            <span>{a.description}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
  const commitments = game && (
    <div className="commitments">
      {game.commitments.length ? (
        game.commitments.map((p) => (
          <p key={p.id}>
            <span>
              {p.due <= game.totalTurns
                ? "Due now"
                : `In ${p.due - game.totalTurns} decisions`}
            </span>
            {p.title}
          </p>
        ))
      ) : (
        <p className="quiet">No outstanding promises.</p>
      )}
    </div>
  );

  return (
    <div className="app">
      <header className="masthead">
        <button
          className="wordmark"
          onClick={newSociety}
          disabled={working}
          aria-label="Swipe Republic, saved societies"
        >
          Swipe Republic<span aria-hidden="true">✳</span>
        </button>
        <nav aria-label="Game navigation">
          {game && (
            <>
              <button onClick={() => setDialog("world")}>Your society</button>
              <button onClick={() => setDialog("chronicle")}>Chronicle</button>
            </>
          )}
          <button onClick={() => setDialog("help")} aria-label="How to play">
            ?
          </button>
        </nav>
      </header>
      {error && (
        <div className="error" role="alert">
          <p>{error}</p>
          <div>
            <button onClick={() => void retry()} disabled={working}>
              Retry safely
            </button>
            <button className="text-button" onClick={newSociety}>
              Saved societies
            </button>
          </div>
        </div>
      )}

      {!id && (
        <main className="welcome">
          <div className="welcome-mark" aria-hidden="true">
            <div>R</div>
          </div>
          <h1>
            What kind of world
            <br />
            would you rule?
          </h1>
          <p className="welcome-intro">
            Keep four factions on your side. Your successor will inherit the
            choices you make.
          </p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void create();
            }}
          >
            <label htmlFor="setting">Where will your story begin?</label>
            <textarea
              id="setting"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              minLength={5}
              maxLength={400}
              placeholder="A city on Mars, one year after independence…"
              rows={3}
              required
            />
            <div className="setting-meta">
              <span>Any place. Any era. Entirely yours.</span>
              <span>{prompt.length}/400</span>
            </div>
            <div className="examples">
              {[
                "Arab Spring, 2011 Egypt",
                "Future 1 AE Mars colony",
                "A forest republic ruled by animals",
              ].map((example) => (
                <button
                  type="button"
                  key={example}
                  onClick={() => setPrompt(example)}
                >
                  {example.startsWith("Arab")
                    ? "2011 Egypt"
                    : example.startsWith("Future")
                      ? "Mars colony"
                      : "Forest republic"}{" "}
                  <span aria-hidden="true">↗</span>
                </button>
              ))}
            </div>
            <button
              className="primary begin"
              disabled={prompt.trim().length < 5}
            >
              Found a republic <span aria-hidden="true">→</span>
            </button>
          </form>
          {saves.length > 0 && (
            <section className="saves">
              <h2>Your societies</h2>
              {saves.map((save) => (
                <button key={save.id} onClick={() => void resume(save.id)}>
                  <span>
                    {save.name}
                    <small>{save.prompt}</small>
                  </span>
                  <span aria-hidden="true">↗</span>
                </button>
              ))}
            </section>
          )}
          <p className="footnote">
            A game of fictional dilemmas, inspired by the world you describe.
            <br />
            Your societies are saved in this browser. No account needed.
          </p>
        </main>
      )}

      {id && !game && (
        <main className="founding" aria-live="polite">
          <div
            className={`seal ${loading ? "breathing" : ""}`}
            aria-hidden="true"
          >
            R
          </div>
          <h1>
            {loading ? "Preparing your society." : "Your society is saved."}
          </h1>
          <p>
            {loading
              ? "Creating the factions, people, and problems you will govern."
              : "Retry to return to your saved society."}
          </p>
          {loading && (
            <p className="quiet">The first world can take up to a minute.</p>
          )}
        </main>
      )}

      {game?.phase === "intro" && (
        <main className="introduction">
          <p className="setting-line">{game.world.era}</p>
          <h1>{game.world.name}</h1>
          <p className="world-summary">{game.world.summary}</p>
          <p className="role-line">
            You are {game.world.role}. Four powers will decide how long you
            remain.
          </p>
          <div className="faction-intro">
            {game.world.factions.map((f, i) => (
              <div key={f.name}>
                <Icon index={i} />
                <h2>{f.name}</h2>
                <p>{f.description}</p>
              </div>
            ))}
          </div>
          <p className="resource-line">
            At stake: {game.world.resources.join(" · ")}
          </p>
          {ambitions}
          <button
            className="primary begin"
            disabled={working}
            onClick={() => void mutate("start", { ambition })}
          >
            {working ? "Taking office…" : "Take office"}{" "}
            <span aria-hidden="true">→</span>
          </button>
          <p className="footnote">
            Keep every faction above zero. A reign lasts up to {MAX_TURNS}{" "}
            decisions.
            <br />
            Six acts toward your ambition can earn a peaceful departure.
          </p>
        </main>
      )}

      {game?.phase === "playing" && !game.reign.ended && (
        <main className="game-layout">
          <aside className="history-aside">
            <h2>Recent decisions</h2>
            {game.history.length ? (
              game.history.slice(-3).map((e) => (
                <p key={e.turn}>
                  <span>
                    {game.world.calendar} {e.turn}
                  </span>
                  {e.consequence}
                </p>
              ))
            ) : (
              <p>Your decisions will appear here.</p>
            )}
            <button
              className="text-button"
              onClick={() => setDialog("chronicle")}
            >
              Read the chronicle →
            </button>
          </aside>
          <section className="play-column" aria-label="Current decision">
            <p className="reign-line">
              {game.world.name}
              <span>
                Reign {game.reign.number} · Decision {game.reign.turn + 1} /{" "}
                {MAX_TURNS}
              </span>
            </p>
            <div className="factions" aria-label="Faction support">
              {game.world.factions.map((f, i) => {
                const reaction = reactions?.[i];
                const value = game.reign.support[i];
                return (
                  <button
                    key={f.name}
                    className={`faction ${value <= 20 ? "low" : ""}`}
                    onClick={() => setDialog("world")}
                    aria-label={`${f.name}: ${value} support${reaction ? `, ${reaction.uncertain ? "uncertain " : ""}${reaction.delta > 0 ? "increase" : reaction.delta < 0 ? "decrease" : "unchanged"}` : ""}`}
                  >
                    <Icon index={i} />
                    <span className="faction-name">{f.name}</span>
                    <span className="support-number">
                      {value}
                      <span
                        className={`reaction ${reaction && reaction.delta < 0 ? "negative" : ""}`}
                      >
                        {reaction
                          ? `${reaction.delta > 0 ? (reaction.delta >= 10 ? "↑↑" : "↑") : reaction.delta < 0 ? (reaction.delta <= -10 ? "↓↓" : "↓") : "—"}${reaction.uncertain ? "?" : ""}`
                          : ""}
                      </span>
                    </span>
                    <span className="meter">
                      <i style={{ width: `${value}%` }} />
                    </span>
                  </button>
                );
              })}
            </div>
            {last && (
              <div className="last-outcome" aria-live="polite">
                <p>{last.consequence}</p>
                <div>
                  {last.deltas.map((delta, i) => (
                    <span key={i} title={game.world.factions[i].name}>
                      <Icon index={i} />
                      {delta > 0 ? "+" : ""}
                      {delta}
                    </span>
                  ))}
                  {last.advanced && (
                    <span className="advanced">Ambition +1</span>
                  )}
                </div>
              </div>
            )}
            {card ? (
              <>
                <article
                  className={`decision-card ${selected !== null ? "previewing" : ""} ${working ? "committing" : ""}`}
                  style={{
                    transform: drag
                      ? `translateX(${drag}px) rotate(${drag / 25}deg)`
                      : undefined,
                  }}
                  onPointerDown={(event) => {
                    if (
                      working ||
                      (event.target as HTMLElement).closest("button")
                    )
                      return;
                    pointer.current = {
                      x: event.clientX,
                      y: event.clientY,
                      id: event.pointerId,
                    };
                    event.currentTarget.setPointerCapture(event.pointerId);
                  }}
                  onPointerMove={(event) => {
                    const start = pointer.current;
                    if (!start) return;
                    const x = event.clientX - start.x;
                    if (
                      Math.abs(event.clientY - start.y) > Math.abs(x) &&
                      Math.abs(x) < 20
                    )
                      return;
                    setDrag(Math.max(-130, Math.min(130, x)));
                    if (Math.abs(x) > 15) setSelected(x < 0 ? 0 : 1);
                  }}
                  onPointerUp={(event) => {
                    const start = pointer.current;
                    pointer.current = null;
                    setDrag(0);
                    if (
                      start &&
                      Math.abs(event.clientX - start.x) > 85 &&
                      Math.abs(event.clientX - start.x) >
                        Math.abs(event.clientY - start.y)
                    )
                      choose(event.clientX < start.x ? 0 : 1);
                  }}
                  onPointerCancel={() => {
                    pointer.current = null;
                    setDrag(0);
                  }}
                >
                  <div className="portrait-wrap">
                    <Portrait
                      character={card.character}
                      tone={game.world.tone}
                      appearance={character?.appearance}
                    />
                    {card.commitmentId && (
                      <span className="promise-stamp">A promise comes due</span>
                    )}
                  </div>
                  <div className="card-body">
                    <p className="speaker">
                      {character?.name} · {character?.role}
                    </p>
                    <h1>{card.title}</h1>
                    <p className="dilemma">{card.body}</p>
                  </div>
                  <div className="choices">
                    {card.options.map((option, i) => (
                      <button
                        key={i}
                        disabled={working}
                        aria-pressed={selected === i}
                        onClick={() => setSelected(i as Side)}
                      >
                        <span aria-hidden="true">{i === 0 ? "←" : "→"}</span>
                        {option.label}
                      </button>
                    ))}
                  </div>
                </article>
                <div className="decision-controls">
                  {selected !== null ? (
                    <>
                      <p className={doomed ? "danger-warning" : ""}>
                        {doomed
                          ? "This choice may end your reign."
                          : card.options[selected].advances
                            ? "This choice advances your ambition."
                            : "Check the faction reactions before you decide."}
                      </p>
                      <button
                        className="primary confirm"
                        disabled={working}
                        onClick={() => choose(selected)}
                      >
                        {working
                          ? "Recording your decision…"
                          : `Choose: ${card.options[selected].label}`}
                      </button>
                      <button
                        className="text-button cancel-choice"
                        onClick={() => setSelected(null)}
                        disabled={working}
                      >
                        Reconsider
                      </button>
                    </>
                  ) : (
                    <p className="swipe-help">
                      Swipe to decide, or tap an option to consider it.
                      <br />
                      <span>← / → to preview · Enter to choose</span>
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="card-wait" aria-live="polite">
                <div
                  className={`seal ${loading ? "breathing" : ""}`}
                  aria-hidden="true"
                >
                  R
                </div>
                <h1>
                  {error
                    ? "Your decision is saved."
                    : "Preparing the next card."}
                </h1>
                <p>
                  {error
                    ? "Your decision has been saved. Retry above to continue."
                    : "This usually takes a few seconds."}
                </p>
              </div>
            )}
            <div className="mobile-promises">{commitments}</div>
            <p className="save-state">
              {storageOK
                ? "Saved automatically in this browser"
                : "Browser storage is unavailable. Keep this page open."}
            </p>
          </section>
          <aside className="future-aside">
            <h2>Promises</h2>
            {commitments}
            <div className="ambition-status">
              <h2>{currentAmbition?.name}</h2>
              <p>{currentAmbition?.description}</p>
              <progress
                max={AMBITION_TARGET}
                value={game.reign.progress}
                aria-label="Ambition progress"
              />
              <span>
                {game.reign.progress} / {AMBITION_TARGET} acts ·{" "}
                {game.reign.turn} / {RETIRE_TURN} decisions to retire
              </span>
              {game.reign.progress >= AMBITION_TARGET &&
                game.reign.turn >= RETIRE_TURN && (
                  <button
                    onClick={() => void mutate("retire")}
                    disabled={working}
                  >
                    Hand over power →
                  </button>
                )}
            </div>
            {game.legacies.length > 0 && (
              <div className="legacies">
                <h2>What you inherited</h2>
                {game.legacies.map((l) => (
                  <p key={l}>{l}</p>
                ))}
              </div>
            )}
          </aside>
          <section className="mobile-ambition">
            <span>
              {currentAmbition?.name} · {game.reign.progress}/{AMBITION_TARGET}
            </span>
            {game.reign.progress >= AMBITION_TARGET &&
            game.reign.turn >= RETIRE_TURN ? (
              <button disabled={working} onClick={() => void mutate("retire")}>
                Hand over power →
              </button>
            ) : (
              <span>Retirement after decision {RETIRE_TURN}</span>
            )}
          </section>
        </main>
      )}

      {game?.reign.ended && (
        <main className="ending">
          <p className="setting-line">
            {game.world.name} · Reign {game.reign.number}
          </p>
          <div className="ending-mark" aria-hidden="true">
            {game.reign.ended.kind === "fall" ? "↓" : "✳"}
          </div>
          <h1>{game.reign.ended.title}</h1>
          <p className="world-summary">{game.reign.ended.reason}</p>
          <div className="reign-record">
            <span>
              {game.reign.turn}
              <small>decisions in power</small>
            </span>
            <span>
              {game.reign.progress}/{AMBITION_TARGET}
              <small>{game.reign.ended.ambition}</small>
            </span>
          </div>
          <section className="causal-history">
            <h2>The decisions that brought you here</h2>
            {game.history
              .filter((e) => e.reign === game.reign.number)
              .slice(-3)
              .map((e) => (
                <p key={e.turn}>
                  <strong>{e.action}</strong>
                  <span>{e.consequence}</span>
                </p>
              ))}
          </section>
          <div className="ending-actions">
            <button onClick={() => download(game)}>
              Keep this chronicle ↓
            </button>
            <button
              className="text-button"
              onClick={() => setDialog("chronicle")}
            >
              Read the full history
            </button>
          </div>
          {game.reign.number < 5 ? (
            <section className="succession">
              <h2>Choose your successor.</h2>
              <p>
                Your laws, debts, and unfinished promises remain. Who inherits
                them?
              </p>
              <fieldset className="coalitions">
                <legend>Choose the next coalition</legend>
                {[0, 1].map((c) => (
                  <label key={c}>
                    <input
                      type="radio"
                      name="coalition"
                      checked={coalition === c}
                      onChange={() => setCoalition(c as Side)}
                    />
                    <span>
                      <strong>
                        The {game.world.factions[c === 0 ? 0 : 2].name}{" "}
                        candidate
                      </strong>
                      <span>
                        {[65, 40, 40, 55]
                          .map(
                            (_, i) =>
                              `${game.world.factions[i].name} ${c === 0 ? [65, 40, 40, 55][i] : [40, 55, 65, 40][i]}`,
                          )
                          .join(" · ")}
                      </span>
                    </span>
                  </label>
                ))}
              </fieldset>
              {ambitions}
              <button
                className="primary begin"
                disabled={working}
                onClick={() => void mutate("succeed", { coalition, ambition })}
              >
                {working ? "Passing the mandate…" : "Begin the next reign"}{" "}
                <span aria-hidden="true">→</span>
              </button>
            </section>
          ) : (
            <section className="succession">
              <h2>Your fifth reign is complete.</h2>
              <p>You can keep the chronicle or start another society.</p>
              <button className="primary begin" onClick={newSociety}>
                Imagine another republic →
              </button>
            </section>
          )}
        </main>
      )}

      {dialog && (
        <dialog
          ref={dialogRef}
          onCancel={() => setDialog(null)}
          onClick={(event) => {
            if (event.target === event.currentTarget) setDialog(null);
          }}
          aria-labelledby="dialog-title"
        >
          <div className="dialog-header">
            <h2 id="dialog-title">
              {dialog === "chronicle"
                ? "The chronicle"
                : dialog === "world"
                  ? game?.world.name
                  : "How to play"}
            </h2>
            <button
              className="close-dialog"
              aria-label="Close dialog"
              onClick={() => setDialog(null)}
            >
              ×
            </button>
          </div>
          <div className="dialog-body">
            {dialog === "help" && (
              <div className="help">
                <p>
                  Describe any society. You take office among four factions,
                  each with its own values and red lines.
                </p>
                <ol>
                  <li>
                    Swipe left or right to commit. Tap an option to preview,
                    then confirm. On a keyboard, use ← or → to preview and Enter
                    to choose.
                  </li>
                  <li>
                    Arrows show which factions gain or lose support. Double
                    arrows mean a larger change. A question mark means the
                    reaction is less certain.
                  </li>
                  <li>
                    Keep every faction above zero. If one withdraws its support,
                    your reign ends. High support is safe.
                  </li>
                  <li>
                    Make six choices toward your ambition. After {RETIRE_TURN}{" "}
                    decisions, you can hand over power. Every term ends after{" "}
                    {MAX_TURNS} decisions.
                  </li>
                  <li>
                    A successor inherits your laws and unfinished promises. Each
                    society holds up to five reigns.
                  </li>
                </ol>
                <p>
                  Your choices save automatically. Use the Chronicle to keep a
                  text copy. These are fictional situations, not historical
                  reconstructions.
                </p>
              </div>
            )}
            {dialog === "world" && game && (
              <>
                <p className="setting-line">{game.world.era}</p>
                <p>{game.world.summary}</p>
                <p>Resources: {game.world.resources.join(", ")}</p>
                <div className="world-factions">
                  {game.world.factions.map((f, i) => (
                    <section key={f.name}>
                      <h3>
                        <Icon index={i} />
                        {f.name} <span>{game.reign.support[i]}</span>
                      </h3>
                      <p>{f.description}</p>
                      <dl>
                        <dt>They want</dt>
                        <dd>{f.priority}</dd>
                        <dt>They will not accept</dt>
                        <dd>{f.redLine}</dd>
                      </dl>
                    </section>
                  ))}
                </div>
                <p className="quiet">Your original setting: {game.prompt}</p>
              </>
            )}
            {dialog === "chronicle" && game && (
              <>
                <p>
                  {game.world.name} · {game.totalTurns} decisions ·{" "}
                  {game.endings.length} completed reigns
                </p>
                <button
                  onClick={() => download(game)}
                  disabled={!game.history.length}
                >
                  Download chronicle ↓
                </button>
                {game.legacies.length > 0 && (
                  <section className="chronicle-legacies">
                    <h3>What remains</h3>
                    {game.legacies.map((l) => (
                      <p key={l}>{l}</p>
                    ))}
                  </section>
                )}
                {game.history.length === 0 ? (
                  <p>Your decisions will appear here.</p>
                ) : (
                  <ol className="chronicle-events">
                    {[...game.history].reverse().map((e) => (
                      <li key={e.turn}>
                        <span className="quiet">
                          {game.world.calendar} {e.turn} · Reign {e.reign}
                        </span>
                        <h3>{e.title}</h3>
                        <p className="chronicle-action">{e.action}</p>
                        <p>{e.consequence}</p>
                        <p className="quiet">
                          {game.world.factions
                            .map(
                              (f, i) =>
                                `${f.name} ${e.deltas[i] > 0 ? "+" : ""}${e.deltas[i]}`,
                            )
                            .join(" · ")}
                          {e.advanced ? " · Ambition +1" : ""}
                        </p>
                      </li>
                    ))}
                  </ol>
                )}
              </>
            )}
          </div>
        </dialog>
      )}
    </div>
  );
}
