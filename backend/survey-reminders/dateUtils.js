const CAIRO_TIME_ZONE = "Africa/Cairo";
const REMINDER_HOUR = 10;

function parseDateOnly(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.parse(`${value}T00:00:00Z`));
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return value;
}

function addCalendarDays(dateOnly, amount) {
  const validDate = parseDateOnly(dateOnly);
  if (!validDate || !Number.isInteger(amount)) {
    return null;
  }

  const date = new Date(Date.parse(`${validDate}T00:00:00Z`));
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function calendarDayDifference(startDate, endDate) {
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);
  if (!start || !end) {
    return null;
  }

  return Math.round(
    (Date.parse(`${end}T00:00:00Z`) -
      Date.parse(`${start}T00:00:00Z`)) /
      86400000
  );
}

function calculateReminderSchedule(openingDate, closingDate) {
  const opening = parseDateOnly(openingDate);
  const closing = parseDateOnly(closingDate);
  if (!opening || !closing) {
    return { valid: false, reason: "INVALID_SURVEY_DATES" };
  }

  const durationDays = calendarDayDifference(opening, closing);
  if (durationDays === null || durationDays <= 0) {
    return { valid: false, reason: "INVALID_SURVEY_DATES" };
  }
  if (durationDays < 3) {
    return { valid: false, reason: "SURVEY_DURATION_TOO_SHORT" };
  }

  const dueDate = addCalendarDays(closing, -3);
  return {
    valid: true,
    openingDate: opening,
    closingDate: closing,
    durationDays,
    dueDate,
    dueTime: "10:00",
    timeZone: CAIRO_TIME_ZONE,
    dueAtLocal: `${dueDate}T10:00:00`,
  };
}

function getCairoDateTime(now = new Date()) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    return null;
  }

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: CAIRO_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  return {
    date: `${values.year}-${values.month}-${values.day}`,
    hour: Number(values.hour),
    minute: Number(values.minute),
  };
}

function isSurveyOpenInCairo(openingDate, closingDate, now = new Date()) {
  const opening = parseDateOnly(openingDate);
  const closing = parseDateOnly(closingDate);
  const cairoNow = getCairoDateTime(now);
  if (!opening || !closing || !cairoNow) {
    return false;
  }

  return opening <= cairoNow.date && cairoNow.date <= closing;
}

function isReminderDue(schedule, now = new Date()) {
  const cairoNow = getCairoDateTime(now);
  if (!schedule?.valid || !cairoNow) {
    return false;
  }

  if (
    cairoNow.hour < REMINDER_HOUR ||
    cairoNow.date < schedule.dueDate ||
    cairoNow.date > schedule.closingDate ||
    cairoNow.date < schedule.openingDate
  ) {
    return false;
  }

  return true;
}

function formatCairoDate(dateOnly) {
  const validDate = parseDateOnly(dateOnly);
  if (!validDate) {
    return null;
  }

  const date = new Date(Date.parse(`${validDate}T12:00:00Z`));
  return new Intl.DateTimeFormat("en-US", {
    timeZone: CAIRO_TIME_ZONE,
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

module.exports = {
  CAIRO_TIME_ZONE,
  REMINDER_HOUR,
  addCalendarDays,
  calculateReminderSchedule,
  calendarDayDifference,
  formatCairoDate,
  getCairoDateTime,
  isReminderDue,
  isSurveyOpenInCairo,
  parseDateOnly,
};
