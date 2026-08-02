"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import {
  localeCookieMaxAgeSeconds,
  localeCookieName,
  type Locale
} from "./config";
import type { Dictionary, AppTranslator } from "./dictionaries";
import { createTranslatorFromDictionary } from "./translate";

const I18nContext = createContext<AppTranslator | null>(null);

type I18nProviderProps = {
  locale: Locale;
  /**
   * Only the active language is handed down, so a page never ships the messages
   * of a language nobody is reading.
   */
  dictionary: Dictionary;
  children: ReactNode;
};

export function I18nProvider({ locale, dictionary, children }: I18nProviderProps) {
  const translator = useMemo(
    () => createTranslatorFromDictionary<Dictionary>(locale, dictionary),
    [dictionary, locale]
  );

  return <I18nContext.Provider value={translator}>{children}</I18nContext.Provider>;
}

export const useTranslations = (): AppTranslator => {
  const translator = useContext(I18nContext);

  if (!translator) {
    throw new Error("useTranslations must be used inside an <I18nProvider>.");
  }

  return translator;
};

/**
 * Stores the chosen language on this browser. Server components read the same
 * cookie, so the next render — including the very first paint after a reload —
 * already comes back translated.
 */
export const writeLocaleCookie = (locale: Locale) => {
  document.cookie = `${localeCookieName}=${locale}; path=/; max-age=${localeCookieMaxAgeSeconds}; samesite=lax`;
};
