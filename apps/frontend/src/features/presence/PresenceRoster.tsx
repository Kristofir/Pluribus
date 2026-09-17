import { guestProfile } from "@pluribus/core/presence/domain";
import type { PresenceView } from "./UsePresence";
import "./Presence.css";
export function PresenceRoster({ presence }: { presence: PresenceView }) {
  const grouped = new Map<string, typeof presence.members>();
  for (const member of presence.members) {
    const group = grouped.get(member.guestId) ?? [];
    group.push(member);
    grouped.set(member.guestId, group);
  }
  return (
    <div className="presence-bar" aria-label="Participants">
      {[...grouped].map(([id, sessions]) => {
        const profile = guestProfile(id);
        return (
          <span
            className="presence-person"
            key={id}
            style={{ borderColor: profile.color }}
            title={sessions
              .map(
                (s) =>
                  `Tab ${s.tabId.slice(0, 4)}: ${s.hidden ? "away" : s.focused ? "focused" : "unfocused"}`,
              )
              .join("; ")}
          >
            <i style={{ background: profile.color }} />
            {profile.name}
            {id === presence.identity?.guestId ? " (you)" : ""} ·{" "}
            {sessions.every((s) => s.hidden) ? "away" : "active"}
            {sessions.length > 1 ? ` · ${sessions.length} tabs` : ""}
          </span>
        );
      })}
      <label>
        <input
          type="checkbox"
          checked={presence.show}
          onChange={presence.toggle}
        />{" "}
        Show collaborator activity
      </label>
      {presence.error && <span role="status">{presence.error}</span>}
    </div>
  );
}
