import { ViewportPortal } from "@xyflow/react";
import { guestProfile } from "@pluribus/core/presence/domain";
import type { PresenceView } from "../presence/UsePresence";
import type { Node } from "@xyflow/react";
export function CanvasPresence({
  presence,
  nodes,
}: {
  presence: PresenceView;
  nodes: Node[];
}) {
  if (!presence.show || !presence.id) return null;
  return (
    <ViewportPortal>
      {presence.members
        .filter((m) => m.id !== presence.id)
        .map((member) => {
          const profile = guestProfile(member.guestId),
            label = `${profile.name} · ${member.tabId.slice(0, 4)}`;
          const activity = presence.activities.filter(
            (a) => a.participationId === member.id,
          );
          const pointer = activity.find(
            (a) => a.activity.kind === "pointer",
          )?.activity;
          const selection = activity.find(
            (a) => a.activity.kind === "selection",
          )?.activity;
          const manipulation = activity.find(
            (a) => a.activity.kind === "manipulation",
          )?.activity;
          return (
            <div key={member.id} data-presence-session={member.tabId}>
              {pointer?.kind === "pointer" && pointer.point && (
                <div
                  className="remote-pointer"
                  style={{
                    left: pointer.point.x,
                    top: pointer.point.y,
                    color: profile.color,
                  }}
                >
                  ➤<span style={{ background: profile.color }}>{label}</span>
                </div>
              )}
              {selection?.kind === "selection" &&
                selection.elements.map((id) => {
                  const node = nodes.find((n) => n.id === id);
                  if (!node) return null;
                  const operation =
                    manipulation?.kind === "manipulation" &&
                    manipulation.elements.includes(id)
                      ? manipulation.operation
                      : null;
                  return (
                    <div
                      key={id}
                      className="remote-element"
                      data-element={id}
                      style={{
                        left: node.position.x - 4,
                        top: node.position.y - 4,
                        width: (node.width ?? 0) + 8,
                        height: (node.height ?? 0) + 8,
                        borderColor: profile.color,
                      }}
                    >
                      <span style={{ background: profile.color }}>
                        {label}
                        {operation ? ` · ${operation}` : ""}
                      </span>
                    </div>
                  );
                })}
            </div>
          );
        })}
    </ViewportPortal>
  );
}
