# Agent connection experience — proposal

**Status:** Proposal for the local hackathon demo. The Workspace entry point and
manual connection details are implemented; the pairing helper and persistent
connection list are not.

## The first journey

A workspace member wants a local Codex agent to understand the canvas. They open
the workspace, connect Codex, ask it to summarize what is on the canvas, see its
recent activity, and can revoke it. The first successful `read_canvas` call is
the proof of setup. Opening `/mcp` in a browser or copying its URL is not proof.

## Workspace flow

1. Replace **Copy local MCP URL** in the Workspace header with **Connect an agent**.
   The screen says that an agent can read and edit all current and future
   workspace documents, canvas layout, and saved Web Pages. There are no
   per-document permission choices in this demo.
2. **Choose client:** lead with **Codex on this computer**. Put **Other MCP
   client** behind a secondary choice. Explain that a local URL works only on
   this computer; remote clients need an HTTPS deployment.
3. **Name the agent:** default to a useful name such as “Research agent.” Show
   who is creating the connection. The name remains the agent's attribution
   label and can be recognized in Presence and History.
4. **Pair Codex:** create a short-lived, single-use pairing code. Show one
   generated local setup command. A local helper exchanges the code for a
   workspace bearer token, stores the token in the OS credential store, and
   registers a named HTTP MCP server in Codex using a credential helper. The
   durable token is never copied into chat, a URL, or project files. The
   pairing code expires quickly and cannot be exchanged twice.
5. **Finish in Codex:** show the required restart step, then offer a starter
   prompt: “Read this workspace canvas and tell me what you see.” The app shows
   **Waiting for first agent read** until a real authenticated `read_canvas`
   call arrives. Then it shows **Connected to this workspace** with the agent
   name and recent activity. A helper's setup check must not count as this read.
6. **Manage:** keep a persistent list of named connections with creator, last
   activity, and **Revoke**. Each connection has one stable identity for
   attribution and Presence. Revocation immediately invalidates its token and
   removes recent Presence. Do not rely on the one-time secret display as the
   only way to find or revoke a connection later.

## Other clients and remote access

**Other MCP client** reveals the server address and a bearer token shown once,
with the exact `Authorization: Bearer …` requirement and a copyable client
configuration example. Explain that the endpoint is shared; the token selects
the workspace. Offer **Test connection** only when the client has made a real
authenticated call. For a local HTTP address, label it **local only**. Do not
offer remote setup until the backend has an HTTPS endpoint.

For a hosted product, replace the pairing helper with MCP OAuth and browser
authorization. A user should add the HTTPS server address in their client,
sign in, choose a workspace, and approve the agent. That is a later design;
the local demo should not pretend to offer it.

## Truthful states

| State                            | What the user sees                                 | Recovery                                               |
| -------------------------------- | -------------------------------------------------- | ------------------------------------------------------ |
| Backend unavailable              | “Local MCP server is not running.”                 | Start the local backend; retry.                        |
| Pairing code expired             | “Setup code expired; no connection was installed.” | Generate another code.                                 |
| Codex configured, no request yet | “Waiting for first agent read.”                    | Restart Codex and run the starter prompt.              |
| Authenticated read accepted      | “Connected to this workspace.”                     | Show agent name and latest activity.                   |
| Agent idle                       | “Last active …”                                    | No claim of a live socket or continuous online status. |
| Token revoked or membership lost | “Connection ended.”                                | Create a new connection if authorized.                 |

The `/mcp` browser GET can show a short informational page instead of a bare
405, but must show no workspace data or token. MCP POSTs still require a valid
bearer token and current workspace membership.

## Delivery slices and proof

1. Build the workspace connection list and truthful waiting/active/revoked
   states with the existing grant and Presence records.
2. Build the local pairing helper and one-time code exchange. Verify it stores
   the token outside repository files and registers a Codex server without
   putting the bearer value into config or shell history.
3. Run the actual local Codex journey: connect, restart, `tools/list`,
   `read_canvas`, `read_web_page`, `read_document`, `edit_document`, observe
   attribution and Presence, revoke, and confirm the next request fails.

Codex supports Streamable HTTP servers, bearer tokens from environment
variables, and local HTTP header helpers. Its desktop app, CLI, and IDE
extension share MCP configuration. See the [official Codex MCP documentation](https://developers.openai.com/codex/mcp).
