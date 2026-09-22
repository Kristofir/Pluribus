import { presenceParameters } from "@pluribus/core/presence/domain";
import { Avatar } from "../../components/ui/Avatar";
import type { PresenceView } from "./UsePresence";
import { presenceProfile } from "./PresenceProfile";
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
        const profile = presenceProfile(sessions[0]);
        const label = `${profile.name}${id === presence.identity?.guestId ? " (you)" : ""} · ${sessions.every((s) => s.hidden) ? "away" : "active"}${sessions.length > 1 ? ` · ${sessions.length} tabs` : ""}`;
        return (
          <Avatar
            className="presence-avatar"
            key={id}
            role="img"
            aria-label={label}
            title={label}
            style={{ background: profile.color }}
            tabIndex={0}
            size="md"
            src={profile.avatarUrl}
            alt={profile.avatarUrl ? profile.name : undefined}
            initials={profile.avatarUrl ? undefined : profile.initials}
          />
        );
      })}
      {presence.agents.map((agent) => {
        const label = `Agent: ${agent.label} · recently active`;
        return (
          <Avatar
            className="presence-avatar presence-agent"
            key={agent.id}
            role="img"
            aria-label={label}
            title={`${label}. MCP request within the last ${presenceParameters.agentRecentlyActiveMs / 1000} seconds`}
            tabIndex={0}
            size="md"
            initials="✦"
          />
        );
      })}
      {presence.error && <span role="status">{presence.error}</span>}
    </div>
  );
}
