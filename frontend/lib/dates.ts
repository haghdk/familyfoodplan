import { localeTags, type Locale } from "./i18n/config";
import type { AppTranslator } from "./i18n/dictionaries";

/** Backend dates arrive either as `YYYY-MM-DD` or as a full ISO timestamp. */
export const toDayKey = (value: string | null | undefined) =>
  value ? value.slice(0, 10) : null;

const parseDayKey = (value: string) => {
  const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
};

// Building an Intl.DateTimeFormat is comparatively expensive and the same few
// combinations are used on every render, so they are made once per locale.
const formatterCache = new Map<string, Intl.DateTimeFormat>();

const getFormatter = (locale: Locale, options: Intl.DateTimeFormatOptions) => {
  const cacheKey = `${locale}:${JSON.stringify(options)}`;
  const cachedFormatter = formatterCache.get(cacheKey);

  if (cachedFormatter) {
    return cachedFormatter;
  }

  const formatter = new Intl.DateTimeFormat(localeTags[locale], {
    timeZone: "UTC",
    ...options
  });
  formatterCache.set(cacheKey, formatter);

  return formatter;
};

export type DateFormatter = {
  /** `Monday` / `mandag` */
  formatWeekday: (dayKey: string) => string;
  /** `Mar 4` / `4. mar.` */
  formatShortDate: (dayKey: string) => string;
  /** `Monday, Mar 4` / `mandag den 4. mar.` */
  formatDayLabel: (dayKey: string) => string;
  formatDateRange: (startDate: string | null, endDate: string | null) => string;
  /** A full ISO timestamp rendered as the locale's plain calendar date. */
  formatCalendarDate: (value: string) => string;
  /** `Mon, Mar 4` — the compact form used inside select options. */
  formatCompactDayLabel: (value: string) => string;
};

/**
 * Date helpers bound to one language. Everything that puts a date on screen goes
 * through here so weekday and month names follow the chosen language, and so the
 * words around a date range ("From …", "Dates not set") stay translatable.
 */
export const createDateFormatter = ({ locale, t }: AppTranslator): DateFormatter => {
  const formatWeekday = (dayKey: string) => {
    const date = parseDayKey(dayKey);

    return date
      ? getFormatter(locale, { weekday: "long" }).format(date)
      : dayKey;
  };

  const formatShortDate = (dayKey: string) => {
    const date = parseDayKey(dayKey);

    return date
      ? getFormatter(locale, { month: "short", day: "numeric" }).format(date)
      : dayKey;
  };

  const formatDayLabel = (dayKey: string) => {
    const date = parseDayKey(dayKey);

    return date
      ? getFormatter(locale, {
          weekday: "long",
          month: "short",
          day: "numeric"
        }).format(date)
      : dayKey;
  };

  const formatDateRange = (startDate: string | null, endDate: string | null) => {
    const startDayKey = toDayKey(startDate);
    const endDayKey = toDayKey(endDate);

    if (startDayKey && endDayKey) {
      return `${formatShortDate(startDayKey)} – ${formatShortDate(endDayKey)}`;
    }

    if (startDayKey) {
      return t("dates.from", { date: formatShortDate(startDayKey) });
    }

    if (endDayKey) {
      return t("dates.until", { date: formatShortDate(endDayKey) });
    }

    return t("dates.notSet");
  };

  const formatCalendarDate = (value: string) => {
    const parsedDate = new Date(value);

    return Number.isNaN(parsedDate.valueOf())
      ? ""
      : parsedDate.toLocaleDateString(localeTags[locale]);
  };

  const formatCompactDayLabel = (value: string) => {
    const parsedDate = new Date(value);

    if (Number.isNaN(parsedDate.valueOf())) {
      return value;
    }

    return parsedDate.toLocaleDateString(localeTags[locale], {
      weekday: "short",
      month: "short",
      day: "numeric"
    });
  };

  return {
    formatWeekday,
    formatShortDate,
    formatDayLabel,
    formatDateRange,
    formatCalendarDate,
    formatCompactDayLabel
  };
};

/** Today as a `YYYY-MM-DD` key, using the runtime's local calendar day. */
export const getTodayDayKey = () => {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");

  return `${now.getFullYear()}-${month}-${day}`;
};
