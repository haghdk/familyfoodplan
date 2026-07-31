import { prisma } from "../lib/prisma";
import { dayKeyToUtcDate, getLocalDayKey, resolveTimeZone } from "../lib/localTime";
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

const weekdayFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  timeZone: "UTC"
});

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
export const buildDinnerReminder = async (dayKey: string): Promise<DinnerReminder> => {
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

  const weekdayLabel = weekdayFormatter.format(dayKeyToUtcDate(dayKey));
  const planUrl = selectedDay ? `/plan/${selectedDay.planId}` : "/";
  const tag = `dinner-reminder-${dayKey}`;

  if (!selectedDay?.dinnerName) {
    return {
      dayKey,
      dinnerName: null,
      planId: selectedDay?.planId ?? null,
      payload: {
        title: "No dinner planned for today",
        body: `Nothing is set for dinner this ${weekdayLabel}. Tap to plan something.`,
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
      title: "Today's dinner",
      body: selectedDay.dinnerNotes
        ? `${selectedDay.dinnerName}\n${selectedDay.dinnerNotes}`
        : selectedDay.dinnerName,
      url: planUrl,
      tag
    }
  };
};

/** Today's reminder, using the configured reminder time zone. */
export const buildTodaysDinnerReminder = (): Promise<DinnerReminder> =>
  buildDinnerReminder(getLocalDayKey(reminderTimeZone));

/** Sends today's reminder to a single user, ignoring their opt-in setting. */
export const sendDinnerReminderToUser = async (
  userId: number
): Promise<{ reminder: DinnerReminder; summary: PushDispatchSummary }> => {
  const reminder = await buildTodaysDinnerReminder();
  const summary = await sendPushToUser(userId, reminder.payload);

  return { reminder, summary };
};

/** Sends one day's reminder to every opted-in device. */
export const sendDinnerReminderToEveryone = async (
  dayKey: string
): Promise<{ reminder: DinnerReminder; summary: PushDispatchSummary }> => {
  const reminder = await buildDinnerReminder(dayKey);
  const summary = await sendPushToDinnerReminderSubscribers(reminder.payload);

  return { reminder, summary };
};
