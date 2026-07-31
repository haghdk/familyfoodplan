import { Router, type Response } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { isPushConfigured, pushPublicKey } from "../lib/webPush";
import { reminderTimeZone, sendDinnerReminderToUser } from "../services/dinnerReminder";

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
  dinnerReminderEnabled: false
};

const readSettings = async (userId: number) => {
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
    select: { dinnerReminderEnabled: true }
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

settingsRouter.put("/api/settings", requireAuth, async (request, response) => {
  const user = getSessionUser(response);
  const { dinnerReminderEnabled } = request.body as {
    dinnerReminderEnabled?: unknown;
  };

  if (typeof dinnerReminderEnabled !== "boolean") {
    response.status(400).json({ message: "dinnerReminderEnabled must be a boolean." });
    return;
  }

  const settings = await prisma.userSettings.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      dinnerReminderEnabled
    },
    update: {
      dinnerReminderEnabled
    },
    select: { dinnerReminderEnabled: true }
  });

  response.status(200).json({ settings });
});

/**
 * Registers the calling browser for push. Keyed on the endpoint so re-sending
 * the same subscription is a no-op, and so a browser that is handed to another
 * account moves to that account instead of duplicating.
 */
settingsRouter.post("/api/push/subscriptions", requireAuth, async (request, response) => {
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
      message: "A push subscription with endpoint, keys.p256dh and keys.auth is required."
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
  const user = getSessionUser(response);
  const { endpoint } = request.body as { endpoint?: unknown };

  if (typeof endpoint !== "string" || !endpoint.trim()) {
    response.status(400).json({ message: "endpoint is required." });
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
settingsRouter.post("/api/push/test", requireAuth, async (_request, response) => {
  const user = getSessionUser(response);

  if (!isPushConfigured) {
    response.status(503).json({
      message: "Push notifications are not configured on the server."
    });
    return;
  }

  const { reminder, summary } = await sendDinnerReminderToUser(user.id);

  if (summary.sent === 0) {
    response.status(200).json({
      sent: 0,
      message:
        summary.removed > 0
          ? "This device's push registration had expired. Turn reminders off and on again."
          : "No devices are registered for this account yet.",
      preview: reminder.payload
    });
    return;
  }

  response.status(200).json({
    sent: summary.sent,
    message: `Test notification sent to ${summary.sent} device${summary.sent === 1 ? "" : "s"}.`,
    preview: reminder.payload
  });
});

export default settingsRouter;
