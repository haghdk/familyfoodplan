import { Router, type Response } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { isPushConfigured, pushPublicKey } from "../lib/webPush";
import { reminderTimeZone, sendDinnerReminderToUser } from "../services/dinnerReminder";
import {
  defaultLocale,
  isLocale,
  locales,
  requestLocale,
  translate,
  translatePlural,
  userLocale
} from "../i18n";

const settingsRouter = Router();

type SessionUser = {
  id: number;
  email: string;
  role: "ADMIN" | "VIEWER";
};

const getSessionUser = (response: Response): SessionUser =>
  response.locals.user as SessionUser;

/** Users who have never opened the settings screen have no row yet. */
const defaultSettings = {
  dinnerReminderEnabled: false,
  language: defaultLocale as string
};

const readSettings = async (userId: number) => {
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
    select: { dinnerReminderEnabled: true, language: true }
  });

  return settings ?? defaultSettings;
};

const countDevices = (userId: number) =>
  prisma.pushSubscription.count({ where: { userId } });

settingsRouter.get("/api/settings", requireAuth, async (_request, response) => {
  const user = getSessionUser(response);
  const [settings, deviceCount] = await Promise.all([
    readSettings(user.id),
    countDevices(user.id)
  ]);

  response.status(200).json({
    settings,
    push: {
      configured: isPushConfigured,
      publicKey: pushPublicKey || null,
      deviceCount,
      reminderTimeZone
    }
  });
});

/**
 * Updates one or both preferences. Each field is optional so the language
 * picker and the reminder toggle can save independently without either of them
 * having to resend the other's current value.
 */
settingsRouter.put("/api/settings", requireAuth, async (request, response) => {
  const locale = requestLocale(request);
  const user = getSessionUser(response);
  const { dinnerReminderEnabled, language } = request.body as {
    dinnerReminderEnabled?: unknown;
    language?: unknown;
  };

  if (dinnerReminderEnabled === undefined && language === undefined) {
    response
      .status(400)
      .json({ message: translate(locale, "settings.nothingToUpdate") });
    return;
  }

  if (
    dinnerReminderEnabled !== undefined &&
    typeof dinnerReminderEnabled !== "boolean"
  ) {
    response
      .status(400)
      .json({ message: translate(locale, "settings.reminderMustBeBoolean") });
    return;
  }

  if (language !== undefined && !isLocale(language)) {
    response.status(400).json({
      message: translate(locale, "settings.unsupportedLanguage", {
        languages: locales.join(", ")
      })
    });
    return;
  }

  const updates = {
    ...(dinnerReminderEnabled === undefined ? {} : { dinnerReminderEnabled }),
    ...(language === undefined ? {} : { language })
  };

  const settings = await prisma.userSettings.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      ...defaultSettings,
      ...updates
    },
    update: updates,
    select: { dinnerReminderEnabled: true, language: true }
  });

  response.status(200).json({ settings });
});

/**
 * Registers the calling browser for push. Keyed on the endpoint so re-sending
 * the same subscription is a no-op, and so a browser that is handed to another
 * account moves to that account instead of duplicating.
 */
settingsRouter.post("/api/push/subscriptions", requireAuth, async (request, response) => {
  const locale = requestLocale(request);
  const user = getSessionUser(response);
  const { endpoint, keys } = request.body as {
    endpoint?: unknown;
    keys?: { p256dh?: unknown; auth?: unknown };
  };

  const p256dhKey = keys?.p256dh;
  const authKey = keys?.auth;

  if (
    typeof endpoint !== "string" ||
    !endpoint.trim() ||
    typeof p256dhKey !== "string" ||
    !p256dhKey.trim() ||
    typeof authKey !== "string" ||
    !authKey.trim()
  ) {
    response.status(400).json({
      message: translate(locale, "settings.subscriptionRequired")
    });
    return;
  }

  const userAgent = request.headers["user-agent"];

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: {
      endpoint,
      p256dhKey,
      authKey,
      userAgent: typeof userAgent === "string" ? userAgent.slice(0, 255) : null,
      userId: user.id
    },
    update: {
      p256dhKey,
      authKey,
      userAgent: typeof userAgent === "string" ? userAgent.slice(0, 255) : null,
      userId: user.id
    }
  });

  response.status(200).json({
    success: true,
    deviceCount: await countDevices(user.id)
  });
});

settingsRouter.delete("/api/push/subscriptions", requireAuth, async (request, response) => {
  const locale = requestLocale(request);
  const user = getSessionUser(response);
  const { endpoint } = request.body as { endpoint?: unknown };

  if (typeof endpoint !== "string" || !endpoint.trim()) {
    response
      .status(400)
      .json({ message: translate(locale, "settings.endpointRequired") });
    return;
  }

  await prisma.pushSubscription.deleteMany({
    where: {
      endpoint,
      userId: user.id
    }
  });

  response.status(200).json({
    success: true,
    deviceCount: await countDevices(user.id)
  });
});

/**
 * Sends today's real reminder to the caller's own devices, so a user can check
 * both that push works and what the 10:00 message will say.
 */
settingsRouter.post("/api/push/test", requireAuth, async (request, response) => {
  const locale = requestLocale(request);
  const user = getSessionUser(response);

  if (!isPushConfigured) {
    response.status(503).json({
      message: translate(locale, "settings.pushNotConfigured")
    });
    return;
  }

  // The preview has to match the real 10:00 notification, which is written in
  // the account's language rather than in whatever this request asked for.
  const { reminder, summary } = await sendDinnerReminderToUser(
    user.id,
    await userLocale(user.id)
  );

  if (summary.sent === 0) {
    response.status(200).json({
      sent: 0,
      message:
        summary.removed > 0
          ? translate(locale, "settings.registrationExpired")
          : translate(locale, "settings.noDevices"),
      preview: reminder.payload
    });
    return;
  }

  response.status(200).json({
    sent: summary.sent,
    message: translatePlural(locale, "settings.testSent", summary.sent),
    preview: reminder.payload
  });
});

export default settingsRouter;
