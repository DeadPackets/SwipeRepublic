import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, animate, m } from "motion/react";
import type { Side } from "../game";
import type { GameSession } from "../useGame";
import { DecisionCard, type CardView, type Leaving } from "../play/DecisionCard";
import { Meters } from "../play/Meters";
import { cardView, deathView, roman, successionView } from "../play/faces";
import { useArrowHold } from "../useArrowHold";
import { DRAG, FADE, MILESTONES, MOURN, TOAST, useReduced } from "../motion";
import { chime, haptic, sting, whoosh } from "../feedback";

type Thrown = { view: CardView; leaving: Leaving; gone: () => void };
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function Year({ value }: { value: number }) {
  const reduced = useReduced();
  const node = useRef<HTMLSpanElement>(null);
  const shown = useRef(value);
  useLayoutEffect(() => {
    const el = node.current!;
    const from = shown.current;
    shown.current = value;
    if (reduced || from === value) {
      el.textContent = String(value);
      return;
    }
    const roll = animate(from, value, { duration: 0.5, onUpdate: (v) => (el.textContent = String(Math.round(v))) });
    animate(el, { filter: ["blur(4px)", "blur(0px)"], y: [-6, 0] }, { duration: 0.5 });
    return () => roll.stop();
  }, [value]);
  return <span ref={node} className="year-number" />;
}

