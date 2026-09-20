import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import "../workspaces/Workspace.css";
export type AdminUser = { id: string; name: string; email?: string };
export type AdminWorkspace = { id: string; name: string };
export type AdminMembership = {
  id: string;
  userName: string;
  workspaceName: string;
  role: string;
};
export function AdminPage({
  access,
  users,
  workspaces,
  memberships,
  error,
  onBack,
  pagination,
}: {
  access: "loading" | "allowed" | "denied";
  users: readonly AdminUser[];
  workspaces: readonly AdminWorkspace[];
  memberships: readonly AdminMembership[];
  error?: string;
  onBack: () => void;
  pagination?: ReactNode;
}) {
  const [tab, setTab] = useState<"users" | "workspaces" | "memberships">(
    "users",
  );
  return (
    <main className="workspace-dashboard">
      <header className="workspace-page-heading">
        <div>
          <p className="workspace-eyebrow">Administration · Read only</p>
          <h1>Workspace directory</h1>
        </div>
        <Button intent="outline" onPress={onBack}>
          Back to workspaces
        </Button>
      </header>
      {access === "loading" ? (
        <p role="status">Checking administrator access…</p>
      ) : access === "denied" ? (
        <div className="workspace-empty">
          <h2>Administrator access required</h2>
          <p>
            Your workspace access is unchanged. Return to your workspaces to
            continue.
          </p>
        </div>
      ) : error ? (
        <p role="alert">{error}</p>
      ) : (
        <>
          <nav
            aria-label="Directory sections"
            className="flex gap-2 mb-6 flex-wrap"
          >
            {(["users", "workspaces", "memberships"] as const).map((value) => (
              <Button
                key={value}
                intent={tab === value ? "secondary" : "plain"}
                onPress={() => setTab(value)}
                aria-pressed={tab === value}
              >
                {value[0].toUpperCase() + value.slice(1)}
              </Button>
            ))}
          </nav>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">{tab} directory</caption>
              <thead className="bg-secondary">
                <tr>
                  {(tab === "users"
                    ? ["User", "Email", "ID"]
                    : tab === "workspaces"
                      ? ["Workspace", "ID"]
                      : ["User", "Workspace", "Role"]
                  ).map((label) => (
                    <th
                      key={label}
                      scope="col"
                      className="px-5 py-3 font-medium"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tab === "users" &&
                  users.map((user) => (
                    <tr key={user.id} className="border-t border-border">
                      <td className="px-5 py-4">{user.name}</td>
                      <td className="px-5 py-4 break-all">
                        {user.email ?? "—"}
                      </td>
                      <td className="px-5 py-4 font-mono text-xs break-all max-w-56">
                        {user.id}
                      </td>
                    </tr>
                  ))}
                {tab === "workspaces" &&
                  workspaces.map((workspace) => (
                    <tr key={workspace.id} className="border-t border-border">
                      <td className="px-5 py-4">{workspace.name}</td>
                      <td className="px-5 py-4 font-mono text-xs break-all max-w-56">
                        {workspace.id}
                      </td>
                    </tr>
                  ))}
                {tab === "memberships" &&
                  memberships.map((member) => (
                    <tr key={member.id} className="border-t border-border">
                      <td className="px-5 py-4">{member.userName}</td>
                      <td className="px-5 py-4">{member.workspaceName}</td>
                      <td className="px-5 py-4">{member.role}</td>
                    </tr>
                  ))}
                {(tab === "users"
                  ? users
                  : tab === "workspaces"
                    ? workspaces
                    : memberships
                ).length === 0 && (
                  <tr>
                    <td colSpan={3} className="p-5 text-muted-fg">
                      No {tab} to display.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {pagination && <div className="mt-5">{pagination}</div>}
        </>
      )}
    </main>
  );
}
