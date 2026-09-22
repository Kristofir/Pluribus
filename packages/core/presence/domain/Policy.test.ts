import { expect, test } from "vitest";
import {
  initialPresenceState,
  membershipIntent,
  transitionPresence,
  type InteractionEvent,
} from "./Policy";
const environment = {
  online: true,
  ownsBrowser: true,
  visible: true,
  focused: true,
};
function setup() {
  const owner = {};
  let state = transitionPresence(initialPresenceState(environment), {
    type: "surface-acquired",
    owner,
  });
  return {
    get state() {
      return state;
    },
    set state(value) {
      state = value;
    },
    owner,
    emit(event: InteractionEvent) {
      state = transitionPresence(state, { type: "interaction", owner, event });
    },
  };
}
test("blur retains text activity even when later unfocused editor transactions report another selection", () => {
  const model = setup();
  model.emit({ type: "editor-focused" });
  const range = { version: 1, anchor: 2, head: 4 };
  model.emit({ type: "text-selection-changed", range, focused: true });
  model.emit({ type: "editor-blurred" });
  model.emit({ type: "text-selection-changed", range: null, focused: false });
  expect(model.state.activities.get("text")).toEqual({ kind: "text", range });
  expect(model.state.editorFocus.get(model.owner)).toBe(false);
  model.state = transitionPresence(model.state, {
    type: "environment-changed",
    environment: { ...environment, focused: false },
  });
  expect(membershipIntent(model.state)).toBe("present");
  model.state = transitionPresence(model.state, {
    type: "environment-changed",
    environment: { ...environment, visible: false, focused: false },
  });
  expect(membershipIntent(model.state)).toBe("away");
  expect(model.state.activities.get("text")).toEqual({ kind: "text", range });
});
test("a real unmappable selection clears text; ordinary pointer leave clears only while focused", () => {
  const model = setup();
  model.emit({ type: "text-selection-changed", range: null, focused: true });
  expect(model.state.activities.get("text")).toEqual({
    kind: "text",
    range: null,
  });
  model.emit({ type: "pointer-moved", point: { x: 1, y: 2 } });
  model.state = transitionPresence(model.state, {
    type: "environment-changed",
    environment: { ...environment, focused: false },
  });
  model.emit({ type: "pointer-left" });
  expect(model.state.activities.get("pointer")).toEqual({
    kind: "pointer",
    point: { x: 1, y: 2 },
  });
  model.state = transitionPresence(model.state, {
    type: "environment-changed",
    environment,
  });
  model.emit({ type: "pointer-left" });
  expect(model.state.activities.get("pointer")).toEqual({
    kind: "pointer",
    point: null,
  });
});
test("releasing a surface clears only channels it still owns; ended participation drops stale activity", () => {
  const model = setup(),
    other = {};
  model.emit({ type: "selection-changed", elements: ["a"] });
  model.emit({ type: "pointer-moved", point: { x: 1, y: 2 } });
  model.state = transitionPresence(model.state, {
    type: "surface-acquired",
    owner: other,
  });
  model.state = transitionPresence(model.state, {
    type: "interaction",
    owner: other,
    event: { type: "selection-changed", elements: ["b"] },
  });
  model.state = transitionPresence(model.state, {
    type: "surface-released",
    owner: model.owner,
  });
  model.emit({ type: "selection-changed", elements: ["stale"] });
  expect(model.state.activities.get("selection")).toEqual({
    kind: "selection",
    elements: ["b"],
  });
  expect(model.state.activities.get("pointer")).toEqual({
    kind: "pointer",
    point: null,
  });
  expect(membershipIntent(model.state)).toBe("present");
  model.state = transitionPresence(model.state, {
    type: "participation-ended",
  });
  expect(model.state.activities.size).toBe(0);
});

test("unfocused owners and followers retain prior activity without accepting new interactions", () => {
  const model = setup();
  model.emit({ type: "pointer-moved", point: { x: 1, y: 2 } });
  for (const next of [
    { ...environment, focused: false },
    { ...environment, ownsBrowser: false },
  ]) {
    model.state = transitionPresence(model.state, {
      type: "environment-changed",
      environment: next,
    });
    model.emit({ type: "pointer-moved", point: { x: 99, y: 99 } });
    model.emit({
      type: "manipulation-changed",
      elements: ["a"],
      operation: "drag",
    });
    model.emit({ type: "text-selection-changed", range: null, focused: true });
    expect(model.state.activities.size).toBe(1);
    expect(model.state.activities.get("pointer")).toEqual({
      kind: "pointer",
      point: { x: 1, y: 2 },
    });
  }
  expect(membershipIntent(model.state)).toBe("absent");
});
