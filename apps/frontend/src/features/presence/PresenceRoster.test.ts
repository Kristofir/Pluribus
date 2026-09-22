import { expect, test } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PresenceRoster } from "./PresenceRoster";
import type { PresenceView } from "./UsePresence";

test("agent activity is visibly labeled as recent without implying a live connection", () => {
  const presence = {
    members: [],
    agents: [{ id: "agent-grant", label: "Researcher" }],
    activities: [],
    id: null,
    error: null,
    show: true,
    identity: null,
    emit: () => {},
  } as unknown as PresenceView;
  const html = renderToStaticMarkup(
    createElement(PresenceRoster, { presence }),
  );
  expect(html).toContain("Agent: Researcher · recently active");
  expect(html).toContain("MCP request within the last 30 seconds");
  expect(html).not.toContain("connected");
  expect(html).toContain('class="presence-avatar presence-agent"');
  expect(html).not.toContain('type="checkbox"');
});
