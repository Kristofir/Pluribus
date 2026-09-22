import {
  isClear,
  presenceParameters,
  type Activity,
  type Channel,
} from "@pluribus/core/presence/domain";
/** Retain the latest channel state until acknowledged; retries reuse its sequence. */
export function createActivityQueue(
  send: (activity: Activity, sequence: number) => Promise<unknown>,
  failed: () => void,
) {
  const channels = new Map<
    Channel,
    {
      sequence: number;
      busy: boolean;
      lastSentAt: number;
      pending: Activity | null;
      retry: { activity: Activity; sequence: number } | null;
      retryDelay: number;
      timer: ReturnType<typeof setTimeout> | null;
    }
  >();
  let live = true;
  function flush(kind: Channel) {
    const channel = channels.get(kind)!;
    channel.timer = null;
    if (!live || channel.busy || (!channel.pending && !channel.retry)) return;
    const message = channel.pending
      ? { activity: channel.pending, sequence: ++channel.sequence }
      : channel.retry!;
    channel.pending = null;
    channel.retry = null;
    channel.busy = true;
    channel.lastSentAt = performance.now();
    void Promise.resolve()
      .then(() => {
        if (live) return send(message.activity, message.sequence);
      })
      .then(() => {
        channel.retryDelay = 100;
      })
      .catch(() => {
        if (!live) return;
        if (!channel.pending) channel.retry = message;
        failed();
      })
      .finally(() => {
        channel.busy = false;
        if (live && channel.pending)
          schedule(
            kind,
            isClear(channel.pending)
              ? 0
              : remainingDelay(kind, channel.lastSentAt),
          );
        else if (live && channel.retry) {
          schedule(kind, channel.retryDelay);
          channel.retryDelay = Math.min(channel.retryDelay * 2, 2000);
        }
      });
  }
  function remainingDelay(kind: Channel, lastSentAt: number) {
    return Math.max(
      0,
      (kind === "pointer" ? 40 : presenceParameters.activityMs) -
        (performance.now() - lastSentAt),
    );
  }
  function schedule(kind: Channel, delay: number) {
    const channel = channels.get(kind)!;
    if (channel.timer !== null) clearTimeout(channel.timer);
    channel.timer = setTimeout(() => flush(kind), delay);
  }
  return {
    publish(activity: Activity) {
      if (!live) return;
      let channel = channels.get(activity.kind);
      if (!channel) {
        channel = {
          sequence: 0,
          busy: false,
          lastSentAt: performance.now(),
          pending: null,
          retry: null,
          retryDelay: 100,
          timer: null,
        };
        channels.set(activity.kind, channel);
      }
      channel.pending = activity;
      if (channel.retry) {
        channel.retry = null;
        channel.retryDelay = 100;
        if (channel.timer !== null) clearTimeout(channel.timer);
        channel.timer = null;
      }
      if (isClear(activity)) schedule(activity.kind, 0);
      else if (channel.timer === null && !channel.busy)
        schedule(
          activity.kind,
          remainingDelay(activity.kind, channel.lastSentAt),
        );
    },
    dispose() {
      live = false;
      for (const c of channels.values()) {
        if (c.timer !== null) clearTimeout(c.timer);
        c.pending = null;
        c.retry = null;
      }
    },
  };
}
