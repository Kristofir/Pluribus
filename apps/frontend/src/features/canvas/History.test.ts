import { expect, test } from "vitest";
import { createHistory } from "./History";

test("the controller orders typed commands without Element IDs or deletion results", async () => {
  type Command =
    | { kind: "increment"; amount: number }
    | { kind: "multiply"; factor: number };
  let value = 2;
  const history = createHistory<Command>({
    prepare: (command) => command,
    async execute(command, action) {
      if (command.kind === "increment")
        value += action === "undo" ? -command.amount : command.amount;
      else
        value =
          action === "undo" ? value / command.factor : value * command.factor;
      return { status: "applied", command };
    },
  });
  await history.apply({ kind: "increment", amount: 3 });
  await history.apply({ kind: "multiply", factor: 4 });
  expect(value).toBe(20);
  await history.undo();
  await history.undo();
  expect(value).toBe(2);
  await history.redo();
  expect(value).toBe(5);
  await history.apply({ kind: "increment", amount: 1 });
  expect(history.store.getState().redo).toEqual([]);
});
