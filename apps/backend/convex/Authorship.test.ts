/// <reference types="vite/client" />
import { writeFileSync } from "node:fs";
import { convexTest } from "convex-test";
import { register } from "@convex-dev/prosemirror-sync/test";
import { register as registerPresence } from "@convex-dev/presence/test";
import { expect, test } from "vitest";
import { EditorState } from "@tiptap/pm/state";
import { Step, ReplaceStep, AddMarkStep } from "@tiptap/pm/transform";
import { Slice, Fragment } from "@tiptap/pm/model";
import { history, undo, redo, closeHistory } from "@tiptap/pm/history";
import {
  collab,
  sendableSteps,
  receiveTransaction,
  getVersion,
} from "prosemirror-collab";
import { AuthoredStep } from "@pluribus/editor/protocol";
import { documentSchema } from "@pluribus/editor/schema";
import { api } from "./_generated/api";
import schema from "./schema";
const modules = import.meta.glob("./**/*.ts");
function setup() {
  const t = convexTest(schema, modules);
  register(t);
  registerPresence(t);
  return t;
}
const insert = (author: string, text: string, from = 1) =>
  new AuthoredStep(
    new ReplaceStep(
      from,
      from,
      new Slice(
        Fragment.from(
          documentSchema.text(text, [
            documentSchema.marks.authorship.create({ author }),
          ]),
        ),
        0,
        0,
      ),
    ),
    crypto.randomUUID(),
  );
