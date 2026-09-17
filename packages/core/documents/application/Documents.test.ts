import { expect, test } from "vitest";
import {
  ensureSharedDocument,
  type SharedDocumentPersistence,
} from "./Documents";
import type { DocumentId } from "../domain/Document";

test("existing shared documents are reused for either actor", async () => {
  const document = { id: "shared" as DocumentId, access: "public" as const };
  const persistence: SharedDocumentPersistence = {
    findShared: async () => document,
    createShared: async () => {
      throw new Error("Unexpected duplicate creation");
    },
  };
  for (const kind of ["anonymous", "authenticated"] as const)
    expect(await ensureSharedDocument({ kind }, persistence)).toBe(document);
});
