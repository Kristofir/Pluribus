import { expect, test } from "vitest";
import { DocumentPress } from "./DocumentPress";

test("release after a small movement is a click; a held press is not editing", () => {
  const press = new DocumentPress();
  press.begin(1, { x: 100, y: 100 });
  press.move(1, { x: 103, y: 104 });
  expect(press.state).toBe("pressed");
  expect(press.release(1, { x: 103, y: 104 })).toBe(true);
  expect(press.state).toBe("idle");
});
test("a drag stays a drag even after returning to the initial point", () => {
  const press = new DocumentPress();
  press.begin(1, { x: 0, y: 0 });
  press.move(1, { x: 6, y: 0 });
  press.move(1, { x: 0, y: 0 });
  expect(press.state).toBe("dragging");
  expect(press.release(1, { x: 0, y: 0 })).toBe(false);
});
test("cancel and another pointer cannot activate editing", () => {
  const press = new DocumentPress();
  press.begin(1, { x: 0, y: 0 });
  expect(press.release(2, { x: 0, y: 0 })).toBe(false);
  expect(press.state).toBe("pressed");
  press.cancel();
  expect(press.release(1, { x: 0, y: 0 })).toBe(false);
});
test("a release beyond the threshold is a drag even without a move event", () => {
  const press = new DocumentPress();
  press.begin(1, { x: 0, y: 0 });
  expect(press.release(1, { x: 4, y: 4 })).toBe(false);
});

test("selection modifier never turns a card press into editing", () => {
  const press = new DocumentPress();
  press.begin(1, { x: 0, y: 0 }, true);
  expect(press.release(1, { x: 0, y: 0 })).toBe(false);
  press.begin(1, { x: 0, y: 0 });
  expect(press.release(1, { x: 0, y: 0 }, true)).toBe(false);
  expect(press.state).toBe("idle");
});
