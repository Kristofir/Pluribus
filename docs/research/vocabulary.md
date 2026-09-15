# Provisional domain vocabulary

Working vocabulary for discussing Pluribus. All six concepts below are provisional;
they are not agreed entities, database tables, or implementation requirements.
Started 2026-09-09.

See [Product proposition](product.md) and [User journeys](journeys.md) for context.
The [shared canvas model](canvas-model.md) records the current entity diagrams.
The [architecture contract](../architecture.md) governs implementation boundaries.

## Candidate concepts

| Term            | Working meaning                                                                                                            | Still to resolve                                                                             |
| --------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Workspace       | A shared environment containing people and their work.                                                                     | Is this a lasting shared environment, or the space for one particular piece of work?         |
| Membership      | A person's relationship to that workspace, including their permissions.                                                    | What does membership permit, and can access differ between pieces of work?                   |
| Piece of work   | A particular situation, question, or objective that participants are working through. The name is deliberately unresolved. | Does it need its own identity and lifecycle? What would people call it?                      |
| Source material | Information brought into the work: messages, documents, excerpts, links, or data.                                          | Do we retain a reference, a captured copy, or both? How do we preserve its origin?           |
| Artifact        | Something participants develop: a note, analysis, draft, or finished document.                                             | How does it relate to its sources, and when does a revision remain the same artifact?        |
| Conversation    | An exchange between participants. Internal discussion and external correspondence may need different rules.                | Are these forms of one concept or separate concepts with different visibility and authority? |

## Distinctions to explore

- **Content and placement:** an artifact and its position on a canvas may be
  separate concepts. Removing a visual representation need not delete its content.
- **Work and communication:** one piece of work might involve several conversations,
  or no email. A thread is not yet the agreed organizing unit.
- **Source and artifact:** these describe different roles. We have not decided
  whether the same content can serve both roles or how that relationship works.

The shared canvas model establishes that a canvas contains multiple text and
non-text elements. Its outer workspace hierarchy and one-document-per-text-element
relationship remain proposals. Avoid adding organizations, projects, and cases
until a concrete workflow needs those distinctions.

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
