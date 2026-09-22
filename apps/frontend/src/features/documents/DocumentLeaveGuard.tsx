import { createContext } from "react";

/** Demo edits reset on load; regular documents still protect pending work. */
export const DocumentLeaveGuard = createContext(true);
