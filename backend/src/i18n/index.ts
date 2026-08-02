import type { Request } from "express";
import { prisma } from "../lib/prisma";
import da from "./locales/da.json";
import en from "./locales/en.json";

export const locales = ["en", "da"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

/** BCP 47 tags handed to `Intl`, matching the frontend's. */
export const localeTags: Record<Locale, string> = {
  en: "en-US",
  da: "da-DK"
};

/**
 * English is the reference dictionary; Danish is typed against it, so a missing
 * translation is a build error rather than a key name in someone's inbox.
 */
export type Dictionary = typeof en;

const dictionaries: Record<Locale, Dictionary> = { en, da };

export const isLocale = (value: unknown): value is Locale =>
  typeof value === "string" && (locales as readonly string[]).includes(value);

export const resolveLocale = (value: string | null | undefined): Locale | null => {
  if (!value) {
    return null;
  }

  const languageCode = value.trim().toLowerCase().split("-")[0];

  return isLocale(languageCode) ? languageCode : null;
};

const parseAcceptLanguage = (header: string | undefined): Locale | null => {
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

/**
 * The language to answer one request in.
 *
 * The frontend runs on its own origin, so its language cookie never reaches us;
 * it sends the chosen language as `Accept-Language` instead. A browser hitting
 * the API directly still gets its own preference honoured by the same header.
 */
export const requestLocale = (request: Request): Locale =>
  parseAcceptLanguage(request.headers["accept-language"]) ?? defaultLocale;

/**
 * The language stored on an account. Used where there is no request to read —
 * the daily reminder is sent by a scheduler, and the reset email is written for
 * whoever owns the address rather than for whoever asked.
 */
export const userLocale = async (userId: number): Promise<Locale> => {
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
    select: { language: true }
  });

  return resolveLocale(settings?.language) ?? defaultLocale;
};

type PluralForms = { one: string; other: string };

type MessageKey<TNode> = {
  [K in Extract<keyof TNode, string>]: TNode[K] extends string
    ? K
    : `${K}.${MessageKey<TNode[K]>}`;
}[Extract<keyof TNode, string>];

type PluralKey<TNode> = {
  [K in Extract<keyof TNode, string>]: TNode[K] extends string
    ? never
    : TNode[K] extends PluralForms
      ? K
      : `${K}.${PluralKey<TNode[K]>}`;
}[Extract<keyof TNode, string>];

export type MessageId = MessageKey<Dictionary>;
export type PluralId = PluralKey<Dictionary>;

type TranslationValues = Record<string, string | number>;

const readNode = (dictionary: unknown, key: string): unknown =>
  key
    .split(".")
    .reduce<unknown>(
      (node, segment) =>
        node && typeof node === "object"
          ? (node as Record<string, unknown>)[segment]
          : undefined,
      dictionary
    );

const interpolate = (template: string, values?: TranslationValues) => {
  if (!values) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    name in values ? String(values[name]) : placeholder
  );
};

export const translate = (
  locale: Locale,
  key: MessageId,
  values?: TranslationValues
): string => {
  const message = readNode(dictionaries[locale] ?? dictionaries[defaultLocale], key);

  return typeof message === "string" ? interpolate(message, values) : key;
};

/** English and Danish share the same one/other split, so the count decides. */
export const translatePlural = (
  locale: Locale,
  key: PluralId,
  count: number,
  values?: TranslationValues
): string => {
  const forms = readNode(dictionaries[locale] ?? dictionaries[defaultLocale], key);

  if (!forms || typeof forms !== "object") {
    return key;
  }

  const message = count === 1 ? (forms as PluralForms).one : (forms as PluralForms).other;

  return typeof message === "string"
    ? interpolate(message, { count, ...values })
    : key;
};