async function prepare() {
  const t = setup(),
    id = await t.mutation(api.Documents.ensureShared, {});
  const a = await t.mutation(api.Documents.openAuthorship, { id }),
    b = await t.mutation(api.Documents.openAuthorship, { id });
  const submit = (session: typeof a, steps: readonly Step[], version: number) =>
    t.mutation(api.Documents.submitSteps, {
      id,
      version,
      clientId: session.author,
      credential: session.credential,
      protocol: 1,
      steps: steps.map((s) => JSON.stringify(s.toJSON())),
    });
  return { t, id, a, b, submit };
}
test("accepted attribution and evidence commit atomically; forged and legacy writes commit neither", async () => {
  const { t, id, a, b, submit } = await prepare();
  await submit(a, [insert(a.author, "Hello")], 1);
  await expect(submit(b, [insert(a.author, "forged", 6)], 2)).rejects.toThrow(
    "writer",
  );
  await expect(
    submit(b, [insert(b.author, "okay", 6), insert(a.author, "forged", 10)], 2),
  ).rejects.toThrow("writer");
  await expect(
    t.mutation(api.Documents.submitSteps, {
      id,
      version: 2,
      clientId: "old",
      steps: [JSON.stringify(new ReplaceStep(1, 1, Slice.empty).toJSON())],
    }),
  ).rejects.toThrow("Reload");
  expect(await t.query(api.Documents.latestVersion, { id })).toBe(2);
  expect(
    await t.run((ctx) =>
      ctx.db
        .query("documentOperations")
        .withIndex("by_document_operation", (q) => q.eq("document", id))
        .take(10),
    ),
  ).toHaveLength(1);
  await expect(
    submit(
      b,
      [
        new AuthoredStep(
          new AddMarkStep(
            1,
            6,
            documentSchema.marks.authorship.create({ author: b.author }),
          ),
          crypto.randomUUID(),
        ),
      ],
      2,
    ),
  ).rejects.toThrow("rewrite");
  const wrong = {
    ...b,
    credential: { ...b.credential, secret: a.credential.secret },
  };
  await expect(submit(wrong, [insert(b.author, "x")], 2)).rejects.toThrow(
    "session",
  );
});
test("native collaboration rebases authored steps; undo and redo restore deleted foreign authorship", async () => {
  const { t, id, a, b, submit } = await prepare();
  const seed = insert(a.author, "Hello world");
  await submit(a, [seed], 1);
  const initial = seed.apply(
    documentSchema.node("doc", null, [documentSchema.node("paragraph")]),
  ).doc!;
  const stateFor = (who: typeof a) =>
    EditorState.create({
      doc: initial,
      plugins: [history(), collab({ version: 2, clientID: who.author })],
    });
  let sa = stateFor(a),
    sb = stateFor(b);
  const deletion = new AuthoredStep(
    new ReplaceStep(7, 12, Slice.empty),
    crypto.randomUUID(),
  );
  sb = sb.apply(closeHistory(sb.tr).step(deletion));
  sa = sa.apply(sa.tr.step(insert(a.author, "!", 6)));
  async function sync(state: EditorState, who: typeof a) {
    for (let i = 0; i < 10; i++) {
      const pending = sendableSteps(state);
      if (!pending) break;
      const result = await submit(who, pending.steps, pending.version);
      state = state.apply(
        receiveTransaction(
          state,
          result.status === "synced"
            ? pending.steps
            : result.steps.map((s) =>
                Step.fromJSON(documentSchema, JSON.parse(s)),
              ),
          result.status === "synced"
            ? pending.steps.map(() => who.author)
            : result.clientIds,
        ),
      );
    }
    const remote = await t.query(api.Documents.getSteps, {
      id,
      version: getVersion(state),
    });
    return state.apply(
      receiveTransaction(
        state,
        remote.steps.map((s) => Step.fromJSON(documentSchema, JSON.parse(s))),
        remote.clientIds,
      ),
    );
  }
  sa = await sync(sa, a);
  sb = await sync(sb, b);
  sa = await sync(sa, a);
  expect(sa.doc.eq(sb.doc)).toBe(true);
  undo(sb, (tr) => {
    sb = sb.apply(tr);
  });
  sb = await sync(sb, b);
  sa = await sync(sa, a);
  expect(sa.doc.eq(sb.doc)).toBe(true);
  expect(sb.doc.textContent).toBe("Hello! world");
  sb.doc.descendants((n) => {
    if (n.isText)
      expect(
        n.marks.find((m) => m.type.name === "authorship")?.attrs.author,
      ).toBe(a.author);
  });
  redo(sb, (tr) => {
    sb = sb.apply(tr);
  });
  sb = await sync(sb, b);
  expect(sb.doc.textContent).toBe("Hello! ");
  await t.mutation(api.Documents.submitSnapshot, {
    id,
    version: getVersion(sb),
    content: JSON.stringify(sb.doc.toJSON()),
  });
  expect((await t.query(api.Documents.getSnapshot, { id })).content).toBe(
    JSON.stringify(sb.doc.toJSON()),
  );
});
test("explicit moves preserve a foreign source; incomplete moves and spoofed undo are rejected", async () => {
  const { t, id, a, b, submit } = await prepare();
  await submit(a, [insert(a.author, "ABCDEF")], 1);
  const snapshot = await t.query(api.Documents.getSteps, { id, version: 1 });
  const doc = Step.fromJSON(
    documentSchema,
    JSON.parse(snapshot.steps[0]),
  ).apply(
    documentSchema.node("doc", null, [documentSchema.node("paragraph")]),
  ).doc!;
  const group = crypto.randomUUID(),
    source = { from: 1, to: 4 };
  const remove = new AuthoredStep(
    new ReplaceStep(1, 4, Slice.empty),
    crypto.randomUUID(),
    undefined,
    { group, part: "remove", ...source },
  );
  const add = new AuthoredStep(
    new ReplaceStep(4, 4, doc.slice(1, 4)),
    crypto.randomUUID(),
    undefined,
    { group, part: "insert", ...source },
  );
  await expect(submit(b, [remove], 2)).rejects.toThrow("Incomplete");
  await submit(b, [remove, add], 2);
  await expect(
    submit(a, [add.invert(remove.apply(doc).doc!)], 4),
  ).rejects.toThrow("authorized");
  await expect(submit(b, [remove.invert(doc)], 4)).rejects.toThrow();
  expect(await t.query(api.Documents.latestVersion, { id })).toBe(4);
  const undoAdd = add.invert(remove.apply(doc).doc!),
    undoRemove = remove.invert(doc);
  // This inverse is valid, but accepting only half the move must roll back
  // both its receipt and consumption of the original evidence.
  await expect(submit(b, [undoAdd], 4)).rejects.toThrow("complete move");
  expect(await t.query(api.Documents.latestVersion, { id })).toBe(4);
  await submit(b, [undoAdd, undoRemove], 4);
  expect(await t.query(api.Documents.latestVersion, { id })).toBe(6);
  await expect(submit(b, [remove.invert(doc)], 6)).rejects.toThrow();
  await submit(
    b,
    [
      undoRemove.invert(remove.apply(doc).doc!),
      undoAdd.invert(add.apply(remove.apply(doc).doc!).doc!),
    ],
    6,
  );
  expect(await t.query(api.Documents.latestVersion, { id })).toBe(8);
});

