import {
  useEffect,
  useRef,
  useState,
  type RefObject,
  type PointerEvent,
} from "react";
import { DocumentPress } from "./DocumentPress";

export function useDocumentInteraction(
  card: RefObject<HTMLElement | null>,
  {
    editing,
    editable,
    activate,
  }: {
    editing: boolean;
    editable: boolean;
    activate: (value: boolean) => void;
  },
) {
  const press = useRef(new DocumentPress());
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(
    null,
  );
  const current = useRef({ editing, editable, activate });
  current.current = { editing, editable, activate };
  useEffect(() => {
    const move = (event: globalThis.PointerEvent) =>
      press.current.move(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });
    const release = (event: globalThis.PointerEvent) => {
      const point = { x: event.clientX, y: event.clientY };
      if (
        press.current.release(event.pointerId, point) &&
        current.current.editable &&
        card.current?.contains(event.target as Node)
      ) {
        setFocusPoint(point);
        current.current.activate(true);
      }
    };
    const cancel = () => press.current.cancel();
    const outside = (event: globalThis.PointerEvent) => {
      if (
        current.current.editing &&
        !card.current?.contains(event.target as Node)
      )
        current.current.activate(false);
    };
    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerup", release, true);
    window.addEventListener("pointercancel", cancel, true);
    window.addEventListener("blur", cancel);
    window.addEventListener("pointerdown", outside, true);
    return () => {
      cancel();
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", release, true);
      window.removeEventListener("pointercancel", cancel, true);
      window.removeEventListener("blur", cancel);
      window.removeEventListener("pointerdown", outside, true);
    };
  }, [card]);
  useEffect(() => {
    if (!editable) press.current.cancel();
  }, [editable]);
  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (!editable || event.button !== 0 || !event.isPrimary) return;
    const target = event.target as HTMLElement;
    if (
      target.closest(".react-flow__resize-control, button, input, textarea, a")
    )
      return;
    if (editing && target.closest(".document-card-content")) return;
    // Leave mouse events to React Flow; preventing pointerdown would suppress its drag start.
    press.current.begin(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    if (editing) activate(false);
  };
  return { focusPoint, onPointerDown };
}
