import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import type { ElementId, Geometry } from "@pluribus/core/canvas/domain";
import type { CanvasNode } from "./CanvasNodes";

/** Animate only changes in snap correction; pointer motion and saved geometry stay immediate. */
export function useSnapAnimation(
  surface: RefObject<HTMLDivElement | null>,
  nodes: CanvasNode[],
  enabled: boolean,
) {
  const pending = useRef(
    new Map<ElementId, { delta: Partial<Geometry>; geometry: Geometry }>(),
  );
  const animations = useRef(new Map<HTMLElement, Animation>());
  useEffect(() => {
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const cancel = () => {
      for (const animation of animations.current.values()) animation.cancel();
      animations.current.clear();
      pending.current.clear();
    };
    preference.addEventListener("change", cancel);
    return () => {
      preference.removeEventListener("change", cancel);
      cancel();
    };
  }, []);
  useLayoutEffect(() => {
    if (!enabled || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      for (const animation of animations.current.values()) animation.cancel();
      animations.current.clear();
      pending.current.clear();
      return;
    }
    for (const [id, { delta, geometry }] of pending.current) {
      const node = surface.current?.querySelector<HTMLElement>(
        `.react-flow__node[data-id="${CSS.escape(id)}"]`,
      );
      if (!node) continue;
      // Retarget from the in-flight visual offset when a snap changes quickly.
      const style = getComputedStyle(node);
      const translation =
        style.translate === "none"
          ? [0, 0]
          : style.translate.split(" ").map(parseFloat);
      const matrix = new DOMMatrixReadOnly(style.transform);
      const scale = [matrix.a, matrix.d];
      animations.current.get(node)?.cancel();
      const x = (translation[0] ?? 0) + (delta.x ?? 0);
      const y = (translation[1] ?? 0) + (delta.y ?? 0);
      const sx = (scale[0] ?? 1) * (1 + (delta.width ?? 0) / geometry.width);
      const sy =
        (scale[1] ?? scale[0] ?? 1) *
        (1 + (delta.height ?? 0) / geometry.height);
      const animation = node.animate(
        [
          {
            translate: `${x}px ${y}px`,
            transform: `scale(${sx}, ${sy})`,
            composite: "add",
            transformOrigin: "0 0",
          },
          {
            translate: "0px 0px",
            transform: "scale(1, 1)",
            composite: "add",
            transformOrigin: "0 0",
          },
        ],
        { duration: 140, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
      );
      animations.current.set(node, animation);
      animation.onfinish = () => {
        if (animations.current.get(node) === animation)
          animations.current.delete(node);
      };
    }
    pending.current.clear();
  }, [nodes, enabled, surface]);
  return pending;
}
