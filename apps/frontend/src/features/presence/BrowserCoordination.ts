import type { BrowserClaim } from "./BrowserOwnership";
import { browserIdentity } from "./Identity";
type ClaimStamp = { secret: string; epoch: number; tabId: string };
/** Local storage is a private profile capability/counter; the backend fences each claim. */
export function createBrowserCoordination(scope: string, changed: () => void) {
  const key = `pluribus.presence:${scope}`;
  const channel =
    typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(key);
  function read(): ClaimStamp | null {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw) as ClaimStamp;
    if (
      !/^[0-9a-f]{64}$/.test(value.secret) ||
      !Number.isSafeInteger(value.epoch) ||
      value.epoch < 1 ||
      !/^[0-9a-f-]{36}$/.test(value.tabId)
    )
      throw new Error("Invalid browser coordination state");
    return value;
  }
  const storageChanged = (event: StorageEvent) => {
    if (event.key === key || event.key === null) changed();
  };
  window.addEventListener("storage", storageChanged);
  channel?.addEventListener("message", changed);
  return {
    async allocate(
      account: BrowserClaim["account"],
      current: () => boolean,
    ): Promise<BrowserClaim | null> {
      if (!navigator.locks) throw new Error("Web Locks unavailable");
      const identity = await browserIdentity();
      return navigator.locks.request(key, () => {
        if (!current()) return null;
        const previous = read();
        const secret =
          previous?.secret ??
          Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) =>
            byte.toString(16).padStart(2, "0"),
          ).join("");
        const epoch = (previous?.epoch ?? 0) + 1;
        if (!Number.isSafeInteger(epoch))
          throw new Error("Browser epoch exhausted");
        const value = { secret, epoch, tabId: identity.tabId };
        localStorage.setItem(key, JSON.stringify(value));
        channel?.postMessage({ epoch });
        return { ...value, account };
      });
    },
    isCurrent(claim: BrowserClaim) {
      const value = read();
      return (
        value?.epoch === claim.epoch &&
        value.secret === claim.secret &&
        value.tabId === claim.tabId
      );
    },
    dispose() {
      window.removeEventListener("storage", storageChanged);
      channel?.close();
    },
  };
}
