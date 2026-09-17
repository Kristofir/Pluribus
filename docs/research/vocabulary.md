# Domain vocabulary

Working vocabulary for discussing Pluribus, grouped by responsibility.
**Accepted** means an agreed product meaning; **implemented** describes the current
prototype, not a permanent design decision; **proposed** remains open. These groups
do not prescribe packages, tables, or services. Started 2026-09-09.

See [Product proposition](product.md) and [User journeys](journeys.md) for context.
The [shared canvas model](canvas-model.md) records the current entity diagrams.
The [architecture contract](../architecture.md) governs implementation boundaries.

## Model groups

### Identity — who contributes

| Term   | Meaning                                                                                                 | Status                          |
| ------ | ------------------------------------------------------------------------------------------------------- | ------------------------------- |
| User   | A signed-in identity managed through authentication.                                                    | Implemented through Convex Auth |
| Author | The stable identity credited with a text contribution: a user or an unverified guest credential holder. | Implemented                     |

Author identity is independent of presence. A guest's presence name and author
label currently come from separate mechanisms; they are not a unified profile.

### Canvas — spatial arrangement and element lifecycle

| Term                        | Meaning                                               | Status                                                                                   |
| --------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Canvas                      | A shared spatial surface containing elements.         | Accepted; one implicit shared canvas is implemented                                      |
| Canvas element              | The general concept for something placed on a canvas. | Accepted; implemented as `ElementBase` and a `CanvasElement` union                       |
| Geometry                    | An element's position and dimensions.                 | Implemented as x, y, width and height; rotation and persistent stacking are not included |
| Rectangle                   | A positioned shape with dimensions and a color.       | Implemented                                                                              |
| Document / document element | A child canvas element containing collaborative text. | Accepted; implemented                                                                    |
| Document card               | A UI name for the displayed document element.         | Implemented presentation; a separate domain entity is proposed, not accepted             |

A document belongs to one canvas. Its geometry and content have separate storage
and synchronization responsibilities, but remain one user-managed document.

### Documents — content and attribution

| Term             | Meaning                                                                                    | Status                                                                |
| ---------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| Document content | The collaborative text and formatting inside a document element.                           | Implemented with ProseMirror; not a separately managed product object |
| Authorship       | Attribution of surviving text to an Author. Existing unmarked text has unknown authorship. | Implemented as text marks                                             |

**Naming decision still open:** the recent proposal used Document Card for placement
and Document for independently identified content. That would change the accepted
meaning above. Separate database records do not establish that product distinction;
retain Document as the element until we explicitly decide otherwise.

### Collaboration — accepted edits and restoration

| Term               | Meaning                                                                                               | Status                                                           |
| ------------------ | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Author session     | A credentialed editing session scoped to one document and editing generation.                         | Implemented; distinct from an authentication or presence session |
| Editing generation | A lifecycle counter that invalidates earlier editing sessions when a document is removed or restored. | Implemented                                                      |
| Accepted operation | A backend-accepted edit with author/session evidence supporting verified undo and redo.               | Implemented; not a full revision-history product                 |
| Move evidence      | Information linking the removal and insertion of an explicit move within one document.                | Implemented protocol data, not an independent entity             |

Text, attribution and operation evidence commit together only after backend
acceptance. Local pending steps are not accepted history. Explicit moves preserve
authorship; ordinary pasted text is attributed to the writer who pastes it.
Document collaboration remains under Documents in code; this conceptual grouping
does not establish a generic collaboration subsystem.

### Presence — current participation and activity

| Term             | Meaning                                                                                      | Status                                                 |
| ---------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Tab session      | One browser tab participating in the application.                                            | Implemented                                            |
| Presence context | The canvas or document in which participation occurs.                                        | Implemented                                            |
| Participation    | A tab session's temporary participation in a context.                                        | Implemented; distinct from workspace Membership        |
| Activity         | Pointer location, selected elements, dragging/resizing, or a versioned text caret/selection. | Implemented                                            |
| Presence state   | Local environment and interaction state used to derive participation and activity.           | Implemented policy state, not a durable content entity |

Presence communicates what someone is doing; it does not grant permissions or lock
content. Presence is temporary, while accepted authorship persists after someone
leaves. Retention details belong in the architecture and prototype records.

## Provisional product concepts

These broader concepts remain hypotheses beyond the implemented model groups.

| Term            | Working meaning                                                                                                            | Still to resolve                                                                             |
| --------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Workspace       | A shared environment containing people and their work.                                                                     | Is this a lasting shared environment, or the space for one particular piece of work?         |
| Membership      | A person's relationship to that workspace, including their permissions.                                                    | What does membership permit, and can access differ between pieces of work?                   |
| Piece of work   | A particular situation, question, or objective that participants are working through. The name is deliberately unresolved. | Does it need its own identity and lifecycle? What would people call it?                      |
| Source material | Information brought into the work: messages, documents, excerpts, links, or data.                                          | Do we retain a reference, a captured copy, or both? How do we preserve its origin?           |
| Artifact        | Something participants develop: a note, analysis, draft, or finished document.                                             | How does it relate to its sources, and when does a revision remain the same artifact?        |
| Conversation    | An exchange between participants. Internal discussion and external correspondence may need different rules.                | Are these forms of one concept or separate concepts with different visibility and authority? |

## Further distinctions

- **Document and content:** a document is a child canvas element containing
  collaborative text. Geometry and text synchronize separately. The current experiment uses reversible
  removal, retained saved content, and explicit local recovery for pending edits.
- **Work and communication:** one piece of work might involve several conversations,
  or no email. A thread is not yet the agreed organizing unit.
- **Source and artifact:** these describe different roles. We have not decided
  whether the same content can serve both roles or how that relationship works.

The outer workspace hierarchy remains provisional. Avoid adding organizations,
projects, and cases until a concrete workflow needs those distinctions.

## How we will refine this

Use a concrete journey to decide what each concept represents, whether it needs a
stable identity, who controls it, what can happen to it, and what must remain true.
Define fields afterward.

Update meanings and open questions as discussion progresses. When a concept is
accepted, renamed, merged, or dropped, record the date and reason below. Acceptance
of a term alone does not authorize implementation.

## Discussion record

- **2026-09-09:** Captured the six candidate concepts from the architecture
  discussion. All remain provisional; no entity model has been selected.
- **2026-09-14:** Recorded the shared canvas diagrams. Canvas element is the
  general concept; text element references editable content. Non-text kinds and
  content deletion rules remain open.

- **2026-09-16:** Accepted document element as a child of Canvas, containing
  collaborative text. This replaces the earlier text-element reference model.

- **2026-09-17:** Grouped the inventory into Identity, Canvas, Documents,
  Collaboration and Presence, distinguishing accepted meanings, implementation
  facts and proposals. Preserved Document as the canvas element; separating a
  Document Card domain entity from Document remains an explicit open decision.

- **2026-09-17:** Accepted a shared Element base interface, specialized by
  DocumentElement and RectangleElement. Shared fields are identity, canvas and
  geometry; kind-specific fields stay on each variant. This introduces no class
  hierarchy or separate Document Card domain entity.
