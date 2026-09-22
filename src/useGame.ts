import { useEffect, useRef, useState } from "react";
import type { PublicGame, Side } from "./game";
import type { CampaignMatch } from "../worker/campaigns";
import {
  readSocieties,
  readStored,
  rememberSociety,
  SOCIETY_PREFIX,
  writeStored,
  type SavedSociety,
} from "./storage";

export type CreationProgress = { done: number; total: number; stage: string };
type Envelope = {
  game: PublicGame | null;
  busy: boolean;
  error?: string;
  id: string;
  creation?: CreationProgress | null;
};
type Action = { path: string; body: Record<string, unknown> };
export type Lookup = { matches: CampaignMatch[]; unavailable?: boolean };

const ACTIVE_KEY = "swipe-republic:active";
const PENDING_NAME = "A republic taking shape";
const creationKey = (id: string) => `swipe-republic:creation:${id}`;
const actionKey = (id: string) => `swipe-republic:action:${id}`;

async function api<T = Envelope>(path: string, body?: Record<string, unknown>): Promise<T> {
  const response = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok || !data)
    throw new Error(
      data?.error ||
        (response.status === 404
          ? "This society could not be found in this browser."
          : "The republic lost its connection. Your last saved decision is safe."),
    );
  return data;
}
async function ensureSession() {
  if (!navigator.locks)
    throw new Error(
      "This browser cannot save a guest session safely. Open the game in a current browser over HTTPS.",
    );
  await navigator.locks.request("swipe-republic:guest-session", () => api("/api/health"));
}

