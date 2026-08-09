/**
 * Calendar helpers for a configurable time zone.
 *
 * The daily reminder has to fire at 10:00 *where the family lives*, which is not
 * necessarily the container's clock (Docker images typically run on UTC), so
 * every "what day/time is it" question goes through `Intl` with an explicit zone
 * instead of the process default.
 */

const isSupportedTimeZone = (timeZone: string): boolean => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch (_error) {
    return false;
  }
};

/** Falls back to UTC (with a warning) when the configured zone is unknown. */
export const resolveTimeZone = (timeZone: string | undefined): string => {
  const normalizedTimeZone = timeZone?.trim();

  if (!normalizedTimeZone) {
    return "UTC";
  }

  if (!isSupportedTimeZone(normalizedTimeZone)) {
    console.warn(
      `[time] Unknown time zone "${normalizedTimeZone}", falling back to UTC.`
    );
    return "UTC";
  }

  return normalizedTimeZone;
};

/**
 * The zone the household's calendar runs in, for the questions that are not a
 * reminder's — "has this plan's last day passed?" among them. Read from
 * `APP_TIMEZONE`, falling back to the reminder zone so a deployment that has
 * already said where the family lives does not have to say it twice.
 */
export const appTimeZone = resolveTimeZone(
  process.env.APP_TIMEZONE || process.env.DINNER_REMINDER_TIMEZONE || "Europe/Copenhagen"
);

/** The calendar day in `timeZone` as a `YYYY-MM-DD` key. */
export const getLocalDayKey = (timeZone: string, date: Date = new Date()): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);

/** Minutes elapsed since local midnight in `timeZone`. */
export const getLocalMinutesSinceMidnight = (
  timeZone: string,
  date: Date = new Date()
): number => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);

  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");

  return hour * 60 + minute;
};

/** Parses a `YYYY-MM-DD` key into the UTC midnight `Date` the plan days use. */
export const dayKeyToUtcDate = (dayKey: string): Date =>
  new Date(`${dayKey}T00:00:00.000Z`);
