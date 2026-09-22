import { guestProfile } from "@pluribus/core/presence/domain";
import type { Member } from "./Registry";

/** Resolve the backend identity classification into one shared visual profile. */
export function presenceProfile(member: Member) {
  const fallback = guestProfile(member.guestId);
  if (member.profile.kind === "anonymous")
    return {
      name: `Anonymous · ${fallback.name}`,
      activityLabel: "Anonymous",
      color: fallback.color,
      initials: "A",
      avatarUrl: null,
    };
  return {
    name: member.profile.label,
    activityLabel: member.profile.label,
    color: fallback.color,
    initials: member.profile.label.trim().slice(0, 1) || "P",
    avatarUrl: member.profile.avatarUrl ?? null,
  };
}
