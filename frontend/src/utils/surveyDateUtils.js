const CAIRO_TIME_ZONE = "Africa/Cairo";

function getDateOnly(value) {
  if (typeof value !== "string") {
    return null;
  }

  const match = /^(\d{4}-\d{2}-\d{2})(?:$|[T\s])/.exec(value);
  if (!match) {
    return null;
  }

  const [year, month, day] = match[1].split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return match[1];
}

function getCairoDate(now = new Date()) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    return null;
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CAIRO_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function isSurveyOpenOnCairoDate(openingDate, closingDate, now = new Date()) {
  const opening = getDateOnly(openingDate);
  const closing = getDateOnly(closingDate);
  const today = getCairoDate(now);

  return Boolean(opening && closing && today && opening <= today && today <= closing);
}

function getCairoCalendarDayDifference(closingDate, now = new Date()) {
  const closing = getDateOnly(closingDate);
  const today = getCairoDate(now);
  if (!closing || !today) {
    return null;
  }

  const closingDay = Date.parse(`${closing}T00:00:00Z`);
  const todayDay = Date.parse(`${today}T00:00:00Z`);
  return Math.round((closingDay - todayDay) / 86400000);
}

export {
  getCairoCalendarDayDifference,
  getDateOnly,
  isSurveyOpenOnCairoDate,
};
