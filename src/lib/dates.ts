export type PresetKey =
  | "today"
  | "last7"
  | "last10"
  | "last30"
  | "thisMonth"
  | "lastMonth"
  | "last6Months"
  | "last7Months"
  | "customRange";

export const presetKeys: PresetKey[] = [
  "today",
  "last7",
  "last10",
  "last30",
  "thisMonth",
  "lastMonth",
  "last6Months",
  "last7Months",
  "customRange",
];

export type DateRange = { from: string; to: string };

/** The restaurant's business timezone. All date logic is anchored here. */
export const BUSINESS_TZ = "Africa/Cairo";

/** YYYY-MM-DD for an instant, as seen in Cairo. */
export function isoInCairo(d: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Today's calendar date in Cairo. */
export function todayInCairo() {
  return isoInCairo(new Date());
}

/** Cairo's UTC offset in minutes for a given instant (DST-aware). */
function cairoOffsetMinutes(at: Date) {
  const name = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TZ,
    timeZoneName: "longOffset",
  })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName")!.value; // e.g. "GMT+03:00"
  const m = /GMT([+-])(\d{2}):(\d{2})/.exec(name);
  if (!m) return 0;
  const sign = m[1] === "-" ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3]));
}

function shiftDays(dateStr: string, days: number) {
  const d = new Date(`${dateStr}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function firstOfMonth(dateStr: string, monthsBack: number) {
  const [y, m] = dateStr.split("-").map(Number) as [number, number, number];
  const d = new Date(Date.UTC(y, m - 1 - monthsBack, 1, 12));
  return d.toISOString().slice(0, 10);
}

function lastOfPrevMonth(dateStr: string) {
  const [y, m] = dateStr.split("-").map(Number) as [number, number, number];
  const d = new Date(Date.UTC(y, m - 1, 0, 12));
  return d.toISOString().slice(0, 10);
}

export function rangeForPreset(preset: PresetKey, custom?: DateRange): DateRange {
  const today = todayInCairo();
  const daysAgo = (n: number) => shiftDays(today, -n);
  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "last7":
      return { from: daysAgo(6), to: today };
    case "last10":
      return { from: daysAgo(9), to: today };
    case "last30":
      return { from: daysAgo(29), to: today };
    case "thisMonth":
      return { from: firstOfMonth(today, 0), to: today };
    case "lastMonth":
      return { from: firstOfMonth(today, 1), to: lastOfPrevMonth(today) };
    case "last6Months":
      return { from: firstOfMonth(today, 5), to: today };
    case "last7Months":
      return { from: firstOfMonth(today, 6), to: today };
    case "customRange":
      return custom ?? { from: daysAgo(29), to: today };
  }
}

/** Convert a Cairo wall-clock day boundary into the true UTC instant. */
function cairoBoundaryToUtcIso(dateStr: string, endOfDay: boolean) {
  const base = endOfDay ? `${dateStr}T23:59:59.999Z` : `${dateStr}T00:00:00.000Z`;
  const probe = new Date(`${dateStr}T12:00:00.000Z`);
  const offset = cairoOffsetMinutes(probe);
  return new Date(new Date(base).getTime() - offset * 60000).toISOString();
}

/** Inclusive upper bound (Cairo end of day) as a real UTC instant. */
export function endOfDayIso(dateStr: string) {
  return cairoBoundaryToUtcIso(dateStr, true);
}

/** Cairo start of day as a real UTC instant. */
export function startOfDayIso(dateStr: string) {
  return cairoBoundaryToUtcIso(dateStr, false);
}

export function formatDate(value: string | null | undefined, lang: "ar" | "en") {
  if (!value) return "—";
  const d = new Date(value);
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-GB", {
    timeZone: BUSINESS_TZ,
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}

export function formatDateTime(value: string | null | undefined, lang: "ar" | "en") {
  if (!value) return "—";
  const d = new Date(value);
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-GB", {
    timeZone: BUSINESS_TZ,
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

