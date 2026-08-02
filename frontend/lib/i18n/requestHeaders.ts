import type { Locale } from "./config";

/**
 * The backend lives on its own origin, so the language cookie never reaches it.
 * Messages the API produces and the UI shows verbatim — validation errors, rate
 * limiting, the push test result — are therefore asked for by header instead.
 */
export const localeHeader = (locale: Locale): Record<string, string> => ({
  "Accept-Language": locale
});
