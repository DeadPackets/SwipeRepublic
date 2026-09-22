import { useEffect, useRef, useState } from "react";
import { AnimatePresence, LazyMotion, MotionConfig, domAnimation, m } from "motion/react";
import { useGame } from "./useGame";
import { readStored, writeStored } from "./storage";
import { ReducedMotion, SCREEN, screenMotion } from "./motion";
import { Welcome } from "./screens/Welcome";
import { Founding } from "./screens/Founding";
import { Arrival } from "./screens/Arrival";
import { Play } from "./screens/Play";
import { Chronicle } from "./screens/Chronicle";
import { MenuDialog, type Panel } from "./MenuDialog";

const MOTION_KEY = "swipe-republic:reduced-motion";

function useReducedMotion() {
  const [preference, setPreference] = useState(() => {
    const value = readStored(MOTION_KEY);
    return typeof value === "boolean" ? value : null;
  });
  const [system, setSystem] = useState(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setSystem(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const reduced = preference ?? system;
  return [
    reduced,
    (value: boolean) => {
      setPreference(value);
      writeStored(MOTION_KEY, value);
    },
  ] as const;
}

export default function App() {
  const session = useGame();
  const { id, game, error, working, checking } = session;
  const [reduced, setReduced] = useReducedMotion();
  const [menu, setMenu] = useState<{ panel: Panel; faction: number | null } | null>(null);
  const root = useRef<HTMLDivElement>(null);

  const screen = !id
    ? "welcome"
    : !game
      ? "founding"
      : game.phase === "intro"
        ? "arrival"
        : game.phase === "playing"
          ? "play"
          : "chronicle";
  const leave = () => {
    setMenu(null);
    session.leave();
  };

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [screen, id]);

  return (
    <ReducedMotion.Provider value={reduced}>
      <MotionConfig reducedMotion={reduced ? "always" : "never"}>
        <LazyMotion features={domAnimation} strict>
          <div ref={root} className="app" data-screen={screen} data-motion={reduced ? "reduced" : "full"}>
            <AnimatePresence>
              {game?.world.background && (
                <m.div
                  key={game.world.background}
                  className="world-scene"
                  aria-hidden="true"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reduced ? 0.12 : 1.6 }}
                >
                  <img src={game.world.background} alt="" fetchPriority="high" />
                </m.div>
              )}
            </AnimatePresence>
            <div className="world-vignette" aria-hidden="true" />
            <header className="masthead">
              <button className="wordmark" onClick={leave} disabled={working || checking}>
                Swipe Republic
              </button>
              <button className="menu-button" onClick={() => setMenu({ panel: "menu", faction: null })}>
                Menu
              </button>
            </header>
            <AnimatePresence>
              {error && (
                <m.div
                  className="error-banner"
                  role="alert"
                  initial={{ opacity: 0, y: reduced ? 0 : -12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reduced ? 0.12 : 0.3, ease: SCREEN.ease }}
                >
                  <p>{error}</p>
                  <button onClick={() => void session.retry()} disabled={working} aria-busy={working}>
                    Try again
                  </button>
                  <button className="text-button" onClick={leave}>
                    Saved games
                  </button>
                </m.div>
              )}
            </AnimatePresence>
            <AnimatePresence
              mode="wait"
              initial={false}
              onExitComplete={() => root.current?.querySelector<HTMLElement>("main [data-autofocus], main h1")?.focus()}
            >
              <m.main key={`${screen}-${id}`} className={`screen screen-${screen}`} {...screenMotion(reduced)}>
                {screen === "welcome" && <Welcome session={session} />}
                {screen === "founding" && <Founding session={session} />}
                {screen === "arrival" && game && (
                  <Arrival
                    world={game.world}
                    creation={session.creation}
                    working={working}
                    onStart={() => void session.start()}
                  />
                )}
                {screen === "play" && (
                  <Play
                    session={session}
                    dialogOpen={!!menu}
                    onFaction={(faction) => setMenu({ panel: "world", faction })}
                  />
                )}
                {screen === "chronicle" && game && <Chronicle game={game} onNew={leave} />}
              </m.main>
            </AnimatePresence>
            {menu && (
              <MenuDialog
                initial={menu.panel}
                faction={menu.faction}
                game={game}
                working={working}
                error={error}
                reducedPreference={reduced}
                onReducedPreference={setReduced}
                onSavedGames={leave}
                onAbandon={async () => {
                  if ((await session.abandon())?.phase === "over") setMenu(null);
                }}
                onClose={() => setMenu(null)}
              />
            )}
          </div>
        </LazyMotion>
      </MotionConfig>
    </ReducedMotion.Provider>
  );
}
