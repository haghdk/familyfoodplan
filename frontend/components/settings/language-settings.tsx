"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { backendApiUrl } from "../../lib/auth";
import { useTranslations, writeLocaleCookie } from "../../lib/i18n/client";
import { localeNames, locales, type Locale } from "../../lib/i18n/config";
import { localeHeader } from "../../lib/i18n/requestHeaders";
import Alert from "../ui/Alert";
import { SectionCard } from "../ui/Card";
import { SelectField } from "../ui/Field";

type LanguageSettingsProps = {
  initialLanguage: Locale;
};

/**
 * The language picker. The choice is written twice on purpose: to the account,
 * so it follows the user to their other devices, and to a cookie, which is what
 * the server components on this device read while rendering.
 */
export default function LanguageSettings({ initialLanguage }: LanguageSettingsProps) {
  const router = useRouter();
  const { locale, t } = useTranslations();
  const [selectedLanguage, setSelectedLanguage] = useState<Locale>(initialLanguage);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const changeLanguage = async (nextLanguage: Locale) => {
    const previousLanguage = selectedLanguage;

    setSelectedLanguage(nextLanguage);
    setIsSaving(true);
    setErrorMessage("");
    setStatusMessage("");

    try {
      const response = await fetch(`${backendApiUrl}/api/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...localeHeader(locale) },
        credentials: "include",
        body: JSON.stringify({ language: nextLanguage })
      });

      if (!response.ok) {
        throw new Error(t("settings.language.saveFailed"));
      }

      writeLocaleCookie(nextLanguage);
      // The success line is written before the refresh so it is already in the
      // new language when the re-rendered page replaces this one.
      setStatusMessage(t("settings.language.saved"));
      router.refresh();
    } catch (error) {
      setSelectedLanguage(previousLanguage);
      setErrorMessage(
        error instanceof Error ? error.message : t("settings.language.saveFailed")
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SectionCard
      description={t("settings.language.description")}
      icon={<Languages className="h-4 w-4" />}
      title={t("settings.language.title")}
    >
      <div className="space-y-4">
        <SelectField
          disabled={isSaving}
          fieldClassName="max-w-xs"
          label={t("settings.language.label")}
          onChange={(event) => {
            void changeLanguage(event.target.value as Locale);
          }}
          value={selectedLanguage}
        >
          {locales.map((availableLocale) => (
            <option key={availableLocale} value={availableLocale}>
              {localeNames[availableLocale]}
            </option>
          ))}
        </SelectField>

        {errorMessage ? <Alert tone="error">{errorMessage}</Alert> : null}
        {statusMessage ? <Alert tone="success">{statusMessage}</Alert> : null}
      </div>
    </SectionCard>
  );
}
