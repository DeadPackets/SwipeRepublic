import type { GameSession } from "../useGame";
import { Countdown, Progress } from "./Arrival";

export function Founding({ session }: { session: GameSession }) {
  const loading = session.working || session.busy;
  return (
    <div className="founding">
      <span className="seal" data-breathing={loading || undefined} aria-hidden="true">
        R
      </span>
      <h1 tabIndex={-1} data-autofocus>
        {loading ? "Opening your world…" : "Your game is saved."}
      </h1>
      <p>{loading ? "Preparing your society, its people and its first visitor." : "Try again to continue."}</p>
      {loading && (session.creation ? <Progress creation={session.creation} /> : <Countdown />)}
    </div>
  );
}
