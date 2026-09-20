export type SourceStatus = "queued" | "fetching" | "ready" | "failed";
/** A response belongs only to the request revision which is still fetching. */
export function canCompleteSource(current:{revision:number;status:SourceStatus},revision:number) { return current.revision===revision && current.status==="fetching"; }
