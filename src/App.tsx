import { useEffect, useRef, useState } from "react";
import type { Card, PublicGame, Side } from "./game";
import { WorldArrival, type CreationProgress } from "./WorldArrival";
import type { CampaignMatch } from "../worker/campaigns";
import { DecisionCard, SWIPE_MS } from "./DecisionCard";
import { FactionIcon } from "./WorldGraphic";
import { Portrait } from "./Portrait";
import { useArrowHold } from "./useArrowHold";
import { GenerationCountdown } from "./WorldArrival";
import {
  readSocieties,
  rememberSociety,
  SOCIETY_PREFIX,
  type SavedSociety,
} from "./storage";

type Envelope = {
  game: PublicGame | null;
  busy: boolean;
  error?: string;
  id: string;
  creation?: CreationProgress | null;
};
type Save = SavedSociety;
type Action = { path: string; body: Record<string, unknown> };
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
async function api<T = Envelope>(
  path: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await response.json().catch(() => null)) as
    (T & { error?: string }) | null;
  if (!response.ok || !data)
    throw new Error(
      data?.error ||
        (response.status === 404
          ? "This society could not be found in this browser."
          : "The republic lost its connection. Your last saved decision is safe."),
    );
  return data;
}
function download(game: PublicGame) {
  const text = [
    `SWIPE REPUBLIC — ${game.world.name}`,
    game.world.era,
    game.world.summary,
    "",
    ...game.endings.map(
      (e, i) => `Reign ${i + 1}: ${e.ruler}\n${e.title}. ${e.reason}\n`,
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
  const [saves, setSaves] = useState<Save[]>(readSocieties);
  const [id, setId] = useState<string | null>(() => {
    const value = read<unknown>(ACTIVE_KEY, null);
    return typeof value === "string" ? value : null;
  });
  const active = useRef(id);
  const [game, setGame] = useState<PublicGame | null>(null);
  const [prompt, setPrompt] = useState("");
  const [motionPreference, setMotionPreference] = useState<boolean | null>(() =>
    read("swipe-republic:reduced-motion", null),
  );
  const [systemMotion, setSystemMotion] = useState(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const reducedMotion = motionPreference ?? systemMotion;
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setSystemMotion(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [working, setWorking] = useState(Boolean(id));
  const lock = useRef(false);
  const [error, setError] = useState("");
  const [storageOK, setStorageOK] = useState(true);
  const [selected, setSelected] = useState<Side | null>(null);
  const [creation, setCreation] = useState<CreationProgress | null>(null);
  const [checking, setChecking] = useState(false);
  const [lookup, setLookup] = useState<{
    matches: CampaignMatch[];
    unavailable?: boolean;
  } | null>(null);
  const [dialog, setDialog] = useState<
    "menu" | "chronicle" | "world" | "help" | null
  >(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [factionDetail, setFactionDetail] = useState<number | null>(null);
  const [departure, setDeparture] = useState<{ card: Card; side: Side } | null>(
    null,
  );
  const departureTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dialogClosing, setDialogClosing] = useState(false);
  const dialogTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playSurface = useRef<HTMLElement>(null);
  const departureToken = useRef(0);
  const gameRef = useRef(game);
  gameRef.current = game;

  function remember(save: Save) {
    const saved = rememberSociety(save);
    setStorageOK(saved);
    setSaves((previous) => [
      save,
      ...(saved ? readSocieties() : previous).filter(
        (item) => item.id !== save.id,
      ),
    ]);
  }
  useEffect(() => {
    const update = (event: StorageEvent) => {
      if (
        event.key === null ||
        event.key.startsWith(SOCIETY_PREFIX) ||
        event.key === "swipe-republic:societies"
      )
        setSaves(readSocieties());
    };
    window.addEventListener("storage", update);
    return () => window.removeEventListener("storage", update);
  }, []);
  async function ensureSession() {
    if (navigator.locks)
      await navigator.locks.request("swipe-republic:guest-session", () =>
        api("/api/health"),
      );
    else
      throw new Error(
        "This browser cannot save a guest session safely. Open the game in a current browser over HTTPS.",
      );
  }
  function switchId(next: string | null) {
    active.current = next;
    setId(next);
    setStorageOK(write(ACTIVE_KEY, next));
  }
  function accept(data: Envelope, expected: string) {
    if (active.current !== expected) return;
    const current = gameRef.current;
    if (
      current?.id === expected &&
      data.game &&
      data.game.version < current.version
    )
      return;
    gameRef.current = data.game;
    setGame(data.game);
    setBusy(data.busy);
    setCreation(data.creation ?? null);
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
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [id, game?.phase, game?.reign.number, Boolean(game?.reign.ended)]);

  async function findWorlds() {
    if (lock.current || prompt.trim().length < 5) return;
    lock.current = true;
    setChecking(true);
    setError("");
    try {
      await ensureSession();
      const result = await api<{
        matches: CampaignMatch[];
        unavailable?: boolean;
      }>("/api/campaigns/match", { prompt: prompt.trim() });
      setLookup(result);
      lock.current = false;
      if (!result.matches.length && !result.unavailable) await create();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      lock.current = false;
      setChecking(false);
    }
  }
  async function create(campaignId?: string) {
    const setting = prompt.trim();
    if (setting.length < 5 || lock.current) return;
    const pending =
      !campaignId &&
      saves.find(
        (s) => s.prompt === setting && s.name === "A republic taking shape",
      );
    const target = (pending && pending.id) || crypto.randomUUID();
    switchId(target);
    remember({ id: target, prompt: setting, name: "A republic taking shape" });
    setGame(null);
    setCreation(null);
    setError("");
    setWorking(true);
    setBusy(false);
    lock.current = true;
    try {
      await ensureSession();
      const body = {
        id: target,
        prompt: setting,
        ...(campaignId ? { campaignId } : {}),
      };
      write(`swipe-republic:creation:${target}`, body);
      accept(await api("/api/games", body), target);
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
    if (lock.current) return;
    if (!id) {
      await findWorlds();
      return;
    }
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
        data = await api(
          "/api/games",
          read(`swipe-republic:creation:${target}`, {
            id: target,
            prompt: save.prompt,
          }),
        );
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
        await ensureSession();
        data = await api(
          "/api/games",
          read(`swipe-republic:creation:${target}`, {
            id: target,
            prompt: save.prompt,
          }),
        );
      }
      if (
        !data.busy &&
        (data.creation ||
          (data.game?.phase === "playing" &&
            !data.game.card &&
            !data.game.reign.ended))
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
    if (
      !id ||
      working ||
      error ||
      !busy ||
      (game?.card && !creation) ||
      game?.reign.ended
    )
      return;
    let cancelled = false;
    const timer = setTimeout(
      async () => {
        try {
          const data = await api(`/api/games/${id}`);
          if (!cancelled) accept(data, id);
        } catch (cause) {
          if (!cancelled) setError((cause as Error).message);
        }
      },
      creation ? 2200 : 1100,
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [id, busy, game, working, error, revision, creation]);

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
    const current = gameRef.current;
    if (
      !current?.card ||
      current.phase !== "playing" ||
      working ||
      lock.current ||
      departure
    )
      return;
    const token = ++departureToken.current,
      target = current.id;
    setDeparture({ card: current.card, side });
    const animation = new Promise<void>((resolve) => {
      departureTimer.current = setTimeout(
        resolve,
        reducedMotion ? 120 : SWIPE_MS,
      );
    });
    void Promise.all([
      animation,
      mutate("choose", { cardId: current.card.id, side }),
    ]).then(() => {
      if (active.current === target && departureToken.current === token)
        setDeparture(null);
    });
  }
  const hold = useArrowHold({
    enabled:
      !!game?.card &&
      game.phase === "playing" &&
      !game.reign.ended &&
      !working &&
      !departure &&
      !dialog &&
      !error,
    cardId: game?.card?.id,
    surface: playSurface,
    onSelect: setSelected,
    onChoose: choose,
  });
  function preview(side: Side | null) {
    if (!hold.holding() && !departure) setSelected(side);
  }
  function closeDialog() {
    setDialogClosing(true);
    if (dialogTimer.current) clearTimeout(dialogTimer.current);
    dialogTimer.current = setTimeout(() => {
      dialogRef.current?.close();
      setDialog(null);
      setDialogClosing(false);
    }, 140);
  }
  useEffect(
    () => () => {
      if (departureTimer.current) clearTimeout(departureTimer.current);
      if (dialogTimer.current) clearTimeout(dialogTimer.current);
    },
    [],
  );
  useEffect(() => {
    const element = dialogRef.current;
    if (dialog && element && !element.open) element.showModal();
  }, [dialog]);

  const newSociety = () => {
    departureToken.current++;
    hold.cancel(true);
    switchId(null);
    setGame(null);
    setBusy(false);
    setWorking(false);
    setError("");
    setSelected(null);
    setDialog(null);
    setDeparture(null);
    setCreation(null);
    setLookup(null);
  };
  const latest = game?.history.at(-1);
  const last = latest?.reign === game?.reign.number ? latest : undefined;
  const card = departure?.card ?? game?.card;
  const character = game && card ? game.world.characters[card.character] : null;
  const reactions = card && selected !== null ? card.reactions[selected] : null;
  const supportDoomed = reactions?.some(
    (r, i) => r.delta < 0 && game!.reign.support[i] + r.delta <= 0,
  );
  const reserveDoomed =
    game?.reserve !== undefined &&
    card &&
    selected !== null &&
    game.reserve - 1 + (card.reserveChanges?.[selected] ?? 1) <= 0;
  const doomed = supportDoomed || reserveDoomed;
  const loading = working || busy;
  const pressure = game ? Math.min(...game.reign.support) : 50;
  const commitments = game && (
    <div className="commitments">
      {game.commitments.length ? (
        game.commitments.map((p) => (
          <p key={p.id}>
            <strong>{p.title}</strong>
            <span>
              {p.due <= game.totalTurns
                ? "Due now"
                : `In ${p.due - game.totalTurns} ${p.due - game.totalTurns === 1 ? "decision" : "decisions"}`}
            </span>
          </p>
        ))
      ) : (
        <p className="quiet">No promises outstanding.</p>
      )}
    </div>
  );
  function showWorld(index: number | null = null) {
    setFactionDetail(index);
    setDialog("world");
  }

  return (
    <div
      className="app"
      data-tone={game?.world.tone ?? "earth"}
      data-pressure={pressure <= 20 ? "critical" : "steady"}
      data-ended={game?.reign.ended?.kind}
      data-phase={game?.phase ?? "welcome"}
      data-motion={reducedMotion ? "reduced" : "full"}
    >
      {game?.nextPortrait &&
        !game.world.characters[game.card?.character ?? 0]?.silhouette && (
          <link rel="preload" as="image" href={game.nextPortrait} />
        )}
      {game?.world.art?.background && (
        <div
          className="world-scene"
          key={`${game.id}-scene`}
          aria-hidden="true"
        >
          <img src={game.world.art.background} alt="" fetchPriority="high" />
        </div>
      )}
      <div className="world-vignette" aria-hidden="true" />
      <header className="masthead">
        <button
          className="wordmark"
          onClick={newSociety}
          disabled={working || checking}
          aria-label="Swipe Republic, saved societies"
        >
          Swipe Republic
        </button>
        <button className="menu-button" onClick={() => setDialog("menu")}>
          Menu
        </button>
      </header>
      {error && (
        <div className="error" role="alert">
          <p>{error}</p>
          <div>
            <button onClick={() => void retry()} disabled={working}>
              Try again
            </button>
            <button className="text-button" onClick={newSociety}>
              Saved games
            </button>
          </div>
        </div>
      )}

      {!id && (
        <main className="welcome">
          <h1>
            {lookup
              ? lookup.matches.length
                ? "A familiar world?"
                : "Create your world"
              : "Where will you rule?"}
          </h1>
          {!lookup && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void findWorlds();
              }}
            >
              <label htmlFor="setting">Describe your world</label>
              <textarea
                id="setting"
                value={prompt}
                onChange={(event) => {
                  setPrompt(event.target.value);
                  setLookup(null);
                }}
                disabled={checking}
                minLength={5}
                maxLength={400}
                placeholder="Egypt, 2011. Or a colony on Mars…"
                rows={3}
                required
              />
              <button
                className="primary begin"
                disabled={prompt.trim().length < 5 || checking}
              >
                {checking ? "Looking for similar worlds…" : "Begin"}
              </button>
            </form>
          )}
          {lookup && (
            <section
              className="campaign-matches"
              aria-label="Similar societies"
            >
              <p>
                {lookup.unavailable
                  ? "We couldn't check saved societies. You can still create your own."
                  : "These societies are already ready. Your reign starts fresh."}
              </p>
              {lookup.matches.map((match) => (
                <button
                  className="campaign-match"
                  key={match.id}
                  disabled={working || checking}
                  onClick={() => void create(match.id)}
                >
                  <span>
                    <strong>{match.name}</strong>
                    <span>
                      {match.era} · {match.similarity}% similar
                    </span>
                    <span>{match.summary}</span>
                  </span>
                  <span aria-hidden="true">→</span>
                </button>
              ))}
              <button
                className="primary begin"
                disabled={working || checking}
                onClick={() => void create()}
              >
                Create my own world →
              </button>
              <button
                className="text-button"
                disabled={working || checking}
                onClick={() => setLookup(null)}
              >
                ← Change setting
              </button>
            </section>
          )}
          {saves.length > 0 && (
            <details className="saves">
              <summary>Saved games ({saves.length})</summary>
              {saves.map((save) => (
                <button
                  key={save.id}
                  disabled={checking}
                  onClick={() => void resume(save.id)}
                >
                  {save.name}
                  <span aria-hidden="true">→</span>
                </button>
              ))}
            </details>
          )}
          <p className="footnote">
            A fictional history shaped by your choices.
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
          <h1>{loading ? "Opening your world…" : "Your game is saved."}</h1>
          <p>
            {loading
              ? "Preparing your society, its people and its first decision."
              : "Try again to continue."}
          </p>
          {loading && <GenerationCountdown />}
        </main>
      )}

      {game?.phase === "intro" && (
        <WorldArrival
          key={`${game.id}-arrival`}
          world={game.world}
          creation={creation}
          working={working}
          onStart={() => void mutate("start")}
        />
      )}

      {game?.phase === "playing" && (!game.reign.ended || departure) && (
        <main className="game-layout">
          <section
            ref={playSurface}
            className="play-column"
            aria-label="Current decision"
          >
            <p className="reign-line">
              {game.world.name}
              <span>
                {game.world.calendar} {game.reign.turn + 1} · Reign{" "}
                {game.reign.number}
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
                    onClick={() => showWorld(i)}
                    title={`${f.name}: ${value}/100`}
                    aria-label={`${f.name}: ${value} support${reaction ? `, ${reaction.uncertain ? "uncertain " : ""}${reaction.delta > 0 ? "increase" : reaction.delta < 0 ? "decrease" : "unchanged"}` : ""}`}
                  >
                    <FactionIcon faction={f} />
                    <span className="faction-label">{f.label ?? f.name}</span>
                    <span
                      className={`reaction ${reaction && reaction.delta < 0 ? "negative" : ""}`}
                      data-active={Boolean(reaction?.delta || reaction?.uncertain)}
                      aria-hidden="true"
                    >
                      {reaction?.delta ? (reaction.delta > 0 ? "↑" : "↓") : ""}
                      {reaction?.uncertain ? "?" : ""}
                    </span>
                    <span className="meter">
                      <i style={{ transform: `scaleX(${value / 100})` }} />
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="sr-only" role="status">
              {last
                ? `${last.consequence} ${game.world.factions.map((f, i) => `${f.name}: ${game.reign.support[i]}`).join(". ")}`
                : "Keep all four factions above zero."}
            </div>
            {game.world.pressure && game.reserve !== undefined && (
              <p
                className={`reserve-warning ${game.reserve <= 2 ? "critical" : ""}`}
              >
                {game.world.pressure.warning} in{" "}
                <strong>
                  {game.reserve} {game.reserve === 1 ? "decision" : "decisions"}
                </strong>
              </p>
            )}
            {card ? (
              <>
                <div className="decision-stage">
                  {game.card &&
                    departure &&
                    game.card.id !== departure.card.id && (
                      <DecisionCard
                        key={game.card.id}
                        card={game.card}
                        character={game.world.characters[game.card.character]!}
                        faction={
                          game.world.factions[
                            game.world.characters[game.card.character]!.faction
                          ]!
                        }
                        calendar={game.world.calendar}
                        turn={game.reign.turn + 1}
                        image={
                          game.world.art?.[`portrait-${game.card.character}`]
                        }
                        selected={null}
                        working={true}
                        leaving={null}
                        reducedMotion={reducedMotion}
                        onSelect={() => {}}
                        onChoose={() => {}}
                      />
                    )}
                  <DecisionCard
                    key={card.id}
                    card={card}
                    character={character!}
                    faction={game.world.factions[character!.faction]!}
                    calendar={game.world.calendar}
                    turn={
                      departure
                        ? game.reign.turn + (game.card?.id === card.id ? 1 : 0)
                        : game.reign.turn + 1
                    }
                    image={game.world.art?.[`portrait-${card.character}`]}
                    selected={selected}
                    working={working || !!departure}
                    leaving={departure?.side ?? null}
                    reducedMotion={reducedMotion}
                    onSelect={preview}
                    onChoose={choose}
                  />
                  {departure &&
                    working &&
                    game.card?.id === departure.card.id && (
                      <p className="saving-decision" role="status">
                        Saving your decision…
                      </p>
                    )}
                </div>
                <div className="decision-hint" aria-live="polite">
                  {doomed ? (
                    <span className="danger-warning">
                      This could end your reign.
                    </span>
                  ) : selected !== null && card ? (
                    <span>{card.options[selected]?.consequence}</span>
                  ) : last ? (
                    <span>{last.consequence}</span>
                  ) : null}
                </div>
                <p className="controls-hint" id="decision-controls">
                  Swipe, click, or hold ← / → to answer.
                  <br />
                  Release a key early to cancel.
                </p>
              </>
            ) : (
              <div className="card-wait" aria-live="polite">
                <div
                  className={`seal ${loading ? "breathing" : ""}`}
                  aria-hidden="true"
                >
                  R
                </div>
                <p>
                  {error
                    ? "Your choice is saved."
                    : "The next visitor is on their way…"}
                </p>
              </div>
            )}
            {!storageOK && (
              <p className="storage-warning" role="status">
                Saving is unavailable. Keep this tab open.
              </p>
            )}
          </section>
        </main>
      )}

      {game?.reign.ended && !departure && (
        <main
          className={`ending ending-${game.reign.ended.kind}`}
          key={`${game.id}-ending-${game.reign.number}`}
        >
          <p className="setting-line">
            Reign {game.reign.number} · {game.reign.turn} decisions
          </p>
          <h1>{game.reign.ended.title}</h1>
          <p className="ending-reason">{game.reign.ended.reason}</p>
          {
            <section className="succession">
              <h2>Who rules next?</h2>
              <div className="successor-options">
                {([0, 1] as const).map((c) => (
                  <button
                    key={c}
                    disabled={working}
                    onClick={() => void mutate("succeed", { coalition: c })}
                  >
                    <FactionIcon
                      faction={game.world.factions[c === 0 ? 0 : 2]!}
                    />
                    <span>{game.world.factions[c === 0 ? 0 : 2].name}</span>
                    <span aria-hidden="true">→</span>
                  </button>
                ))}
              </div>
            </section>
          }
          <button
            className="text-button"
            onClick={() => setDialog("chronicle")}
          >
            Read the chronicle
          </button>
        </main>
      )}

      {dialog && (
        <dialog
          ref={dialogRef}
          className={dialogClosing ? "dialog-closing" : ""}
          onCancel={(event) => {
            event.preventDefault();
            closeDialog();
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget) closeDialog();
          }}
          aria-labelledby="dialog-title"
        >
          <div className="dialog-header">
            <h2 id="dialog-title">
              {dialog === "menu"
                ? "Your game"
                : dialog === "chronicle"
                  ? "Chronicle"
                  : dialog === "world"
                    ? game?.world.name
                    : "How to play"}
            </h2>
            <button
              className="close-dialog"
              aria-label="Close menu"
              onClick={closeDialog}
            >
              ×
            </button>
          </div>
          <div className="dialog-body">
            {dialog !== "menu" && (
              <button
                className="text-button menu-back"
                onClick={() => setDialog("menu")}
              >
                ← Menu
              </button>
            )}
            {dialog === "menu" && (
              <nav className="game-menu" aria-label="Game menu">
                {game && (
                  <>
                    <button onClick={() => showWorld()}>
                      Your society<span>→</span>
                    </button>
                    <button onClick={() => setDialog("chronicle")}>
                      Chronicle<span>→</span>
                    </button>
                  </>
                )}
                <button onClick={() => setDialog("help")}>
                  How to play<span>→</span>
                </button>
                <button
                  aria-pressed={reducedMotion}
                  onClick={() => {
                    setMotionPreference(!reducedMotion);
                    write("swipe-republic:reduced-motion", !reducedMotion);
                  }}
                >
                  Reduce motion<span>{reducedMotion ? "On" : "Off"}</span>
                </button>
                <button disabled={working || checking} onClick={newSociety}>
                  Saved games<span>→</span>
                </button>
              </nav>
            )}
            {dialog === "help" && (
              <div className="help">
                <ol>
                  <li>Swipe left or right, or press a choice.</li>
                  <li>
                    Keep all four factions above zero. Tap an icon to learn what
                    it wants.
                  </li>
                  <li>
                    Promises return later. Your successor inherits your laws and
                    debts.
                  </li>
                </ol>
                <details>
                  <summary>Keyboard and game rules</summary>
                  <p>
                    Hold ← or → for 0.7 seconds to choose. Release early to
                    cancel. Release the key before making another decision.
                  </p>
                  <p>
                    Your reign lasts until a faction reaches zero or the reserve
                    runs out. A successor inherits your laws and unfinished
                    promises.
                  </p>
                  <p>
                    The arrows above a faction show its reaction. A question
                    mark means the judgment is uncertain. Major crises have
                    larger effects.
                  </p>
                </details>
                <p className="quiet">
                  Choices save automatically in this browser.
                </p>
              </div>
            )}
            {dialog === "world" && game && (
              <>
                <p>{game.world.summary}</p>
                <div className="world-factions">
                  {game.world.factions.map((f, i) => (
                    <details key={f.name} open={factionDetail === i}>
                      <summary>
                        <FactionIcon faction={f} />
                        {f.name}
                        <span>{game.reign.support[i]}</span>
                      </summary>
                      <p>{f.priority}</p>
                      <p className="quiet">Red line: {f.redLine}</p>
                    </details>
                  ))}
                </div>
                <details>
                  <summary>
                    Your people ({game.world.characters.length})
                  </summary>
                  <div className="people-list">
                    {game.world.characters.map((person, i) => (
                      <article key={i}>
                        <Portrait
                          character={person}
                          image={game.world.art?.[`portrait-${i}`]}
                        />
                        <div>
                          <h3>{person.name}</h3>
                          <p>
                            {person.role} ·{" "}
                            {game.world.factions[person.faction]?.name}
                          </p>
                          <p>{person.relationship ?? person.personality}</p>
                        </div>
                      </article>
                    ))}
                  </div>
                </details>
                <details>
                  <summary>Promises ({game.commitments.length})</summary>
                  {commitments}
                </details>
                <details>
                  <summary>Laws and resources</summary>
                  {game.legacies.map((l) => (
                    <p key={l}>{l}</p>
                  ))}
                  <div className="arrival-resources">
                    {game.world.resources.map((name, i) => (
                      <span key={name}>
                        {game.world.art?.[`resource-${i}`] && (
                          <img
                            src={game.world.art[`resource-${i}`]}
                            alt=""
                            width="44"
                            height="44"
                          />
                        )}
                        {name}
                      </span>
                    ))}
                  </div>
                </details>
              </>
            )}
            {dialog === "chronicle" && game && (
              <>
                <button
                  onClick={() => download(game)}
                  disabled={!game.history.length}
                >
                  Download chronicle
                </button>
                {game.history.length === 0 ? (
                  <p className="quiet">Your decisions will appear here.</p>
                ) : (
                  <ol className="chronicle-events">
                    {[...game.history].reverse().map((e) => (
                      <li key={e.turn}>
                        <span className="quiet">
                          {game.world.calendar} {e.turn} · Reign {e.reign}
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
        </dialog>
      )}
    </div>
  );
}
