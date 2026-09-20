/** Membership is a server-resolved fact; sign-in alone never grants resource access. */
export function assertWorkspaceMembership(userId: string | null, membership: { userId: string; workspaceId: string } | null, workspaceId: string) {
  if (!userId || !membership || membership.userId !== userId || membership.workspaceId !== workspaceId)
    throw new Error("Workspace access denied");
}
export function assertAdministrator(userId: string | null, administrator: { userId: string } | null) {
  if (!userId || administrator?.userId !== userId) throw new Error("Administrator access required");
}
