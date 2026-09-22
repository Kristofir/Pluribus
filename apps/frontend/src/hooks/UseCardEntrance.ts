import { useState, type CSSProperties } from "react";
/** One delay per mounted card; edits and position updates do not reshuffle it. */
export function useCardEntrance(): CSSProperties {
  const [style] = useState<CSSProperties>(() => ({
    animationDelay: `${Math.floor(Math.random() * 181)}ms`,
  }));
  return style;
}
