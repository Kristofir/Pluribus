import { afterEach, expect, test, vi } from "vitest";
import { readViewport, saveViewport } from "./SavedViewport";
afterEach(() => vi.unstubAllGlobals());
test("restores center and zoom across viewport sizes and workspace keys", () => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
  saveViewport("one", { x: -100, y: -200, zoom: 2 }, 800, 600);
  expect(readViewport("one", 1000, 800)).toEqual({ x: 0, y: -100, zoom: 2 });
  expect(readViewport("two", 1000, 800)).toBeNull();
  values.set("one", '{"centerX":0,"centerY":0,"zoom":0}');
  expect(readViewport("one", 800, 600)).toBeNull();
});
test("unavailable storage is harmless", () => {
  vi.stubGlobal("localStorage", {
    getItem: () => {
      throw Error();
    },
    setItem: () => {
      throw Error();
    },
  });
  expect(readViewport("one", 800, 600)).toBeNull();
  expect(() =>
    saveViewport("one", { x: 0, y: 0, zoom: 1 }, 800, 600),
  ).not.toThrow();
});
