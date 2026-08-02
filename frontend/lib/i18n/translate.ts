import type { Locale } from "./config";

/** A translated message that changes shape with a count. */
export type PluralForms = {
  one: string;
  other: string;
};

export type TranslationNode = string | PluralForms | { [key: string]: TranslationNode };

export type TranslationValues = Record<string, string | number>;

/**
 * Every dotted path in a dictionary that ends on a plain string, so a mistyped
 * key is a compile error rather than a placeholder shown to the user.
 */
export type MessageKey<TNode> = {
  [K in Extract<keyof TNode, string>]: TNode[K] extends string
    ? K
    : `${K}.${MessageKey<TNode[K]>}`;
}[Extract<keyof TNode, string>];

/** Every dotted path that ends on a `{ one, other }` pair. */
export type PluralKey<TNode> = {
  [K in Extract<keyof TNode, string>]: TNode[K] extends string
    ? never
    : TNode[K] extends PluralForms
      ? K
      : `${K}.${PluralKey<TNode[K]>}`;
}[Extract<keyof TNode, string>];

export type Translator<TDictionary> = {
  locale: Locale;
  /** Looks up a message, replacing every `{name}` with the matching value. */
  t: (key: MessageKey<TDictionary>, values?: TranslationValues) => string;
  /**
   * Looks up a counted message and picks its singular or plural form. `count` is
   * available to the message itself, so `{count} days` needs no extra value.
   */
  plural: (
    key: PluralKey<TDictionary>,
    count: number,
    values?: TranslationValues
  ) => string;
};

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

/**
 * Builds the translation functions for one already-loaded dictionary. Kept free
 * of any dictionary imports so client components pull in only the language they
 * were rendered with, rather than every language the app ships.
 */
export const createTranslatorFromDictionary = <TDictionary>(
  locale: Locale,
  dictionary: TDictionary
): Translator<TDictionary> => ({
  locale,
  t: (key, values) => {
    const message = readNode(dictionary, key);

    // A missing message shows its key: visibly wrong in review, but never a
    // blank label or a crash in front of a user.
    return typeof message === "string" ? interpolate(message, values) : key;
  },
  plural: (key, count, values) => {
    const forms = readNode(dictionary, key);

    if (!forms || typeof forms !== "object") {
      return key;
    }

    // English and Danish share the same one/other split, so the count alone
    // decides the form.
    const { one, other } = forms as PluralForms;
    const message = count === 1 ? one : other;

    return typeof message === "string"
      ? interpolate(message, { count, ...values })
      : key;
  }
});
