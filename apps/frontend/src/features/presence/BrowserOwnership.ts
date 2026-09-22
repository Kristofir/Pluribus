import type { FunctionArgs, FunctionReturnType } from "convex/server";
import type { api } from "@pluribus/backend/api";
export type BrowserClaim = FunctionArgs<typeof api.Presence.claimBrowser>;
export type BrowserCredential = NonNullable<
  FunctionReturnType<typeof api.Presence.claimBrowser>
>;
export type BrowserEnvironment = {
  participating: boolean;
  online: boolean;
  visible: boolean;
  focused: boolean;
  account: BrowserClaim["account"] | undefined;
};
export interface BrowserOwnershipPort {
  allocate(
    account: BrowserClaim["account"],
    current: () => boolean,
  ): Promise<BrowserClaim | null>;
  isCurrent(claim: BrowserClaim): boolean;
  claim(claim: BrowserClaim): Promise<BrowserCredential | null>;
  release(credential: BrowserCredential): Promise<unknown>;
}
/** Only focus/eligibility transitions claim ownership. Notifications never elect a follower. */
export function createBrowserOwnership(
  port: BrowserOwnershipPort,
  changed: (owner: BrowserCredential | null) => void,
  reportError: (error: string | null) => void,
) {
  let environment: BrowserEnvironment = {
    participating: false,
    online: false,
    visible: false,
    focused: false,
    account: undefined,
  };
  let owner: BrowserCredential | null = null;
  let ticket: BrowserClaim | null = null;
  let revision = 0,
    stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const eligible = () =>
    !stopped &&
    environment.participating &&
    environment.online &&
    environment.visible &&
    environment.focused &&
    environment.account !== undefined;
  function cancelAttempt() {
    revision++;
    clearTimeout(timer);
    timer = undefined;
    if (!owner) ticket = null;
  }
  function retire() {
    const previous = owner;
    owner = null;
    changed(null);
    if (previous) void port.release(previous).catch(() => {});
  }
  async function start() {
    cancelAttempt();
    retire();
    const attempt = revision;
    const current = () => attempt === revision && eligible();
    try {
      const claim = await port.allocate(environment.account!, current);
      if (!claim || !current() || !port.isCurrent(claim)) return;
      ticket = claim;
      let delay = 100;
      const send = async () => {
        if (!current()) return;
        try {
          if (!port.isCurrent(claim)) return;
          const accepted = await port.claim(claim);
          if (!current() || !port.isCurrent(claim)) {
            if (accepted) void port.release(accepted).catch(() => {});
            return;
          }
          if (!accepted) {
            ticket = null;
            reportError(null);
            return;
          }
          owner = accepted;
          changed(owner);
          reportError(null);
        } catch {
          if (!current()) return;
          reportError("Presence unavailable — retrying");
          timer = setTimeout(() => void send(), delay);
          delay = Math.min(delay * 2, 2000);
        }
      };
      await send();
    } catch {
      if (current())
        reportError("Presence requires browser storage and Web Locks");
    }
  }
  return {
    update(next: BrowserEnvironment) {
      const wasEligible = eligible(),
        accountChanged = next.account !== environment.account;
      environment = next;
      if (accountChanged || !next.participating || !next.online) {
        cancelAttempt();
        retire();
        ticket = null;
      } else if (!eligible()) cancelAttempt();
      if (eligible() && (!wasEligible || accountChanged)) void start();
    },
    observe() {
      try {
        if (!ticket || port.isCurrent(ticket)) return;
        cancelAttempt();
        retire();
        ticket = null;
        reportError(null);
      } catch {
        cancelAttempt();
        retire();
        ticket = null;
        reportError("Presence requires browser storage and Web Locks");
      }
    },
    dispose() {
      stopped = true;
      cancelAttempt();
      retire();
      ticket = null;
    },
  };
}
