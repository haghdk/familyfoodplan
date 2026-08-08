import { prisma } from "../lib/prisma";
import { getLocalDayKey, getLocalMinutesSinceMidnight } from "../lib/localTime";
import { isPushConfigured } from "../lib/webPush";
import { reminderTimeZone } from "../services/dinnerReminder";
import {
  claimPantryExpiryDay,
  expiryWarningDays,
  sendPantryExpiryReminderToEveryone
} from "../services/pantryExpiryReminder";

const TICK_INTERVAL_MS = 60 * 1000;

/** Same catch-up rule as the dinner reminder: late is fine, bedtime is not. */
const CATCH_UP_WINDOW_MINUTES = 120;

const parseHour = (rawValue: string | undefined, fallback: number): number => {
  const parsedValue = Number(rawValue);
  return Number.isInteger(parsedValue) && parsedValue >= 0 && parsedValue <= 23
    ? parsedValue
    : fallback;
};

const parseMinute = (rawValue: string | undefined, fallback: number): number => {
  const parsedValue = Number(rawValue);
  return Number.isInteger(parsedValue) && parsedValue >= 0 && parsedValue <= 59
    ? parsedValue
    : fallback;
};

// Earlier than the dinner reminder by default, so the two do not arrive as one
// indistinguishable buzz, and so "use the yoghurt today" lands before the day
// has been planned around something else.
const reminderHour = parseHour(process.env.PANTRY_EXPIRY_REMINDER_HOUR, 9);
const reminderMinute = parseMinute(process.env.PANTRY_EXPIRY_REMINDER_MINUTE, 0);
const reminderMinutesSinceMidnight = reminderHour * 60 + reminderMinute;
const isSchedulerEnabled = process.env.PANTRY_EXPIRY_REMINDER_ENABLED !== "false";

const formatTimeOfDay = (hour: number, minute: number) =>
  `${`${hour}`.padStart(2, "0")}:${`${minute}`.padStart(2, "0")}`;

let lastMissingKeysWarningDayKey: string | null = null;

const warnAboutMissingKeysOncePerDay = (dayKey: string) => {
  if (lastMissingKeysWarningDayKey === dayKey) {
    return;
  }

  lastMissingKeysWarningDayKey = dayKey;
  console.warn(
    "[pantry-expiry] VAPID keys are not configured, so today's reminder was skipped."
  );
};

const runDueReminder = async (now: Date = new Date()): Promise<void> => {
  const minutesSinceMidnight = getLocalMinutesSinceMidnight(reminderTimeZone, now);
  const minutesSinceReminderTime = minutesSinceMidnight - reminderMinutesSinceMidnight;

  if (
    minutesSinceReminderTime < 0 ||
    minutesSinceReminderTime > CATCH_UP_WINDOW_MINUTES
  ) {
    return;
  }

  const dayKey = getLocalDayKey(reminderTimeZone, now);

  if (!isPushConfigured) {
    warnAboutMissingKeysOncePerDay(dayKey);
    return;
  }

  if (!(await claimPantryExpiryDay(dayKey))) {
    return;
  }

  const { reminder, summary } = await sendPantryExpiryReminderToEveryone(dayKey);

  await prisma.pantryExpiryLog.update({
    where: { dayKey },
    data: { recipientCount: summary.sent, itemCount: reminder.items.length }
  });

  // A day where nothing is close to its date is claimed and logged like any
  // other, so a quiet cupboard is not re-checked every minute for two hours.
  if (reminder.items.length === 0) {
    console.log(`[pantry-expiry] ${dayKey}: nothing expiring, no notification sent.`);
    return;
  }

  console.log(
    `[pantry-expiry] ${dayKey}: ${reminder.items.length} item(s) within ` +
      `${expiryWarningDays} day(s) — sent ${summary.sent}, removed ${summary.removed} expired, ` +
      `${summary.failed} failed.`
  );
};

/**
 * Starts the daily pantry expiry loop and returns a function that stops it.
 * Ticks every minute for the same reason the dinner reminder does: clock
 * changes and suspensions must not make it drift or oversleep.
 */
export const startPantryExpiryScheduler = (): (() => void) => {
  if (!isSchedulerEnabled) {
    console.log(
      "[pantry-expiry] Scheduler disabled by PANTRY_EXPIRY_REMINDER_ENABLED=false."
    );
    return () => {};
  }

  console.log(
    `[pantry-expiry] Scheduled daily at ${formatTimeOfDay(reminderHour, reminderMinute)} ` +
      `(${reminderTimeZone}), warning ${expiryWarningDays} day(s) ahead.`
  );

  const tick = () => {
    runDueReminder().catch((error: unknown) => {
      console.error("[pantry-expiry] Failed to run the daily reminder:", error);
    });
  };

  const timer = setInterval(tick, TICK_INTERVAL_MS);

  timer.unref?.();
  tick();

  return () => clearInterval(timer);
};
