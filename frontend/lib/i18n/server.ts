import { cookies, headers } from "next/headers";
import {
  defaultLocale,
  localeCookieName,
  parseAcceptLanguage,
  resolveLocale,
  type Locale
} from "./config";
import { createTranslator, type AppTranslator } from "./dictionaries";

/**
 * The language this request should render in.
 *
 * The cookie wins because it is what the settings screen writes, and it is
 * seeded from the account's stored preference at login. Without one we fall back
 * to what the browser asks for, so a first visit is already in the right
 * language, and finally to English.
 */
export const getLocale = async (): Promise<Locale> => {
  const cookieStore = await cookies();
  const cookieLocale = resolveLocale(cookieStore.get(localeCookieName)?.value);

  if (cookieLocale) {
    return cookieLocale;
  }

  const headerList = await headers();

  return parseAcceptLanguage(headerList.get("accept-language")) ?? defaultLocale;
};

/** Translation functions for the current request, for use in server components. */
export const getTranslations = async (): Promise<AppTranslator> =>
  createTranslator(await getLocale());
