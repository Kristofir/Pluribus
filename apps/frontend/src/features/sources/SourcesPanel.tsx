import { useMutation } from "convex/react";
import { api } from "@pluribus/backend/api";
import type { Id } from "@pluribus/backend/dataModel";
import { useRetainedQuery } from "../../hooks/UseRetainedQuery";
import { SourceCard } from "./SourceCard";
export function SourcesPanel({ workspaceId, selected, onSelect }: { workspaceId: Id<"workspaces">; selected: readonly string[]; onSelect: (id: string, included: boolean) => void }) {
  const sources = useRetainedQuery(api.Sources.list, { workspaceId });
  const request = useMutation(api.Sources.request);
  return <section className="space-y-5" aria-label="Web sources">
    <SourceCard unavailableReason={sources.failed ? "Source service is unavailable." : undefined} onFetch={async input => { await request({ workspaceId, ...input }); }} />
    {sources.failed ? <p role="alert">Sources could not load. Existing captures are retained.</p> : !sources.data ? <p role="status">Loading sources…</p> : sources.data.length === 0 ? <p className="text-sm text-muted-fg">No sources captured yet.</p> : null}
    {(sources.data ?? []).map(source => <div key={source.id} className="space-y-2"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selected.includes(source.id)} disabled={sources.failed || source.status !== "ready"} onChange={event => onSelect(source.id,event.target.checked)} />Include this source in agent context</label><SourceCard source={{ id: source.id, canvasId: source.canvasId, url: source.url, status: source.status === "queued" ? "fetching" : source.status, result: source.capture?.data ?? source.capture?.content, error: source.error }} unavailableReason={sources.failed ? "Source service is unavailable." : undefined} onFetch={async input => { await request({ workspaceId, sourceId: source.id, ...input }); }} /></div>)}
  </section>;
}
