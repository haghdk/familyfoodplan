"use client";

import { useCallback, useEffect, useState } from "react";
import { BellRing, Send, Smartphone } from "lucide-react";
import { backendApiUrl } from "../../lib/auth";
import { useTranslations } from "../../lib/i18n/client";
import { localeHeader } from "../../lib/i18n/requestHeaders";
import Alert from "../ui/Alert";
import Button from "../ui/Button";
import { SectionCard } from "../ui/Card";
import ToggleSetting from "../ui/ToggleSetting";

export type PushConfig = {
  configured: boolean;
  publicKey: string | null;
  deviceCount: number;
  reminderTimeZone: string;
};

type NotificationSettingsProps = {
  initialDinnerReminderEnabled: boolean;
  push: PushConfig;
};

/** The browser wants the VAPID key as raw bytes, not as the base64url string. */
const urlBase64ToUint8Array = (base64String: string): Uint8Array<ArrayBuffer> => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = `${base64String}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(new ArrayBuffer(rawData.length));

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
};

const areKeysEqual = (first: ArrayBuffer | null, second: Uint8Array): boolean => {
  if (!first || first.byteLength !== second.byteLength) {
    return false;
  }

  const firstBytes = new Uint8Array(first);

  return second.every((byte, index) => firstBytes[index] === byte);
};

const isPushSupported = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

const isRunningStandalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true);

const isIosDevice = () =>
  typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);

const registerServiceWorker = async (): Promise<ServiceWorkerRegistration> => {
  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  return registration;
};

export default function NotificationSettings({
  initialDinnerReminderEnabled,
  push
}: NotificationSettingsProps) {
  const { locale, t, plural } = useTranslations();
  const [isEnabled, setIsEnabled] = useState(initialDinnerReminderEnabled);
  const [deviceCount, setDeviceCount] = useState(push.deviceCount);
  const [isThisDeviceRegistered, setIsThisDeviceRegistered] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [needsHomeScreenInstall, setNeedsHomeScreenInstall] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const saveSubscription = useCallback(
    async (subscription: PushSubscription) => {
      const response = await fetch(`${backendApiUrl}/api/push/subscriptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...localeHeader(locale) },
        credentials: "include",
        body: JSON.stringify(subscription.toJSON())
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(
          data.message || t("settings.notifications.registerFailed")
        );
      }

      const data = (await response.json()) as { deviceCount?: number };

      if (typeof data.deviceCount === "number") {
        setDeviceCount(data.deviceCount);
      }
    },
    [locale, t]
  );

  // Re-register on load: a subscription lives in the browser, so it can outlive
  // the server-side record (database reset, account change) and would then look
  // switched on while no notification could ever arrive.
  useEffect(() => {
    if (!isPushSupported()) {
      setIsSupported(false);
      return;
    }

    setNeedsHomeScreenInstall(isIosDevice() && !isRunningStandalone());

    let isActive = true;

    const syncExistingSubscription = async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        const subscription = await registration?.pushManager.getSubscription();

        if (!isActive || !subscription) {
          return;
        }

        setIsThisDeviceRegistered(true);

        if (initialDinnerReminderEnabled) {
          await saveSubscription(subscription);
        }
      } catch (_error) {
        // A failed re-sync is not worth an error banner: the toggle below still
        // fixes it, and it will be retried on the next visit.
      }
    };

    void syncExistingSubscription();

    return () => {
      isActive = false;
    };
  }, [initialDinnerReminderEnabled, saveSubscription]);

  const saveSetting = async (dinnerReminderEnabled: boolean) => {
    const response = await fetch(`${backendApiUrl}/api/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...localeHeader(locale) },
      credentials: "include",
      body: JSON.stringify({ dinnerReminderEnabled })
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { message?: string };
      throw new Error(data.message || t("settings.notifications.saveFailed"));
    }
  };

  const subscribeThisDevice = async () => {
    if (!push.configured || !push.publicKey) {
      throw new Error(t("settings.notifications.serverNotConfigured"));
    }

    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
      throw new Error(
        permission === "denied"
          ? t("settings.notifications.permissionDenied")
          : t("settings.notifications.permissionNotGranted")
      );
    }

    const registration = await registerServiceWorker();
    const applicationServerKey = urlBase64ToUint8Array(push.publicKey);
    const existingSubscription = await registration.pushManager.getSubscription();

    // A subscription created against a different VAPID key can never receive our
    // messages, so replace it rather than reusing it.
    if (
      existingSubscription &&
      !areKeysEqual(
        existingSubscription.options.applicationServerKey,
        applicationServerKey
      )
    ) {
      await existingSubscription.unsubscribe();
    }

    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey
      }));

    await saveSubscription(subscription);
    setIsThisDeviceRegistered(true);
  };

  const unsubscribeThisDevice = async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();

    if (!subscription) {
      setIsThisDeviceRegistered(false);
      return;
    }

    const response = await fetch(`${backendApiUrl}/api/push/subscriptions`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", ...localeHeader(locale) },
      credentials: "include",
      body: JSON.stringify({ endpoint: subscription.endpoint })
    });

    if (response.ok) {
      const data = (await response.json()) as { deviceCount?: number };

      if (typeof data.deviceCount === "number") {
        setDeviceCount(data.deviceCount);
      }
    }

    await subscription.unsubscribe();
    setIsThisDeviceRegistered(false);
  };

  const handleToggle = async (nextEnabled: boolean) => {
    setErrorMessage("");
    setStatusMessage("");
    setIsBusy(true);

    try {
      if (nextEnabled) {
        await subscribeThisDevice();
      } else {
        await unsubscribeThisDevice();
      }

      await saveSetting(nextEnabled);
      setIsEnabled(nextEnabled);
      setStatusMessage(
        nextEnabled
          ? t("settings.notifications.enabled")
          : t("settings.notifications.disabled")
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t("settings.notifications.updateFailed")
      );
    } finally {
      setIsBusy(false);
    }
  };

  const sendTestNotification = async () => {
    setErrorMessage("");
    setStatusMessage("");
    setIsBusy(true);

    try {
      const response = await fetch(`${backendApiUrl}/api/push/test`, {
        method: "POST",
        headers: localeHeader(locale),
        credentials: "include"
      });

      const data = (await response.json().catch(() => ({}))) as {
        message?: string;
      };

      if (!response.ok) {
        throw new Error(data.message || t("settings.notifications.testFailed"));
      }

      setStatusMessage(data.message || t("settings.notifications.testSent"));
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t("settings.notifications.testFailed")
      );
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <SectionCard
      description={t("settings.notifications.description", {
        timeZone: push.reminderTimeZone
      })}
      icon={<BellRing className="h-4 w-4" />}
      title={t("settings.notifications.title")}
    >
      <div className="space-y-4">
        {!push.configured ? (
          <Alert tone="warning">
            {t("settings.notifications.notConfiguredBefore")}{" "}
            <code>VAPID_PUBLIC_KEY</code>{" "}
            {t("settings.notifications.notConfiguredBetween")}{" "}
            <code>VAPID_PRIVATE_KEY</code>{" "}
            {t("settings.notifications.notConfiguredAfter")}
          </Alert>
        ) : null}

        {!isSupported ? (
          <Alert tone="warning">{t("settings.notifications.unsupported")}</Alert>
        ) : null}

        {needsHomeScreenInstall ? (
          <Alert tone="info">{t("settings.notifications.homeScreen")}</Alert>
        ) : null}

        <ToggleSetting
          checked={isEnabled}
          description={t("settings.notifications.toggleDescription")}
          disabled={isBusy || !isSupported || !push.configured}
          footer={
            <p className="flex items-center gap-1.5 text-xs text-fg-subtle">
              <Smartphone className="h-3.5 w-3.5" />
              {isThisDeviceRegistered
                ? t("settings.notifications.deviceRegistered")
                : t("settings.notifications.deviceNotRegistered")}
              <span className="text-fg-subtle">•</span>
              {plural("settings.notifications.devicesOnAccount", deviceCount)}
            </p>
          }
          label={t("settings.notifications.toggleLabel")}
          onChange={(nextEnabled) => {
            void handleToggle(nextEnabled);
          }}
        />

        {errorMessage ? <Alert tone="error">{errorMessage}</Alert> : null}
        {statusMessage ? <Alert tone="success">{statusMessage}</Alert> : null}

        <div>
          <Button
            disabled={isBusy || !isEnabled || !isThisDeviceRegistered}
            onClick={() => {
              void sendTestNotification();
            }}
            variant="secondary"
          >
            <Send className="h-4 w-4" />
            {t("settings.notifications.sendTest")}
          </Button>
          <p className="mt-2 text-xs text-fg-subtle">
            {t("settings.notifications.sendTestHint")}
          </p>
        </div>
      </div>
    </SectionCard>
  );
}
