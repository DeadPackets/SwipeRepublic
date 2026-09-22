import { test, expect } from "bun:test";
import { readSocieties, rememberSociety } from "./storage";

test("independent society records preserve other tabs and more than thirty worlds", () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const values = new Map<string, string>();
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
    expect(readSocieties()).toHaveLength(36);
    expect(readSocieties().some((s) => s.id === "world-0")).toBe(true);
  } finally {
    if (previous) Object.defineProperty(globalThis, "localStorage", previous);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});
