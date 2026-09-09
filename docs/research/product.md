# Product proposition and user experience

Working document for discussion. This is not an implementation specification.

See [User journeys](journeys.md) for detailed journey mapping.

## Where we are

We have an initial experience in mind, but have not yet defined the primary user
or validated the problem. Start there before committing to features.

## User problem

### Working hypothesis

When people need to understand information and produce something together,
their sources, discussion, and drafts can become scattered. They spend effort
reconstructing context and reconciling contributions instead of moving the work
forward.

One possible application is preparing a response to an email: the people writing
it need to bring together information, discuss what to say, and shape a shared
draft.

Email may be the central job or just one output of broader collaborative work.
We have not decided which.

### Possible pains to investigate

- Relevant information is spread across messages, documents, and webpages.
- One person's knowledge or concerns are missed by the others.
- Discussion, source material, and draft wording become difficult to distinguish.
- People cannot easily tell why something was written or which source supports it.
- A new message forces the group to reconstruct earlier context.

These are hypotheses from our discussion, not findings from user research.

### Still to define

- **Who:** the initial user and the people they collaborate with.
- **Situation:** a concrete, recurring task that brings them together.
- **Current workaround:** how they complete that task today.
- **Consequence:** what the friction costs them, and why it matters.
- **Success:** what would become meaningfully easier or better.

## Product proposition

### Working proposition

> A shared place to bring information together, develop thinking with others,
> and turn it into writing or communication.

If email becomes the primary use case, a narrower proposition could be:

> Work together on a response with the relevant information and private
> discussion close at hand.

The proposition should describe an outcome, not require an infinite canvas to be
valuable. We still need to establish why someone would choose this over their
current combination of tools.

## Proposed experience

The user has proposed two workspaces. Whether these are independent workspaces
or connected surfaces within one workspace remains open.

| Surface         | What the user wants to do                                                                                               |
| --------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Infinite canvas | Bring in notes, webpage snippets, data, tables, and other material; collaborate on writing, editing, and organizing it. |
| Email thread    | Read an email conversation and collaborate on writing a response.                                                       |

### Potential connection between the surfaces

These are suggestions, not agreed requirements:

- Bring relevant material from an email onto the canvas.
- Use selected canvas material when composing a response.
- Keep a visible connection between a draft and its supporting material.
- Return to that context when another reply arrives.

The canvas might support one thread, several related threads, or work with no
email at all. We should not assume that relationship yet.

## Illustrative journey

An email-led scenario to test, not the chosen primary workflow:

1. A person receives a message that benefits from someone else's input.
2. They invite that person to collaborate.
3. Together, they gather relevant information and discuss what it means.
4. They develop and edit a response.
5. They decide the response is ready and send it.
6. A later reply arrives, and they continue with the earlier context available.

For a real example, we should map what each person does, where they struggle
today, and what the proposed experience would change.

## Open product questions

1. Who is the first user, and what specific task are they doing?
2. Is the main value understanding information together, producing something
   together, or responding to an external conversation?
3. Does the canvas have a complete purpose without email?
4. What does collaboration mean: simultaneous editing, comments, suggestions,
   review, or some combination?
5. Who can access the source material, edit a draft, and send a response?
6. What role, if any, should AI play in the core experience?

## Next discussion

Choose one concrete user situation and walk through how it works today before
expanding the feature list.
