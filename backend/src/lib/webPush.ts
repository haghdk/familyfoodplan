import webpush from "web-push";

/**
 * Web Push configuration.
 *
 * Push messages are signed with a VAPID key pair that identifies this backend to
 * the browser push services. Generate a pair once with:
 *
 *   pnpm --dir backend push:vapid-keys
 *
 * and put the result in `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`. When the keys
 * are missing (the default for local development) nothing is sent and the
 * notification is logged to the console instead, mirroring how the mailer
 * behaves without SMTP credentials.
 */
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY?.trim() || "";
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY?.trim() || "";
const vapidSubject =
  process.env.VAPID_SUBJECT?.trim() || "mailto:no-reply@familyfoodplan.local";

export const isPushConfigured = Boolean(vapidPublicKey && vapidPrivateKey);

/** Safe to hand to the browser: it is the public half of the VAPID key pair. */
export const pushPublicKey = vapidPublicKey;

let hasConfiguredVapidDetails = false;

const ensureVapidDetails = () => {
  if (hasConfiguredVapidDetails) {
    return;
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  hasConfiguredVapidDetails = true;
};

export type PushNotificationPayload = {
  title: string;
  body: string;
  /** Relative path the browser opens when the notification is clicked. */
  url?: string;
  /** Replaces an earlier notification carrying the same tag. */
  tag?: string;
};

export type PushTarget = {
  endpoint: string;
  p256dhKey: string;
  authKey: string;
};

export type PushDeliveryResult =
  | { status: "sent" }
  | { status: "expired" }
  | { status: "failed"; error: unknown };

const readStatusCode = (error: unknown): number | null => {
  if (typeof error === "object" && error !== null && "statusCode" in error) {
    const statusCode = (error as { statusCode?: unknown }).statusCode;
    return typeof statusCode === "number" ? statusCode : null;
  }

  return null;
};

/**
 * Delivers one notification to one browser endpoint.
 *
 * `expired` means the push service has permanently rejected the endpoint (the
 * browser was uninstalled, the subscription was revoked, …), which is the
 * caller's cue to delete the stored subscription rather than retry it.
 */
export const sendPushNotification = async (
  target: PushTarget,
  payload: PushNotificationPayload
): Promise<PushDeliveryResult> => {
  if (!isPushConfigured) {
    console.warn(
      [
        "[push] VAPID keys are not configured, so this notification was not sent.",
        `  Endpoint: ${target.endpoint}`,
        `  Title:    ${payload.title}`,
        `  Body:     ${payload.body}`
      ].join("\n")
    );

    return { status: "failed", error: new Error("Push is not configured.") };
  }

  ensureVapidDetails();

  try {
    await webpush.sendNotification(
      {
        endpoint: target.endpoint,
        keys: {
          p256dh: target.p256dhKey,
          auth: target.authKey
        }
      },
      JSON.stringify(payload)
    );

    return { status: "sent" };
  } catch (error: unknown) {
    const statusCode = readStatusCode(error);

    if (statusCode === 404 || statusCode === 410) {
      return { status: "expired" };
    }

    return { status: "failed", error };
  }
};
