import { prisma } from "../lib/prisma";
import { getLocalDayKey } from "../lib/localTime";
import { defaultLocale, locales, translate, translatePlural, type Locale } from "../i18n";
import type { PushNotificationPayload } from "../lib/webPush";
import { getExpiringPantryItems, type ExpiringPantryItem } from "./pantry";
import { reminderTimeZone } from "./dinnerReminder";
import {
  dispatchToSubscriptionsOfSetting,
  sendPushToUser,
  type PushDispatchSummary
} from "./pushNotifications";

export { getExpiringPantryItems };
export type { ExpiringPantryItem };

const parseWarningDays = (rawValue: string | undefined, fallback: number): number => {
  const parsedValue = Number(rawValue);
  return Number.isInteger(parsedValue) && parsedValue >= 0 && parsedValue <= 365
    ? parsedValue
    : fallback;
};

/**
 * How far ahead counts as "going off soon". Three days is enough warning to
 * plan a meal around a tin without being so far out that the notification
 * becomes background noise.
 */
export const expiryWarningDays = parseWarningDays(
  process.env.PANTRY_EXPIRY_WARNING_DAYS,
  3
);

export type PantryExpiryReminder = {
  dayKey: string;
  items: ExpiringPantryItem[];
  payload: PushNotificationPayload | null;
};

const describeItem = (item: ExpiringPantryItem) =>
  `${item.name}${item.unit ? ` (${item.quantity} ${item.unit})` : ` (${item.quantity})`}`;

/**
 * Builds the "these are going off" notification for one calendar day, or `null`
 * when nothing is close enough to its date to be worth a buzz.
 *
 * Items already past their date are called out separately from the ones merely
 * approaching, because they need a different action: one is "use this up this
 * week", the other is "go and look at this now".
 */
export const buildPantryExpiryReminder = async (
  dayKey: string,
  locale: Locale = defaultLocale
): Promise<PantryExpiryReminder> => {
  const items = await getExpiringPantryItems(dayKey, expiryWarningDays);

  if (items.length === 0) {
    return { dayKey, items, payload: null };
  }

  const expiredItems = items.filter((item) => item.daysUntilExpiration < 0);
  const soonItems = items.filter((item) => item.daysUntilExpiration >= 0);

  const title =
    expiredItems.length > 0
      ? translatePlural(locale, "pantryExpiry.expiredTitle", expiredItems.length)
      : translatePlural(locale, "pantryExpiry.soonTitle", soonItems.length);

  // The body names what it can and counts the rest, so the notification stays
  // readable on a lock screen with a cupboard full of dated tins.
  const namedItems = items.slice(0, 3).map(describeItem);
  const remainingCount = items.length - namedItems.length;
  const body =
    remainingCount > 0
      ? translatePlural(locale, "pantryExpiry.bodyWithMore", remainingCount, {
          items: namedItems.join(", ")
        })
      : translate(locale, "pantryExpiry.body", { items: namedItems.join(", ") });

  return {
    dayKey,
    items,
    payload: {
      title,
      body,
      url: "/pantry",
      tag: `pantry-expiry-${dayKey}`
    }
  };
};

/** Today's reminder, using the configured reminder time zone. */
export const buildTodaysPantryExpiryReminder = (
  locale: Locale = defaultLocale
): Promise<PantryExpiryReminder> =>
  buildPantryExpiryReminder(getLocalDayKey(reminderTimeZone), locale);

/** Sends today's expiry reminder to one user, ignoring their opt-in setting. */
export const sendPantryExpiryReminderToUser = async (
  userId: number,
  locale: Locale = defaultLocale
): Promise<{ reminder: PantryExpiryReminder; summary: PushDispatchSummary }> => {
  const reminder = await buildTodaysPantryExpiryReminder(locale);

  if (!reminder.payload) {
    return { reminder, summary: { sent: 0, removed: 0, failed: 0 } };
  }

  return { reminder, summary: await sendPushToUser(userId, reminder.payload) };
};

/**
 * Sends one day's expiry reminder to every opted-in device, written once per
 * language the same way the dinner reminder is.
 */
export const sendPantryExpiryReminderToEveryone = async (
  dayKey: string
): Promise<{ reminder: PantryExpiryReminder; summary: PushDispatchSummary }> => {
  const remindersByLocale = new Map<Locale, PantryExpiryReminder>();

  for (const locale of locales) {
    remindersByLocale.set(locale, await buildPantryExpiryReminder(dayKey, locale));
  }

  const defaultReminder = remindersByLocale.get(defaultLocale)!;

  if (!defaultReminder.payload) {
    return { reminder: defaultReminder, summary: { sent: 0, removed: 0, failed: 0 } };
  }

  const summaries = await Promise.all(
    locales.map((locale) => {
      const payload = remindersByLocale.get(locale)!.payload;

      return payload
        ? dispatchToSubscriptionsOfSetting("pantryExpiryReminderEnabled", payload, locale)
        : Promise.resolve({ sent: 0, removed: 0, failed: 0 });
    })
  );

  const summary = summaries.reduce<PushDispatchSummary>(
    (total, current) => ({
      sent: total.sent + current.sent,
      removed: total.removed + current.removed,
      failed: total.failed + current.failed
    }),
    { sent: 0, removed: 0, failed: 0 }
  );

  return { reminder: defaultReminder, summary };
};

/** Records that a day's reminder went out, so a restart cannot repeat it. */
export const claimPantryExpiryDay = async (dayKey: string): Promise<boolean> => {
  const existingClaim = await prisma.pantryExpiryLog.findUnique({
    where: { dayKey },
    select: { id: true }
  });

  if (existingClaim) {
    return false;
  }

  try {
    await prisma.pantryExpiryLog.create({ data: { dayKey } });
    return true;
  } catch (error: unknown) {
    const isUniqueConstraintError =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002";

    if (isUniqueConstraintError) {
      return false;
    }

    throw error;
  }
};
