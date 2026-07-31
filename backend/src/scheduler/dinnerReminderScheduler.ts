import { prisma } from "../lib/prisma";
import { getLocalDayKey, getLocalMinutesSinceMidnight } from "../lib/localTime";
import { isPushConfigured } from "../lib/webPush";
import { reminderTimeZone, sendDinnerReminderToEveryone } from "../services/dinnerReminder";

const TICK_INTERVAL_MS = 60 * 1000;

/**
 * How late the reminder may still go out. A backend that was restarting or down
 * at 10:00 should still tell everyone what is for dinner, but a container that
 * comes back at 21:00 should stay quiet rather than buzz phones at bedtime.
 */
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

const reminderHour = parseHour(process.env.DINNER_REMINDER_HOUR, 10);
const reminderMinute = parseMinute(process.env.DINNER_REMINDER_MINUTE, 0);
const reminderMinutesSinceMidnight = reminderHour * 60 + reminderMinute;
const isSchedulerEnabled = process.env.DINNER_REMINDER_ENABLED !== "false";

const formatTimeOfDay = (hour: number, minute: number) =>
  `${`${hour}`.padStart(2, "0")}:${`${minute}`.padStart(2, "0")}`;

const isUniqueConstraintError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code?: string }).code === "P2002";

/**
 * Reserves the day before sending.
 *
 * The unique `dayKey` makes this an atomic claim, so a restart mid-send — or a
 * second backend instance sharing the database — cannot send the same day twice.
 * The lookup first is only to keep the ordinary "already sent today" case off the
 * error log: every restart inside the catch-up window would otherwise report a
 * constraint violation that is entirely expected.
 */
const claimDay = async (dayKey: string): Promise<boolean> => {
  const existingClaim = await prisma.dinnerReminderLog.findUnique({
    where: { dayKey },
    select: { id: true }
  });

  if (existingClaim) {
    return false;
  }

  try {
    await prisma.dinnerReminderLog.create({
      data: { dayKey }
    });

    return true;
  } catch (error: unknown) {
    if (isUniqueConstraintError(error)) {
      return false;
    }

    throw error;
  }
};

let lastMissingKeysWarningDayKey: string | null = null;

const warnAboutMissingKeysOncePerDay = (dayKey: string) => {
  if (lastMissingKeysWarningDayKey === dayKey) {
    return;
  }

  lastMissingKeysWarningDayKey = dayKey;
  console.warn(
    "[dinner-reminder] VAPID keys are not configured, so today's reminder was skipped."
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

  if (!(await claimDay(dayKey))) {
    return;
  }

  const { reminder, summary } = await sendDinnerReminderToEveryone(dayKey);

  await prisma.dinnerReminderLog.update({
    where: { dayKey },
    data: { recipientCount: summary.sent }
  });

  console.log(
    `[dinner-reminder] ${dayKey}: ${reminder.dinnerName ?? "no dinner planned"} — ` +
      `sent ${summary.sent}, removed ${summary.removed} expired, ${summary.failed} failed.`
  );
};

/**
 * Starts the once-a-day reminder loop and returns a function that stops it.
 *
 * It ticks every minute rather than sleeping until the next 10:00 so that clock
 * changes, daylight saving transitions, and long process suspensions cannot make
 * it drift or oversleep the reminder.
 */
export const startDinnerReminderScheduler = (): (() => void) => {
  if (!isSchedulerEnabled) {
    console.log("[dinner-reminder] Scheduler disabled by DINNER_REMINDER_ENABLED=false.");
    return () => {};
  }

  console.log(
    `[dinner-reminder] Scheduled daily at ${formatTimeOfDay(reminderHour, reminderMinute)} ` +
      `(${reminderTimeZone}).`
  );

  const tick = () => {
    runDueReminder().catch((error: unknown) => {
      console.error("[dinner-reminder] Failed to run the daily reminder:", error);
    });
  };

  const timer = setInterval(tick, TICK_INTERVAL_MS);

  // Do not keep the process alive on this timer alone.
  timer.unref?.();
  tick();

  return () => clearInterval(timer);
};
