import { cookies } from "next/headers";
import { Settings as SettingsIcon } from "lucide-react";
import { adminSessionCookieName, backendApiUrl } from "../../lib/auth";
import { defaultLocale, resolveLocale, type Locale } from "../../lib/i18n/config";
import { localeHeader } from "../../lib/i18n/requestHeaders";
import { getLocale, getTranslations } from "../../lib/i18n/server";
import LanguageSettings from "../../components/settings/language-settings";
import NotificationSettings, {
  type PushConfig
} from "../../components/settings/notification-settings";
import PageHeader from "../../components/ui/PageHeader";

type SettingsResponse = {
  settings: {
    dinnerReminderEnabled: boolean;
    pantryExpiryReminderEnabled: boolean;
    language?: string;
  };
  push: PushConfig;
};

const fallbackSettings: SettingsResponse = {
  settings: {
    dinnerReminderEnabled: false,
    pantryExpiryReminderEnabled: false
  },
  push: {
    configured: false,
    publicKey: null,
    deviceCount: 0,
    reminderTimeZone: "UTC",
    pantryExpiryWarningDays: 3
  }
};

const getSettings = async (locale: Locale): Promise<SettingsResponse> => {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(adminSessionCookieName)?.value;

  try {
    const response = await fetch(`${backendApiUrl}/api/settings`, {
      headers: {
        ...localeHeader(locale),
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
  const locale = await getLocale();
  const { t } = await getTranslations();
  const { settings, push } = await getSettings(locale);

  return (
    <section className="space-y-6">
      <PageHeader
        description={t("settings.description")}
        eyebrow={t("settings.eyebrow")}
        eyebrowIcon={<SettingsIcon className="h-3.5 w-3.5" />}
        title={t("settings.title")}
      />
      <LanguageSettings
        initialLanguage={resolveLocale(settings.language) ?? defaultLocale}
      />
      <NotificationSettings
        initialDinnerReminderEnabled={settings.dinnerReminderEnabled}
        initialPantryExpiryReminderEnabled={settings.pantryExpiryReminderEnabled}
        push={push}
      />
    </section>
  );
}
