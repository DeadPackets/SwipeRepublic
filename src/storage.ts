export type SavedSociety = { id: string; prompt: string; name: string };
export const SOCIETY_PREFIX = "swipe-republic:society:v1:";
const LEGACY_KEY = "swipe-republic:societies";

export function readStored(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}
export function writeStored(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
function isSave(value: unknown): value is SavedSociety {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.prompt === "string" &&
    typeof item.name === "string"
  );
}
export function readSocieties(): SavedSociety[] {
  const old = readStored(LEGACY_KEY);
  const saves = new Map<string, SavedSociety>();
  if (Array.isArray(old))
    for (const item of old) if (isSave(item)) saves.set(item.id, item);
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(SOCIETY_PREFIX)) continue;
      const item = readStored(key);
      if (isSave(item)) saves.set(item.id, item);
    }
  } catch {
    /* Private browsing can deny access to storage. */
  }
  return [...saves.values()];
}
export function rememberSociety(save: SavedSociety) {
  return writeStored(`${SOCIETY_PREFIX}${save.id}`, save);
}

export function clearPreResetSaves(hostname: string) {
  if (
    ![
      "swiperepublic.deadpackets.pw",
      "swipe-republic.b00073615.workers.dev",
    ].includes(hostname)
  )
    return;
  const marker = "swipe-republic:reset:2026-09-22-purge-2";
  try {
    if (localStorage.getItem(marker)) return;
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (
        key &&
        (key === "swipe-republic:active" ||
          key === LEGACY_KEY ||
          key.startsWith(SOCIETY_PREFIX) ||
          key.startsWith("swipe-republic:creation:") ||
          key.startsWith("swipe-republic:action:"))
      )
        localStorage.removeItem(key);
    }
    localStorage.setItem(marker, "done");
  } catch {
    // Storage can be unavailable in private browsing.
  }
}
