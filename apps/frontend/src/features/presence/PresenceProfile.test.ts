import { expect, test } from "vitest";
import type { Member } from "./Registry";
import { presenceProfile } from "./PresenceProfile";

const member = {
  id: "presence-id",
  guestId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  tabId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  hidden: false,
  focused: true,
} as Omit<Member, "profile">;

test("activity labels use only Anonymous or the member name", () => {
  expect(
    presenceProfile({ ...member, profile: { kind: "anonymous" } })
      .activityLabel,
  ).toBe("Anonymous");
  expect(
    presenceProfile({
      ...member,
      profile: { kind: "user", label: "Ada Lovelace" },
    }).activityLabel,
  ).toBe("Ada Lovelace");
});
