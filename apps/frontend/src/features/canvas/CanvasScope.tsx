import { createContext, useContext } from "react";
import type { Id } from "@pluribus/backend/dataModel";
export const CanvasScope = createContext<{ workspaceId?: Id<"workspaces">; onSelectionChange?: (ids: string[]) => void }>({});
export const useCanvasScope = () => useContext(CanvasScope);
