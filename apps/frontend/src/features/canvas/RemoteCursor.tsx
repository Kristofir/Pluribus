import { memo, useLayoutEffect, useRef } from "react";
import { CursorTimeline, type CursorPoint } from "./CursorTimeline";

export const RemoteCursor = memo(function RemoteCursor({
  point,
  sequence,
  color,
  label,
}: {
  point: CursorPoint;
  sequence: number;
  color: string;
  label: string;
}) {
  const element = useRef<HTMLDivElement>(null);
  const timeline = useRef(new CursorTimeline());
  const frame = useRef<number | null>(null);
  const reduced = useRef(false);
  const wake = useRef<() => void>(() => {});
  useLayoutEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const paint = (position: CursorPoint) => {
      if (element.current)
        element.current.style.transform = `translate3d(${position.x}px, ${position.y - 3}px, 0)`;
    };
    const cancel = () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
    };
    const tick = () => {
      frame.current = null;
      const value = timeline.current.sample(performance.now());
      if (!value) return;
      paint(value.point);
      if (value.moving) frame.current = requestAnimationFrame(tick);
    };
    const update = () => {
      reduced.current = media.matches;
      if (reduced.current || document.hidden) {
        cancel();
        const latest = timeline.current.settle();
        if (latest) paint(latest);
      } else if (frame.current === null) tick();
    };
    wake.current = update;
    media.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    update();
    return () => {
      cancel();
      wake.current = () => {};
      media.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  useLayoutEffect(() => {
    if (timeline.current.push(point, sequence, performance.now()))
      wake.current();
  }, [point.x, point.y, sequence]);
  return (
    <div
      ref={element}
      className="remote-pointer"
      data-sequence={sequence}
      style={{ color }}
    >
      ➤<span style={{ background: color }}>{label}</span>
    </div>
  );
});
