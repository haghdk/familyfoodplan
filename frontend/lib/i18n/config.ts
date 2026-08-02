/** The languages the planner ships with. */
export const locales = ["en", "da"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

/**
 * Where the active language is kept. It is a plain (non `HttpOnly`) cookie so the
 * language picker can write it from the browser while server components, the
 * middleware, and the backend can all still read it off the request.
 */
export const localeCookieName = "ffp_locale";

export const localeCookieMaxAgeSeconds = 60 * 60 * 24 * 365;

/** Name of each language, written in that language. */
export const localeNames: Record<Locale, string> = {
  en: "English",
  da: "Dansk"
};

/** BCP 47 tags handed to `Intl` for date and number formatting. */
export const localeTags: Record<Locale, string> = {
  en: "en-US",
  da: "da-DK"
};

export const isLocale = (value: unknown): value is Locale =>
  typeof value === "string" && (locales as readonly string[]).includes(value);

/**
 * Turns anything that looks like a language tag into a supported locale.
 * `da`, `da-DK` and `DA` all resolve to Danish; anything else returns `null` so
 * callers can decide their own fallback.
 */
export const resolveLocale = (value: string | null | undefined): Locale | null => {
  if (!value) {
    return null;
  }

  const languageCode = value.trim().toLowerCase().split("-")[0];

  return isLocale(languageCode) ? languageCode : null;
};

/**
 * Picks the best supported language out of an `Accept-Language` header, so a
 * visitor who has never opened the settings screen still gets their own
 * language when the browser asks for it.
 */
export const parseAcceptLanguage = (header: string | null | undefined): Locale | null => {
  if (!header) {
    return null;
  }

  const preferences = header
    .split(",")
    .map((part) => {
      const [languageTag, ...parameters] = part.trim().split(";");
      const qualityParameter = parameters.find((parameter) =>
        parameter.trim().startsWith("q=")
      );
      const quality = qualityParameter
        ? Number.parseFloat(qualityParameter.trim().slice(2))
        : 1;

      return {
        locale: resolveLocale(languageTag),
        quality: Number.isNaN(quality) ? 0 : quality
      };
    })
    .filter((preference): preference is { locale: Locale; quality: number } =>
      Boolean(preference.locale)
    )
    .sort((first, second) => second.quality - first.quality);

  return preferences[0]?.locale ?? null;
};
