import { createContext, useContext, type ReactNode } from "react";
import type { Id } from "@pluribus/backend/dataModel";
export const CanvasScope = createContext<{
  workspaceId?: Id<"workspaces">;
  mainPaper?: ReactNode;
  paperFocus?: number;
  onSelectionChange?: (ids: string[]) => void;
}>({});
export const useCanvasScope = () => useContext(CanvasScope);
