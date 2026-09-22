// Temporary demo timing: keep successful image drafts visible for at least 3 seconds.
const minimumImageLoadingMs = 3_000;

export async function waitForMinimumImageLoading(startedAt: number) {
  const remaining = minimumImageLoadingMs - (performance.now() - startedAt);
  if (remaining > 0)
    await new Promise<void>((resolve) => setTimeout(resolve, remaining));
}
