import {
  isClear,
  presenceParameters,
  type Activity,
  type Channel,
} from "@pluribus/core/presence/domain";
/** One in-flight and one replaceable pending message per independently ordered channel. */
export function createActivityQueue(
  send: (activity: Activity, sequence: number) => Promise<unknown>,
  failed: () => void,
) {
  const channels = new Map<
    Channel,
    {
      sequence: number;
      busy: boolean;
      pending: Activity | null;
      timer: ReturnType<typeof setTimeout> | null;
    }
  >();
  let live = true;
  function flush(kind: Channel) {
    const channel = channels.get(kind)!;
    channel.timer = null;
    if (!live || channel.busy || !channel.pending) return;
    const value = channel.pending;
    channel.pending = null;
    channel.busy = true;
    void send(value, ++channel.sequence)
      .catch(() => {
        if (live) failed();
      })
      .finally(() => {
        channel.busy = false;
        if (live && channel.pending)
          schedule(
            kind,
            isClear(channel.pending) ? 0 : presenceParameters.activityMs,
          );
      });
  }
  function schedule(kind: Channel, delay: number) {
    const channel = channels.get(kind)!;
    if (channel.timer !== null) clearTimeout(channel.timer);
    channel.timer = setTimeout(() => flush(kind), delay);
  }
  return {
    publish(activity: Activity) {
      let channel = channels.get(activity.kind);
      if (!channel) {
        channel = { sequence: 0, busy: false, pending: null, timer: null };
        channels.set(activity.kind, channel);
      }
      channel.pending = activity;
      if (isClear(activity)) schedule(activity.kind, 0);
      else if (channel.timer === null && !channel.busy)
        schedule(activity.kind, presenceParameters.activityMs);
    },
    dispose() {
      live = false;
      for (const c of channels.values()) {
        if (c.timer !== null) clearTimeout(c.timer);
        c.pending = null;
      }
    },
  };
}
