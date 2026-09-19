import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  type ReactNode,
} from "react";
import { useStore } from "zustand";
import { useConvexAuth } from "convex/react";
import { useRetainedQuery } from "../../hooks/UseRetainedQuery";
import { api } from "@pluribus/backend/api";
import { createDocumentRecovery } from "./DocumentRecovery";
const Context = createContext<ReturnType<typeof createDocumentRecovery> | null>(
  null,
);
export function useDocumentRecovery() {
  const value = useContext(Context);
  if (!value) throw new Error("Document recovery provider missing");
  return value;
}
/** App lifetime lets pending copies outlive cards and route changes; nothing is persisted to disk. */
export function DocumentRecoveryProvider({
  children,
}: {
  children: ReactNode;
}) {
  const auth = useConvexAuth();
  const user = useRetainedQuery(api.Users.current, {}).data;
  const sessionKey = useRef("guest");
  // Token refresh/reconnection may temporarily be loading, not an account change.
  if (!auth.isLoading) {
    if (!auth.isAuthenticated) sessionKey.current = "guest";
    else if (user?.id) sessionKey.current = user.id;
    else if (sessionKey.current === "guest") sessionKey.current = "signed-in";
  }
  return <RecoverySession key={sessionKey.current}>{children}</RecoverySession>;
}
function RecoverySession({ children }: { children: ReactNode }) {
  const [store] = useState(createDocumentRecovery);
  const entries = useStore(store, (state) => state.entries);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (store.getState().entries.size) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [store]);
  return (
    <Context.Provider value={store}>
      {children}
      <div className="document-recovery-container">
        {[...entries]
          .filter(([, entry]) => entry.detached)
          .map(([scope, entry]) => (
            <aside key={scope} role="alert" className="document-recovery">
              <p>
                Local document edits retained in this tab. They may not have
                saved. Undo opens the saved document separately.
              </p>
              <details>
                <summary>View local recovery</summary>
                <textarea
                  aria-label="Local recovery copy"
                  readOnly
                  value={entry.text}
                />
              </details>
              <button
                onClick={() => {
                  const url = URL.createObjectURL(
                    new Blob([entry.json], { type: "application/json" }),
                  );
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = "DocumentRecovery.json";
                  link.click();
                  setTimeout(() => URL.revokeObjectURL(url), 0);
                }}
              >
                Download recovery
              </button>
              <button onClick={() => store.getState().discard(scope)}>
                Discard local recovery
              </button>
            </aside>
          ))}
      </div>
    </Context.Provider>
  );
}
