import { test, expect } from "bun:test";
import { readSocieties, rememberSociety } from "./storage";

test("independent society records preserve other tabs, legacy saves, and more than thirty worlds", () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const values = new Map<string, string>([
    [
      "swipe-republic:societies",
      JSON.stringify([{ id: "legacy", name: "Old world", prompt: "Old" }]),
    ],
  ]);
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      key: (index: number) => [...values.keys()][index] ?? null,
      get length() {
        return values.size;
      },
    },
  });
  try {
    const firstTab = readSocieties();
    const secondTab = readSocieties();
    expect(firstTab).toEqual(secondTab);
    for (let i = 0; i < 35; i++)
      rememberSociety({
        id: `world-${i}`,
        name: `World ${i}`,
        prompt: "A society",
      });
    rememberSociety({ id: "other-tab", name: "Another world", prompt: "Mars" });
    expect(readSocieties()).toHaveLength(37);
    expect(readSocieties().some((s) => s.id === "world-0")).toBe(true);
    expect(readSocieties().some((s) => s.id === "legacy")).toBe(true);
  } finally {
    if (previous) Object.defineProperty(globalThis, "localStorage", previous);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});

test("production reset clears only old save pointers once and leaves local development intact", async () => {
  const { clearPreResetSaves } = await import("./storage");
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const values = new Map<string, string>([
    ["swipe-republic:active", '"old"'],
    ["swipe-republic:societies", "[]"],
    ["swipe-republic:society:v1:old", "{}"],
    ["swipe-republic:creation:old", "{}"],
    ["swipe-republic:action:old", "{}"],
    ["swipe-republic:reset:2026-09-22", "done"],
    ["swipe-republic:motion", '"reduced"'],
    ["other-app", "keep"],
  ]);
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      key: (index: number) => [...values.keys()][index] ?? null,
      get length() {
        return values.size;
      },
    },
  });
  try {
    clearPreResetSaves("127.0.0.1");
    expect(values.has("swipe-republic:active")).toBe(true);
    clearPreResetSaves("swiperepublic.deadpackets.pw");
    expect(values.has("swipe-republic:active")).toBe(false);
    expect(values.has("swipe-republic:societies")).toBe(false);
    expect(values.has("swipe-republic:society:v1:old")).toBe(false);
    expect(values.get("swipe-republic:motion")).toBe('"reduced"');
    expect(values.get("other-app")).toBe("keep");
    expect(values.has("swipe-republic:creation:old")).toBe(false);
    expect(values.has("swipe-republic:action:old")).toBe(false);
    values.set("swipe-republic:society:v1:new", "{}");
    clearPreResetSaves("swiperepublic.deadpackets.pw");
    expect(values.has("swipe-republic:society:v1:new")).toBe(true);
  } finally {
    if (previous) Object.defineProperty(globalThis, "localStorage", previous);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});
