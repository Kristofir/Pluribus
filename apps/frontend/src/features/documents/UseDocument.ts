import { useSyncExternalStore } from "react";
import { useConvexConnectionState } from "convex/react";

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}
export function useDocumentConnection() {
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => false,
  );
  const connection = useConvexConnectionState();
  return online && connection.isWebSocketConnected;
}
