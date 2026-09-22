import { afterEach, expect, test, vi } from "vitest";
import {
  forgetOAuthAttempt,
  oauthAttemptPending,
  rememberOAuthAttempt,
} from "./OAuthAttempt";

function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

test("OAuth return keeps the guest session suspended across route remounts", () => {
  vi.stubGlobal("sessionStorage", storage());
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-22T17:00:00Z"));

  rememberOAuthAttempt();
  expect(oauthAttemptPending("123456", true)).toBe(true);
  expect(oauthAttemptPending()).toBe(true);

  forgetOAuthAttempt();
  expect(oauthAttemptPending()).toBe(false);
});

test("a cancelled or stale OAuth attempt returns to the guest demo", () => {
  vi.stubGlobal("sessionStorage", storage());
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-22T17:00:00Z"));

  rememberOAuthAttempt();
  expect(oauthAttemptPending(undefined, true)).toBe(false);

  rememberOAuthAttempt();
  vi.advanceTimersByTime(5 * 60 * 1000);
  expect(oauthAttemptPending()).toBe(false);
});