export function Play({
  session,
  dialogOpen,
  onFaction,
}: {
  session: GameSession;
  dialogOpen: boolean;
  onFaction: (index: number) => void;
}) {
  const game = session.game!;
  const reduced = useReduced();
  const surface = useRef<HTMLElement>(null);
  const [preview, setPreview] = useState<Side | null>(null);
  const [thrown, setThrown] = useState<Thrown | null>(null);
  const [beat, setBeat] = useState<"mourning" | "death" | null>(null);
  const [toast, setToast] = useState<{ text: string; key: number } | null>(null);
  const [status, setStatus] = useState("");
  const [attempt, setAttempt] = useState(0);

  const ending = game.endings.at(-1);
  const current: CardView | null =
    beat === "death" && ending
      ? deathView(game, ending)
      : beat === "mourning" || !game.card
        ? null
        : game.card.kind === "succession"
          ? successionView(game, game.card)
          : cardView(game, game.card);
  const mourning = beat !== null || game.card?.kind === "succession";
  const reactions =
    preview !== null && !thrown && !beat && game.card && game.card.kind !== "succession"
      ? game.card.reactions[preview]!
      : null;
  const ready = !!current && !thrown && !session.working && !dialogOpen && !session.error;

  function say(text: string, celebrate = false) {
    setToast({ text, key: Date.now() });
    setStatus(text);
    if (celebrate) chime();
  }
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST.hold + 400);
    return () => clearTimeout(timer);
  }, [toast]);

  function choose(side: Side, velocity: number) {
    if (!ready || !current) return false;
    const view = current;
    let gone!: () => void;
    const flown = new Promise<void>((resolve) => (gone = resolve));
    haptic(15);
    whoosh();
    setPreview(null);
    setThrown({ view, leaving: { side, velocity }, gone });
    void (async () => {
      if (view.kind === "death") {
        await flown;
        setThrown(null);
        setBeat(null);
        return;
      }
      const before = game;
      const next = await session.choose(game.card!.id, side);
      await flown;
      if (next && next.endings.length > before.endings.length) {
        setBeat("mourning");
        setThrown(null);
        const death = next.endings.at(-1)!;
        setStatus(`${death.title}. ${death.reason}`);
        haptic([30, 40, 80]);
        sting();
        await wait(reduced ? 400 : MOURN.flare.duration * 1000 + MOURN.hold);
        setBeat("death");
        return;
      }
      setThrown(null);
      if (!next || next.version === before.version) {
        setAttempt((n) => n + 1);
        return;
      }
      if (next.reign.number > before.reign.number) say(`Reign ${roman(next.reign.number)} begins`, true);
      else if (MILESTONES.includes(next.reign.turn)) say(`${next.reign.turn} decisions in office`, true);
      else setStatus(next.history.at(-1)?.consequence ?? "");
    })();
    return true;
  }

  const hold = useArrowHold({
    enabled: ready,
    cardId: current?.key,
    surface,
    onSelect: (side) => setPreview(side),
    onChoose: (side) => choose(side, side ? DRAG.keySpeed : -DRAG.keySpeed),
  });
  const hover = (side: Side | null) => {
    if (!hold.holding() && !thrown) setPreview(side);
  };

  const last = game.history.at(-1);
  const hint =
    game.card?.kind === "succession" || beat
      ? ""
      : game.totalTurns === 0 && !thrown
      ? "Keep every faction between empty and full. Too much love is as fatal as none."
      : last?.reign === game.reign.number
        ? last.consequence
        : "";
  const shown = thrown?.view ?? current;
  const options = shown?.options;
  return (
    <main ref={surface} className="play" data-mourning={mourning || undefined} aria-labelledby="play-title">
      <header className="play-header">
        <h1 id="play-title" tabIndex={-1}>
          {game.world.name}
        </h1>
        <p>
          <span>
            {game.world.calendar} <Year value={game.totalTurns + 1} />
          </span>
          <span className="reign-number">Reign {roman(game.reign.number)}</span>
        </p>
      </header>
      <Meters
        factions={game.world.factions}
        support={game.reign.support}
        reactions={reactions}
        last={last}
        hit={game.history.length}
        fatal={mourning && ending?.faction != null ? ending.faction : null}
        flare={beat === "mourning"}
        onOpen={onFaction}
      />
      <div className="deck">
        <div className="deck-peek" aria-hidden="true" />
        <div className="deck-peek" aria-hidden="true" />
        {shown && (
          <DecisionCard
            key={`${shown.key}-${attempt}`}
            view={shown}
            preview={thrown ? null : preview}
            leaving={thrown?.leaving ?? null}
            disabled={!ready}
            onPreview={setPreview}
            onChoose={choose}
            onGone={thrown?.gone}
          />
        )}
        {!thrown && !current && !beat && (
          <m.div className="card-waiting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={FADE}>
            <span className="seal" aria-hidden="true">
              R
            </span>
            <p>{session.error ? "Your choice is saved." : "The next visitor is on their way…"}</p>
          </m.div>
        )}
      </div>
      <div className="choices">
        {[0, 1].map((i) => (
          <button
            key={i}
            className={`choice choice-${i}`}
            disabled={!ready}
            data-previewing={preview === i || undefined}
            aria-keyshortcuts={i === 0 ? "ArrowLeft" : "ArrowRight"}
            aria-describedby="controls-hint"
            onPointerEnter={(e) => e.pointerType === "mouse" && hover(i as Side)}
            onPointerLeave={() => hover(null)}
            onFocus={() => hover(i as Side)}
            onBlur={() => hover(null)}
            onClick={() => choose(i as Side, 0)}
          >
            {i === 0 && <span aria-hidden="true">←</span>}
            <span>{options?.[i] ?? " "}</span>
            {i === 1 && <span aria-hidden="true">→</span>}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <m.p
          key={hint}
          className="hint"
          initial={{ opacity: 0, y: reduced ? 0 : 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={reduced ? FADE : { duration: 0.35 }}
        >
          {hint}
        </m.p>
      </AnimatePresence>
      <p className="controls-hint" id="controls-hint">
        Swipe, tap a choice, or hold ← / → for 0.7 s.
      </p>
      <p className="sr-only" role="status">
        {status}
      </p>
      {!session.storageOK && <p className="storage-warning">Saving is unavailable. Keep this tab open.</p>}
      <div className="mourning-veil" aria-hidden="true" />
      <AnimatePresence>
        {toast && (
          <m.div
            key={toast.key}
            className="toast"
            aria-hidden="true"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: -14, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: reduced ? 0 : -10 }}
            transition={reduced ? FADE : TOAST.spring}
          >
            {toast.text}
          </m.div>
        )}
      </AnimatePresence>
    </main>
  );
}
