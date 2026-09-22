import { ParagraphAttributes } from "./Paragraphs";
import { Mark, getSchema } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import "./Protocol";
export const Authorship = Mark.create({
  name: "authorship",
  inclusive: false,
  addAttributes: () => ({ author: { default: null } }),
  // Pasted HTML never imports trusted authorship; JSON is validated by the server.
  parseHTML: () => [],
  renderHTML: ({ HTMLAttributes }) => [
    "span",
    { "data-author": HTMLAttributes.author },
    0,
  ],
});
export const documentExtensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    link: { openOnClick: false, autolink: false },
    underline: false,
  }),
  Authorship,
  ParagraphAttributes,
];
export const documentSchema = getSchema(documentExtensions);