test("measure UTF-8 attribution, author and operation overhead on repeatable fixtures", async () => {
  const bytes = (value: unknown) =>
    new TextEncoder().encode(
      typeof value === "string" ? value : JSON.stringify(value),
    ).length;
  const report = [];
  for (const fixture of [
    { name: "one author", length: 1024, chunk: 1024 },
    { name: "interleaved prose", length: 1024, chunk: 32 },
    { name: "fragmentation stress", length: 512, chunk: 1 },
  ]) {
    const { t, id, a, b, submit } = await prepare();
    let version = 1;
    const ops: Step[] = [];
    for (let offset = 0; offset < fixture.length; offset += fixture.chunk) {
      const who =
        fixture.chunk === 1024 || (offset / fixture.chunk) % 2 === 0 ? a : b;
      ops.push(
        insert(
          who.author,
          "x".repeat(Math.min(fixture.chunk, fixture.length - offset)),
          offset + 1,
        ),
      );
    }
    // Alternating authors must be separate authenticated submissions.
    for (let i = 0; i < ops.length; i++) {
      await submit(
        fixture.chunk === 1024 || i % 2 === 0 ? a : b,
        [ops[i]],
        version++,
      );
    }
    let doc = documentSchema.node("doc", null, [
      documentSchema.node("paragraph"),
    ]);
    for (const op of ops) doc = op.apply(doc).doc!;
    const plain = documentSchema.node("doc", null, [
      documentSchema.node(
        "paragraph",
        null,
        documentSchema.text(doc.textContent),
      ),
    ]);
    const receipts = await t.run((ctx) =>
      ctx.db
        .query("documentOperations")
        .withIndex("by_document_operation", (q) => q.eq("document", id))
        .take(1024),
    );
    const authors = await t.run(async (ctx) =>
      Promise.all([
        ctx.db.get(a.author),
        ...(fixture.chunk === 1024 ? [] : [ctx.db.get(b.author)]),
      ]),
    );
    let spans = 0;
    doc.descendants((n) => {
      if (n.isText) spans++;
    });
    report.push({
      fixture: fixture.name,
      plainTextBytes: bytes(doc.textContent),
      baselineJsonBytes: bytes(plain.toJSON()),
      attributedJsonBytes: bytes(doc.toJSON()),
      spans,
      authorRecordBytes: bytes(authors),
      sessionRecordBytes: bytes(
        await t.run(async (ctx) =>
          Promise.all([
            ctx.db.get(a.credential.session),
            ...(fixture.chunk === 1024
              ? []
              : [ctx.db.get(b.credential.session)]),
          ]),
        ),
      ),
      operationEvidenceBytes: bytes(receipts),
      stepStringBytes: ops.reduce(
        (n, s) => n + bytes(JSON.stringify(s.toJSON())),
        0,
      ),
    });
  }
  {
    const { t, id, a, b, submit } = await prepare();
    let doc = documentSchema.node("doc", null, [
      documentSchema.node("paragraph"),
    ]);
    const ops: Step[] = [];
    const send = async (who: typeof a, steps: Step[]) => {
      await submit(who, steps, ops.length + 1);
      for (const step of steps) doc = step.apply(doc).doc!;
      ops.push(...steps);
    };
    await send(a, [
      insert(a.author, "We are prototyping a shared workspace. "),
    ]);
    await send(b, [
      insert(
        b.author,
        "Authors should remain visible after edits.",
        doc.content.size - 1,
      ),
    ]);
    const beforeReplace = doc;
    const replacement = new AuthoredStep(
      new ReplaceStep(
        8,
        19,
        new Slice(
          Fragment.from(
            documentSchema.text("building", [
              documentSchema.marks.authorship.create({ author: b.author }),
            ]),
          ),
          0,
          0,
        ),
      ),
      crypto.randomUUID(),
    );
    await send(b, [replacement]);
    await send(b, [replacement.invert(beforeReplace)]);
    await send(a, [
      new AuthoredStep(
        new AddMarkStep(1, 7, documentSchema.marks.bold.create()),
        crypto.randomUUID(),
      ),
    ]);
    const beforeMove = doc;
    const group = crypto.randomUUID();
    const remove = new AuthoredStep(
      new ReplaceStep(1, 8, Slice.empty),
      crypto.randomUUID(),
      undefined,
      { group, part: "remove", from: 1, to: 8 },
    );
    const afterRemove = remove.apply(doc).doc!;
    const add = new AuthoredStep(
      new ReplaceStep(
        afterRemove.content.size - 1,
        afterRemove.content.size - 1,
        doc.slice(1, 8),
      ),
      crypto.randomUUID(),
      undefined,
      { group, part: "insert", from: 1, to: 8 },
    );
    await send(b, [remove, add]);
    await send(b, [add.invert(afterRemove), remove.invert(beforeMove)]);
    await send(a, [
      insert(a.author, " Let's test this together.", doc.content.size - 1),
    ]);
    const clean = (
      node: ReturnType<typeof doc.toJSON>,
    ): ReturnType<typeof doc.toJSON> => ({
      ...node,
      ...(node.marks
        ? {
            marks: node.marks.filter(
              (mark: { type: string }) => mark.type !== "authorship",
            ),
          }
        : {}),
      ...(node.content ? { content: node.content.map(clean) } : {}),
    });
    const records = await t.run(async (ctx) => ({
      authors: await Promise.all([ctx.db.get(a.author), ctx.db.get(b.author)]),
      sessions: await Promise.all([
        ctx.db.get(a.credential.session),
        ctx.db.get(b.credential.session),
      ]),
      receipts: await ctx.db
        .query("documentOperations")
        .withIndex("by_document_operation", (q) => q.eq("document", id))
        .take(100),
    }));
    const baseline = documentSchema.nodeFromJSON(clean(doc.toJSON()));
    let spans = 0;
    doc.descendants((n) => {
      if (n.isText) spans++;
    });
    report.push({
      fixture: "mixed edit trace",
      plainTextBytes: bytes(doc.textContent),
      baselineJsonBytes: bytes(baseline.toJSON()),
      attributedJsonBytes: bytes(doc.toJSON()),
      spans,
      authorRecordBytes: bytes(records.authors),
      sessionRecordBytes: bytes(records.sessions),
      operationEvidenceBytes: bytes(records.receipts),
      stepStringBytes: ops.reduce(
        (n, s) => n + bytes(JSON.stringify(s.toJSON())),
        0,
      ),
    });
  }
  writeFileSync(
    "/tmp/pluribus-authorship-storage.json",
    JSON.stringify(report, null, 2),
  );
  expect(report[0].spans).toBe(1);
  expect(report[1].spans).toBe(32);
  expect(report[2].spans).toBe(512);
}, 20000);

