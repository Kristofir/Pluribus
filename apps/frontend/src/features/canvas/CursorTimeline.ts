export type CursorPoint = { x: number; y: number };
type Sample = CursorPoint & { time: number };
export const cursorDelayMs = 80;
const resetAfterMs = 500;

/** Receive-time interpolation: no clock synchronization or speculative movement. */
export class CursorTimeline {
  private samples: Sample[] = [];
  private sequence = -1;
  push(point: CursorPoint, sequence: number, time: number) {
    if (sequence <= this.sequence) return false;
    this.sequence = sequence;
    const last = this.samples.at(-1);
    if (last && time - last.time > resetAfterMs) this.samples = [];
    if (this.samples.at(-1)?.time === time) this.samples.pop();
    this.samples.push({ ...point, time });
    if (this.samples.length > 32) this.samples.shift();
    return true;
  }
  latest() {
    return this.samples.at(-1);
  }
  settle() {
    const last = this.latest();
    this.samples = last ? [last] : [];
    return last;
  }
  sample(now: number): { point: CursorPoint; moving: boolean } | null {
    if (!this.samples.length) return null;
    const time = now - cursorDelayMs;
    while (this.samples.length > 1 && this.samples[1].time <= time)
      this.samples.shift();
    const first = this.samples[0],
      next = this.samples[1];
    if (!next) return { point: first, moving: false };
    const fraction = Math.max(
      0,
      Math.min(1, (time - first.time) / (next.time - first.time)),
    );
    return {
      point: {
        x: first.x + (next.x - first.x) * fraction,
        y: first.y + (next.y - first.y) * fraction,
      },
      moving: true,
    };
  }
}