export function useGame() {
  const [saves, setSaves] = useState<SavedSociety[]>(readSocieties);
  const [id, setId] = useState<string | null>(() => {
    const value = readStored(ACTIVE_KEY);
    return typeof value === "string" ? value : null;
  });
  const active = useRef(id);
  const [game, setGame] = useState<PublicGame | null>(null);
  const gameRef = useRef(game);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [working, setWorking] = useState(Boolean(id));
  const lock = useRef(false);
  const [error, setError] = useState("");
  const [storageOK, setStorageOK] = useState(true);
  const [creation, setCreation] = useState<CreationProgress | null>(null);
  const [prompt, setPrompt] = useState("");
  const [checking, setChecking] = useState(false);
  const [lookup, setLookup] = useState<Lookup | null>(null);

  function remember(save: SavedSociety) {
    const saved = rememberSociety(save);
    setStorageOK(saved);
    setSaves((previous) => [
      save,
      ...(saved ? readSocieties() : previous).filter((item) => item.id !== save.id),
    ]);
  }
  function switchId(next: string | null) {
    active.current = next;
    setId(next);
    setStorageOK(writeStored(ACTIVE_KEY, next));
  }
  function accept(data: Envelope, expected: string) {
    if (active.current !== expected) return;
    const current = gameRef.current;
    if (current?.id === expected && data.game && data.game.version < current.version) return;
    gameRef.current = data.game;
    setGame(data.game);
    setBusy(data.busy);
    setCreation(data.creation ?? null);
    setError(
      data.error ||
        (!data.game && !data.busy ? "Your society is not ready yet. Retry to finish preparing it." : ""),
    );
    setRevision((value) => value + 1);
    if (data.game)
      remember({ id: data.game.id, prompt: data.game.prompt, name: data.game.world.name });
  }
  async function run(target: string, work: () => Promise<void>) {
    lock.current = true;
    setWorking(true);
    setError("");
    try {
      await work();
    } catch (cause) {
      if (active.current === target) setError((cause as Error).message);
    } finally {
      lock.current = false;
      if (active.current === target) setWorking(false);
    }
  }

  async function resume(target: string) {
    switchId(target);
    gameRef.current = null;
    setGame(null);
    await run(target, async () => accept(await api(`/api/games/${target}`), target));
  }
  useEffect(() => {
    if (active.current) void resume(active.current);
    const update = (event: StorageEvent) => {
      if (event.key === null || event.key.startsWith(SOCIETY_PREFIX)) setSaves(readSocieties());
    };
    window.addEventListener("storage", update);
    return () => window.removeEventListener("storage", update);
  }, []);

  async function findWorlds() {
    if (lock.current || prompt.trim().length < 5) return;
    lock.current = true;
    setChecking(true);
    setError("");
    try {
      await ensureSession();
      const result = await api<Lookup>("/api/campaigns/match", { prompt: prompt.trim() });
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
    const pending = !campaignId && saves.find((s) => s.prompt === setting && s.name === PENDING_NAME);
    const target = pending ? pending.id : crypto.randomUUID();
    switchId(target);
    remember({ id: target, prompt: setting, name: PENDING_NAME });
    gameRef.current = null;
    setGame(null);
    setCreation(null);
    setBusy(false);
    await run(target, async () => {
      await ensureSession();
      const body = { id: target, prompt: setting, ...(campaignId ? { campaignId } : {}) };
      writeStored(creationKey(target), body);
      accept(await api("/api/games", body), target);
    });
  }
  async function mutate(kind: string, extra: Record<string, unknown> = {}) {
    const current = gameRef.current;
    if (!current || lock.current) return null;
    const target = current.id;
    const action: Action = {
      path: `/api/games/${target}/${kind}`,
      body: { ...extra, requestId: crypto.randomUUID(), version: current.version },
    };
    writeStored(actionKey(target), action);
    await run(target, async () => {
      const data = await api(action.path, action.body);
      writeStored(actionKey(target), null);
      accept(data, target);
    });
    return gameRef.current;
  }
  async function retry() {
    if (lock.current) return;
    if (!id) return findWorlds();
    const target = id;
    await run(target, async () => {
      const save = saves.find((s) => s.id === target);
      const recreate = () =>
        api(
          "/api/games",
          (readStored(creationKey(target)) as Record<string, unknown> | null) ?? {
            id: target,
            prompt: save!.prompt,
          },
        );
      let data: Envelope;
      try {
        data = await api(`/api/games/${target}`);
      } catch (cause) {
        if (save?.name !== PENDING_NAME) throw cause;
        data = await recreate();
      }
      const action = readStored(actionKey(target)) as Action | null;
      if (action) {
        if (!data.game || data.game.version === action.body.version)
          data = await api(action.path, action.body);
        writeStored(actionKey(target), null);
      }
      if (!data.busy && !data.game && save) {
        await ensureSession();
        data = await recreate();
      }
      if (!data.busy && (data.creation || (data.game?.phase === "playing" && !data.game.card)))
        data = await api(`/api/games/${target}/prepare`, {});
      accept(data, target);
    });
  }

  useEffect(() => {
    if (!id || working || error || !busy || (game?.card && !creation) || game?.phase === "over") return;
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
    if (!game || game.phase !== "playing" || game.card || busy || working || error || lock.current)
      return;
    const target = game.id;
    void run(target, async () => {
      const data = await api(`/api/games/${target}/prepare`, {});
      accept(data, target);
      if (active.current === target && !data.busy && !data.game?.card)
        throw new Error("The next visitor is not ready. Try again to continue.");
    });
  }, [game, busy, working, error]);

  function leave() {
    switchId(null);
    gameRef.current = null;
    setGame(null);
    setBusy(false);
    setWorking(false);
    setError("");
    setCreation(null);
    setLookup(null);
  }

  return {
    saves,
    id,
    game,
    busy,
    working,
    error,
    storageOK,
    creation,
    prompt,
    checking,
    lookup,
    setPrompt: (value: string) => {
      setPrompt(value);
      setLookup(null);
    },
    clearLookup: () => setLookup(null),
    findWorlds,
    create,
    resume,
    retry,
    leave,
    start: () => mutate("start"),
    abandon: () => mutate("abandon"),
    choose: (cardId: string, side: Side) => mutate("choose", { cardId, side }),
  };
}
export type GameSession = ReturnType<typeof useGame>;
