import { prisma } from "../lib/prisma";
import { defaultLocale, locales, type Locale } from "../i18n";
import {
  type PushNotificationPayload,
  isPushConfigured,
  sendPushNotification
} from "../lib/webPush";

export type PushDispatchSummary = {
  /** Endpoints the push service accepted. */
  sent: number;
  /** Endpoints that were rejected as gone and have been deleted. */
  removed: number;
  /** Endpoints that failed for some other reason and were kept for next time. */
  failed: number;
};

const emptySummary: PushDispatchSummary = { sent: 0, removed: 0, failed: 0 };

type StoredSubscription = {
  id: number;
  endpoint: string;
  p256dhKey: string;
  authKey: string;
};

const dispatchToSubscriptions = async (
  subscriptions: StoredSubscription[],
  payload: PushNotificationPayload
): Promise<PushDispatchSummary> => {
  if (subscriptions.length === 0) {
    return { ...emptySummary };
  }

  const summary: PushDispatchSummary = { ...emptySummary };
  const expiredSubscriptionIds: number[] = [];

  const results = await Promise.all(
    subscriptions.map(async (subscription) => ({
      subscription,
      result: await sendPushNotification(subscription, payload)
    }))
  );

  for (const { subscription, result } of results) {
    if (result.status === "sent") {
      summary.sent += 1;
      continue;
    }

    if (result.status === "expired") {
      expiredSubscriptionIds.push(subscription.id);
      summary.removed += 1;
      continue;
    }

    summary.failed += 1;
    console.error(
      `[push] Failed to notify ${subscription.endpoint}:`,
      result.error
    );
  }

  if (expiredSubscriptionIds.length > 0) {
    await prisma.pushSubscription.deleteMany({
      where: {
        id: {
          in: expiredSubscriptionIds
        }
      }
    });
  }

  return summary;
};

const subscriptionSelect = {
  id: true,
  endpoint: true,
  p256dhKey: true,
  authKey: true
} as const;

/** Notifies every device belonging to one user, regardless of their settings. */
export const sendPushToUser = async (
  userId: number,
  payload: PushNotificationPayload
): Promise<PushDispatchSummary> => {
  if (!isPushConfigured) {
    return { ...emptySummary };
  }

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
    select: subscriptionSelect
  });

  return dispatchToSubscriptions(subscriptions, payload);
};

/**
 * Notifies every registered device whose owner has the daily dinner reminder
 * switched on. Turning the reminder on is what registers a device in the first
 * place, so a user without a settings row has nothing to notify anyway.
 *
 * Passing a `locale` narrows the send to the users reading in that language, so
 * the caller can dispatch one already-translated payload per language. The
 * default language also picks up any account whose stored value is not a
 * language we ship, so an unexpected value never silences someone's reminder.
 */
export const sendPushToDinnerReminderSubscribers = async (
  payload: PushNotificationPayload,
  locale?: Locale
): Promise<PushDispatchSummary> => {
  if (!isPushConfigured) {
    return { ...emptySummary };
  }

  const languageFilter =
    locale === undefined
      ? {}
      : locale === defaultLocale
        ? { language: { notIn: locales.filter((other) => other !== defaultLocale) } }
        : { language: locale };

  const subscriptions = await prisma.pushSubscription.findMany({
    where: {
      user: {
        settings: {
          dinnerReminderEnabled: true,
          ...languageFilter
        }
      }
    },
    select: subscriptionSelect
  });

  return dispatchToSubscriptions(subscriptions, payload);
};
