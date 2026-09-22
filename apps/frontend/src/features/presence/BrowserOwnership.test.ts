import { afterEach, expect, test, vi } from "vitest";
import {
  createBrowserOwnership,
  type BrowserClaim,
  type BrowserCredential,
  type BrowserEnvironment,
} from "./BrowserOwnership";
afterEach(() => vi.useRealTimers());
const focused: BrowserEnvironment = {
  participating: true,
  online: true,
  visible: true,
  focused: true,
  account: null,
};
function tabs() {
  let epoch = 0;
  let stamp: BrowserClaim | null = null;
  let backend: BrowserCredential | null = null;
  const pages: { controller: ReturnType<typeof createBrowserOwnership> }[] = [];
  function page(tabId: string) {
    let owner: BrowserCredential | null = null;
    const claim = vi.fn(async (value: BrowserClaim) => {
      if (backend && value.epoch < backend.epoch) return null;
      backend = {
        id: "browser" as BrowserCredential["id"],
        epoch: value.epoch,
        capability: `cap-${value.epoch}`,
      };
      return backend;
    });
    const release = vi.fn(async (value: BrowserCredential) => {
      if (backend?.epoch === value.epoch) backend = null;
    });
    const report = vi.fn();
    const allocate = vi.fn(
      async (account: BrowserClaim["account"], current: () => boolean) => {
        if (!current()) return null;
        stamp = { secret: "a".repeat(64), epoch: ++epoch, tabId, account };
        return stamp;
      },
    );
    const controller = createBrowserOwnership(
      {
        allocate,
        claim,
        release,
        isCurrent: (value) =>
          stamp?.epoch === value.epoch && stamp.tabId === value.tabId,
      },
      (value) => {
        owner = value;
      },
      report,
    );
    const result = {
      controller,
      allocate,
      claim,
      release,
      report,
      get owner() {
        return owner;
      },
    };
    pages.push(result);
    return result;
  }
  return {
    page,
    notify: () => pages.forEach((p) => p.controller.observe()),
    get backend() {
      return backend;
    },
  };
}
test("newest focused eligible page takes over; followers do not claim on notifications or heartbeats", async () => {
  vi.useFakeTimers();
  const browser = tabs(),
    a = browser.page("a"),
    b = browser.page("b");
  a.controller.update(focused);
  b.controller.update({ ...focused, focused: false });
  await vi.advanceTimersByTimeAsync(1);
  expect(a.owner?.epoch).toBe(1);
  expect(b.allocate).not.toHaveBeenCalled();
  a.controller.update({ ...focused, focused: false });
  expect(a.owner?.epoch).toBe(1); // Leaving the window alone does not clear presence.
  b.controller.update(focused);
  await vi.advanceTimersByTimeAsync(1);
  browser.notify();
  expect(a.owner).toBeNull();
  expect(b.owner?.epoch).toBe(2);
  for (let i = 0; i < 3; i++) {
    a.controller.update({ ...focused, focused: false });
    b.controller.update(focused);
    browser.notify();
    await vi.advanceTimersByTimeAsync(10000);
  }
  expect(a.allocate).toHaveBeenCalledTimes(1);
  expect(b.allocate).toHaveBeenCalledTimes(1);
  a.controller.update(focused);
  b.controller.update({ ...focused, focused: false });
  await vi.advanceTimersByTimeAsync(1);
  browser.notify();
  expect(a.owner?.epoch).toBe(3);
  expect(b.owner).toBeNull();
  a.controller.dispose();
  b.controller.dispose();
});
test("late claim responses and releases cannot restore the previous owner", async () => {
  vi.useFakeTimers();
  const browser = tabs(),
    a = browser.page("a"),
    b = browser.page("b");
  let resolve!: (value: BrowserCredential) => void;
  a.claim.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  a.controller.update(focused);
  await vi.advanceTimersByTimeAsync(1);
  a.controller.update({ ...focused, focused: false });
  b.controller.update(focused);
  await vi.advanceTimersByTimeAsync(1);
  resolve({
    id: "browser" as BrowserCredential["id"],
    epoch: 1,
    capability: "cap-1",
  });
  await vi.advanceTimersByTimeAsync(1);
  expect(a.owner).toBeNull();
  expect(b.owner?.epoch).toBe(2);
  expect(browser.backend?.epoch).toBe(2);
  a.controller.dispose();
  b.controller.dispose();
});
test("claim retries reuse the epoch; a newer focused page cancels old retries", async () => {
  vi.useFakeTimers();
  const browser = tabs(),
    a = browser.page("a"),
    b = browser.page("b");
  a.claim.mockRejectedValueOnce(new Error("lost ACK"));
  a.controller.update(focused);
  await vi.advanceTimersByTimeAsync(101);
  expect(a.claim).toHaveBeenCalledTimes(2);
  expect(a.claim.mock.calls[0]).toEqual(a.claim.mock.calls[1]);
  expect(a.allocate).toHaveBeenCalledTimes(1);
  a.controller.update({ ...focused, focused: false });
  a.claim.mockRejectedValue(new Error("offline"));
  a.controller.update(focused);
  await vi.advanceTimersByTimeAsync(1);
  b.controller.update(focused);
  await vi.advanceTimersByTimeAsync(1);
  browser.notify();
  const calls = a.claim.mock.calls.length;
  await vi.advanceTimersByTimeAsync(10000);
  expect(a.claim).toHaveBeenCalledTimes(calls);
  expect(a.owner).toBeNull();
  expect(b.owner?.epoch).toBe(3);
  a.controller.dispose();
  b.controller.dispose();
});
test("account changes, reload and closing surfaces retire ownership; unsupported coordination stays unavailable", async () => {
  vi.useFakeTimers();
  const browser = tabs(),
    a = browser.page("a");
  a.controller.update(focused);
  await vi.advanceTimersByTimeAsync(1);
  a.controller.update({ ...focused, account: undefined });
  expect(a.owner).toBeNull();
  a.controller.update({
    ...focused,
    account: "user-b" as BrowserClaim["account"],
  });
  await vi.advanceTimersByTimeAsync(1);
  expect(a.claim.mock.lastCall?.[0]).toMatchObject({
    account: "user-b",
    epoch: 2,
  });
  a.controller.dispose();
  const reloaded = browser.page("reloaded");
  reloaded.controller.update(focused);
  await vi.advanceTimersByTimeAsync(1);
  expect(reloaded.owner?.epoch).toBe(3);
  reloaded.controller.update({ ...focused, participating: false });
  expect(reloaded.owner).toBeNull();
  reloaded.allocate.mockRejectedValueOnce(new Error("Web Locks unavailable"));
  reloaded.controller.update(focused);
  await vi.advanceTimersByTimeAsync(1);
  expect(reloaded.owner).toBeNull();
  expect(reloaded.report).toHaveBeenLastCalledWith(
    "Presence requires browser storage and Web Locks",
  );
  reloaded.controller.dispose();
});
