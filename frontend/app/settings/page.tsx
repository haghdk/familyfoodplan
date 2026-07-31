import { cookies } from "next/headers";
import { Settings as SettingsIcon } from "lucide-react";
import { adminSessionCookieName, backendApiUrl } from "../../lib/auth";
import NotificationSettings, {
  type PushConfig
} from "../../components/settings/notification-settings";
import PageHeader from "../../components/ui/PageHeader";

type SettingsResponse = {
  settings: {
    dinnerReminderEnabled: boolean;
  };
  push: PushConfig;
};

const fallbackSettings: SettingsResponse = {
  settings: {
    dinnerReminderEnabled: false
  },
  push: {
    configured: false,
    publicKey: null,
    deviceCount: 0,
    reminderTimeZone: "UTC"
  }
};

const getSettings = async (): Promise<SettingsResponse> => {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(adminSessionCookieName)?.value;

  try {
    const response = await fetch(`${backendApiUrl}/api/settings`, {
      headers: {
        ...(sessionToken
          ? { Cookie: `${adminSessionCookieName}=${sessionToken}` }
          : {})
      },
      cache: "no-store"
    });

    if (!response.ok) {
      return fallbackSettings;
    }

    return (await response.json()) as SettingsResponse;
  } catch (_error) {
    return fallbackSettings;
  }
};

export default async function SettingsPage() {
  const { settings, push } = await getSettings();

  return (
    <section className="space-y-6">
      <PageHeader
        description="Choose how the planner keeps you up to date. These settings apply to your account."
        eyebrow="Your account"
        eyebrowIcon={<SettingsIcon className="h-3.5 w-3.5" />}
        title="Settings"
      />
      <NotificationSettings
        initialDinnerReminderEnabled={settings.dinnerReminderEnabled}
        push={push}
      />
    </section>
  );
}
