import { Step, type Mappable } from "@tiptap/pm/transform";
import type { Node, Schema } from "@tiptap/pm/model";
export type MoveEvidence = {
  group: string;
  part: "remove" | "insert";
  from: number;
  to: number;
};
/** Carries provenance intent through native history and collaboration without changing step effects. */
export class AuthoredStep extends Step {
  constructor(
    readonly inner: Step,
    readonly id: string,
    readonly undoOf?: string,
    readonly move?: MoveEvidence,
  ) {
    super();
  }
  apply(doc: Node) {
    return this.inner.apply(doc);
  }
  getMap() {
    return this.inner.getMap();
  }
  invert(doc: Node) {
    return new AuthoredStep(
      this.inner.invert(doc),
      crypto.randomUUID(),
      this.id,
    );
  }
  map(mapping: Mappable) {
    const inner = this.inner.map(mapping);
    const move = this.move && {
      ...this.move,
      from: mapping.map(this.move.from, 1),
      to: mapping.map(this.move.to, -1),
    };
    return inner ? new AuthoredStep(inner, this.id, this.undoOf, move) : null;
  }
  merge() {
    return null;
  }
  toJSON() {
    return {
      stepType: "authored",
      id: this.id,
      inner: this.inner.toJSON(),
      ...(this.undoOf ? { undoOf: this.undoOf } : {}),
      ...(this.move ? { move: this.move } : {}),
    };
  }
  static fromJSON(schema: Schema, json: Record<string, unknown>) {
    const validId = (id: unknown): id is string =>
      typeof id === "string" && /^[a-zA-Z0-9-]{1,80}$/.test(id);
    if (
      !validId(json.id) ||
      (json.undoOf !== undefined && !validId(json.undoOf))
    )
      throw new Error("Invalid authorship operation");
    const inner = Step.fromJSON(schema, json.inner);
    if (inner instanceof AuthoredStep)
      throw new Error("Nested authorship operation");
    let move: MoveEvidence | undefined;
    if (json.move !== undefined) {
      const value = json.move as Partial<MoveEvidence>;
      if (
        !value ||
        !validId(value.group) ||
        !["remove", "insert"].includes(value.part!) ||
        !Number.isSafeInteger(value.from) ||
        !Number.isSafeInteger(value.to) ||
        value.from! < 0 ||
        value.to! <= value.from! ||
        json.undoOf
      )
        throw new Error("Invalid move evidence");
      move = value as MoveEvidence;
    }
    return new AuthoredStep(
      inner,
      json.id,
      json.undoOf as string | undefined,
      move,
    );
  }
}
Step.jsonID("authored", AuthoredStep);
