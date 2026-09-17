import { guestProfile } from "@pluribus/core/presence/domain";
let identity:
  | Promise<{ guestId: string; tabId: string; name: string; color: string }>
  | undefined;
export function browserIdentity() {
  return (identity ??= (async () => {
    const get = () => {
      let id = localStorage.getItem("pluribus.guest");
      if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
        id = crypto.randomUUID();
        localStorage.setItem("pluribus.guest", id);
      }
      return id;
    };
    const guestId = navigator.locks
      ? await navigator.locks.request("pluribus.guest", get)
      : get();
    return { guestId, tabId: crypto.randomUUID(), ...guestProfile(guestId) };
  })());
}
