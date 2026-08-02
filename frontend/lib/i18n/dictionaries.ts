import da from "../../locales/da.json";
import en from "../../locales/en.json";
import { defaultLocale, type Locale } from "./config";
import {
  createTranslatorFromDictionary,
  type MessageKey,
  type PluralKey,
  type Translator
} from "./translate";

/**
 * English is the reference dictionary: every other language is typed against it,
 * so a missing or misspelled Danish key fails the build instead of silently
 * falling back to a key name on screen.
 */
export type Dictionary = typeof en;

export type MessageId = MessageKey<Dictionary>;
export type PluralId = PluralKey<Dictionary>;
export type AppTranslator = Translator<Dictionary>;

const dictionaries: Record<Locale, Dictionary> = { en, da };

export const getDictionary = (locale: Locale): Dictionary =>
  dictionaries[locale] ?? dictionaries[defaultLocale];

export const createTranslator = (locale: Locale): AppTranslator =>
  createTranslatorFromDictionary<Dictionary>(locale, getDictionary(locale));
