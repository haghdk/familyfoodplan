import { prisma } from "../lib/prisma";
import { dayKeyToUtcDate, getLocalDayKey, resolveTimeZone } from "../lib/localTime";
import { defaultLocale, localeTags, locales, translate, type Locale } from "../i18n";
import type { PushNotificationPayload } from "../lib/webPush";
import {
  type PushDispatchSummary,
  sendPushToDinnerReminderSubscribers,
  sendPushToUser
} from "./pushNotifications";

/** Time zone the "today" in the reminder is measured in. */
export const reminderTimeZone = resolveTimeZone(
  process.env.DINNER_REMINDER_TIMEZONE || "Europe/Copenhagen"
);

const weekdayFormatters: Record<Locale, Intl.DateTimeFormat> = {
  en: new Intl.DateTimeFormat(localeTags.en, { weekday: "long", timeZone: "UTC" }),
  da: new Intl.DateTimeFormat(localeTags.da, { weekday: "long", timeZone: "UTC" })
};

export type DinnerReminder = {
  dayKey: string;
  /** The dinner planned for that day, or `null` when nothing is set. */
  dinnerName: string | null;
  planId: number | null;
  payload: PushNotificationPayload;
};

type PlanDayCandidate = {
  planId: number;
  isCurrent: boolean;
  dinnerName: string | null;
  dinnerNotes: string | null;
};

/**
 * Picks the plan day that answers "what is for dinner today".
 *
 * Plans can overlap, so the plan an admin marked as current wins first — that is
 * the same plan the homepage shows. Among the rest, a day that actually has a
 * dinner beats an empty one, and the newest plan breaks any remaining tie.
 */
const selectPlanDay = (candidates: PlanDayCandidate[]): PlanDayCandidate | null => {
  if (candidates.length === 0) {
    return null;
  }

  return [...candidates].sort((first, second) => {
    if (first.isCurrent !== second.isCurrent) {
      return first.isCurrent ? -1 : 1;
    }

    const firstHasDinner = Boolean(first.dinnerName);
    const secondHasDinner = Boolean(second.dinnerName);

    if (firstHasDinner !== secondHasDinner) {
      return firstHasDinner ? -1 : 1;
    }

    return second.planId - first.planId;
  })[0];
};

/** Builds the notification text for one calendar day (`YYYY-MM-DD`). */
export const buildDinnerReminder = async (
  dayKey: string,
  locale: Locale = defaultLocale
): Promise<DinnerReminder> => {
  const planDays = await prisma.planDay.findMany({
    where: {
      date: dayKeyToUtcDate(dayKey)
    },
    select: {
      planId: true,
      plan: {
        select: {
          isCurrent: true
        }
      },
      dinnerDish: {
        select: {
          name: true,
          notes: true
        }
      }
    }
  });

  const selectedDay = selectPlanDay(
    planDays.map((planDay) => ({
      planId: planDay.planId,
      isCurrent: planDay.plan.isCurrent,
      dinnerName: planDay.dinnerDish?.name?.trim() || null,
      dinnerNotes: planDay.dinnerDish?.notes?.trim() || null
    }))
  );

  const weekdayLabel = weekdayFormatters[locale].format(dayKeyToUtcDate(dayKey));
  const planUrl = selectedDay ? `/plan/${selectedDay.planId}` : "/";
  const tag = `dinner-reminder-${dayKey}`;

  if (!selectedDay?.dinnerName) {
    return {
      dayKey,
      dinnerName: null,
      planId: selectedDay?.planId ?? null,
      payload: {
        title: translate(locale, "dinnerReminder.nothingPlannedTitle"),
        body: translate(locale, "dinnerReminder.nothingPlannedBody", {
          weekday: weekdayLabel
        }),
        url: planUrl,
        tag
      }
    };
  }

  return {
    dayKey,
    dinnerName: selectedDay.dinnerName,
    planId: selectedDay.planId,
    payload: {
      title: translate(locale, "dinnerReminder.todaysDinnerTitle"),
      body: selectedDay.dinnerNotes
        ? `${selectedDay.dinnerName}\n${selectedDay.dinnerNotes}`
        : selectedDay.dinnerName,
      url: planUrl,
      tag
    }
  };
};

/** Today's reminder, using the configured reminder time zone. */
export const buildTodaysDinnerReminder = (
  locale: Locale = defaultLocale
): Promise<DinnerReminder> =>
  buildDinnerReminder(getLocalDayKey(reminderTimeZone), locale);

/** Sends today's reminder to a single user, ignoring their opt-in setting. */
export const sendDinnerReminderToUser = async (
  userId: number,
  locale: Locale = defaultLocale
): Promise<{ reminder: DinnerReminder; summary: PushDispatchSummary }> => {
  const reminder = await buildTodaysDinnerReminder(locale);
  const summary = await sendPushToUser(userId, reminder.payload);

  return { reminder, summary };
};

/**
 * Sends one day's reminder to every opted-in device.
 *
 * The text is built once per language and sent to the subscribers who asked for
 * it, so a household with a Danish and an English reader gets each of them a
 * notification they can read. The returned reminder is the default-language one,
 * which is what the scheduler logs.
 */
export const sendDinnerReminderToEveryone = async (
  dayKey: string
): Promise<{ reminder: DinnerReminder; summary: PushDispatchSummary }> => {
  const remindersByLocale = new Map<Locale, DinnerReminder>();

  for (const locale of locales) {
    remindersByLocale.set(locale, await buildDinnerReminder(dayKey, locale));
  }

  const summaries = await Promise.all(
    locales.map((locale) =>
      sendPushToDinnerReminderSubscribers(
        remindersByLocale.get(locale)!.payload,
        locale
      )
    )
  );

  const summary = summaries.reduce<PushDispatchSummary>(
    (total, current) => ({
      sent: total.sent + current.sent,
      removed: total.removed + current.removed,
      failed: total.failed + current.failed
    }),
    { sent: 0, removed: 0, failed: 0 }
  );

  return { reminder: remindersByLocale.get(defaultLocale)!, summary };
};
