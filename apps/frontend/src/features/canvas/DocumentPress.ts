export const documentDragThreshold = 5;
type Point = { x: number; y: number };

/** Local pointer intent. Once a press becomes a drag it cannot become a click again. */
export class DocumentPress {
  private start: (Point & { pointerId: number }) | null = null;
  state: "idle" | "pressed" | "dragging" = "idle";
  begin(pointerId: number, point: Point) {
    this.start = { ...point, pointerId };
    this.state = "pressed";
  }
  move(pointerId: number, point: Point) {
    if (!this.start || this.start.pointerId !== pointerId) return;
    if (
      Math.hypot(point.x - this.start.x, point.y - this.start.y) >
      documentDragThreshold
    )
      this.state = "dragging";
  }
  release(pointerId: number, point: Point) {
    if (!this.start || this.start.pointerId !== pointerId) return false;
    this.move(pointerId, point);
    const click = this.state === "pressed";
    this.cancel();
    return click;
  }
  cancel() {
    this.start = null;
    this.state = "idle";
  }
}
