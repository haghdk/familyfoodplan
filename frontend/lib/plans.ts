import { backendApiUrl } from "./auth";
import type { Locale } from "./i18n/config";
import { localeHeader } from "./i18n/requestHeaders";

export const setPlanAsCurrent = async (planId: number, locale: Locale) => {
  const response = await fetch(`${backendApiUrl}/api/plans/${planId}/set-current`, {
    method: "POST",
    headers: localeHeader(locale),
    credentials: "include"
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { message?: string } | null;

    // Left empty when the backend said nothing: this helper has no dictionary of
    // its own, so the calling component supplies the fallback wording.
    throw new Error(data?.message ?? "");
  }

  return response.json() as Promise<{ message: string; planId: number }>;
};