test("canvas authorship survives restoration while old sessions and cross-card writes are rejected", async () => {
  const t = setup();
  const geometry = { x: 0, y: 0, width: 430, height: 500 };
  await t.mutation(api.Canvas.createDocument, { geometry });
  await t.mutation(api.Canvas.createDocument, { geometry });
  const [a, b] = await t.query(api.Canvas.documentCards, {});
  const oldId = `${a.documentId}:1`,
    otherId = `${b.documentId}:1`;
  const author = await t.mutation(api.Documents.openAuthorship, { id: oldId });
  const other = await t.mutation(api.Documents.openAuthorship, {
    id: otherId,
    guest: author.guest!,
  });
  expect(other.author).toBe(author.author);
  const seed = insert(author.author, "Attributed card text");
  const submit = (
    id: string,
    session: typeof author,
    step: Step,
    version: number,
  ) =>
    t.mutation(api.Documents.submitSteps, {
      id,
      version,
      credential: session.credential,
      protocol: 1,
      clientId: session.credential.session,
      steps: [JSON.stringify(step.toJSON())],
    });
  await submit(oldId, author, seed, 1);
  await expect(
    submit(otherId, author, insert(author.author, "wrong card"), 1),
  ).rejects.toThrow("session");
  await submit(otherId, other, insert(other.author, "Other card"), 1);
  const deletion = {
    operation: crypto.randomUUID(),
    secret: crypto.randomUUID(),
  };
  await t.mutation(api.Canvas.deleteDocument, {
    id: a.id,
    generation: 1,
    ...deletion,
  });
  await expect(
    t.mutation(api.Documents.openAuthorship, {
      id: `${a.documentId}:2`,
      guest: author.guest!,
    }),
  ).rejects.toThrow("removed");
  await t.mutation(api.Canvas.undoDeletion, deletion);
  const restoredId = `${a.documentId}:3`;
  await expect(
    submit(oldId, author, insert(author.author, "stale"), 2),
  ).rejects.toThrow("expired");
  await expect(
    submit(restoredId, author, insert(author.author, "stale"), 2),
  ).rejects.toThrow("session");
  const restored = await t.mutation(api.Documents.openAuthorship, {
    id: restoredId,
    guest: author.guest!,
  });
  const empty = documentSchema.node("doc", null, [
    documentSchema.node("paragraph"),
  ]);
  await expect(
    submit(restoredId, restored, seed.invert(empty), 2),
  ).rejects.toThrow("authorized");
  const read = await t.query(api.Documents.getSteps, {
    id: restoredId,
    version: 1,
  });
  expect(read.steps).toEqual([JSON.stringify(seed.toJSON())]);
  await submit(
    restoredId,
    restored,
    insert(restored.author, "New session "),
    2,
  );
  expect(await t.query(api.Documents.latestVersion, { id: restoredId })).toBe(
    3,
  );
});
