import { RemoteCursor } from "./RemoteCursor";
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
  if (!presence.show || !presence.identity) return null;
  return (
    <ViewportPortal>
      {presence.members
        .filter((m) => m.guestId !== presence.identity?.guestId)
        .map((member) => {
          const profile = guestProfile(member.guestId),
            label = `${profile.name} · ${member.tabId.slice(0, 4)}`;
          const activity = presence.activities.filter(
            (a) => a.participationId === member.id,
          );
          const pointerUpdate = activity.find(
            (a) => a.activity.kind === "pointer",
          );
          const pointer = pointerUpdate?.activity;
          const selection = activity.find(
            (a) => a.activity.kind === "selection",
          )?.activity;
          const manipulation = activity.find(
            (a) => a.activity.kind === "manipulation",
          )?.activity;
          return (
            <div key={member.id} data-presence-session={member.tabId}>
              {pointer?.kind === "pointer" && pointer.point && (
                <RemoteCursor
                  point={pointer.point}
                  sequence={pointerUpdate!.sequence}
                  color={profile.color}
                  label={label}
                />
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
                        transform: `translate3d(${node.position.x - 4}px, ${node.position.y - 4}px, 0)`,
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
