import {
  assertActivity,
  type Activity,
  type PresenceContext,
} from "../domain/Activity";
export interface ActivityPort {
  currentSequence(channel: Activity["kind"]): Promise<number>;
  save(activity: Activity, sequence: number): Promise<void>;
}
/** Publish only a newer message on its channel, inside the authorized membership transaction. */
export async function publishActivity(
  context: PresenceContext,
  activity: Activity,
  sequence: number,
  port: ActivityPort,
) {
  assertActivity(context, activity, sequence);
  if (sequence <= (await port.currentSequence(activity.kind))) return false;
  await port.save(activity, sequence);
  return true;
}
