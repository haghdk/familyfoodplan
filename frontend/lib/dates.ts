const weekdayFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  timeZone: "UTC"
});

const shortDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC"
});

const longDateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "short",
  day: "numeric",
  timeZone: "UTC"
});

/** Backend dates arrive either as `YYYY-MM-DD` or as a full ISO timestamp. */
export const toDayKey = (value: string | null | undefined) =>
  value ? value.slice(0, 10) : null;

const parseDayKey = (value: string) => {
  const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatWeekday = (value: string) => {
  const date = parseDayKey(value);
  return date ? weekdayFormatter.format(date) : value;
};

export const formatShortDate = (value: string) => {
  const date = parseDayKey(value);
  return date ? shortDateFormatter.format(date) : value;
};

export const formatDayLabel = (value: string) => {
  const date = parseDayKey(value);
  return date ? longDateFormatter.format(date) : value;
};

export const formatDateRange = (
  startDate: string | null,
  endDate: string | null
) => {
  const startDayKey = toDayKey(startDate);
  const endDayKey = toDayKey(endDate);

  if (startDayKey && endDayKey) {
    return `${formatShortDate(startDayKey)} – ${formatShortDate(endDayKey)}`;
  }

  if (startDayKey) {
    return `From ${formatShortDate(startDayKey)}`;
  }

  if (endDayKey) {
    return `Until ${formatShortDate(endDayKey)}`;
  }

  return "Dates not set";
};

/** Today as a `YYYY-MM-DD` key, using the runtime's local calendar day. */
export const getTodayDayKey = () => {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");

  return `${now.getFullYear()}-${month}-${day}`;
};
