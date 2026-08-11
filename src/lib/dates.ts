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

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function rangeForPreset(preset: PresetKey, custom?: DateRange): DateRange {
  const now = new Date();
  const today = iso(now);
  const daysAgo = (n: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - n);
    return iso(d);
  };
  const monthsAgo = (n: number) => {
    const d = new Date(now.getFullYear(), now.getMonth() - n, 1);
    return iso(d);
  };
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
      return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
    case "lastMonth":
      return {
        from: iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
        to: iso(new Date(now.getFullYear(), now.getMonth(), 0)),
      };
    case "last6Months":
      return { from: monthsAgo(5), to: today };
    case "last7Months":
      return { from: monthsAgo(6), to: today };
    case "customRange":
      return custom ?? { from: daysAgo(29), to: today };
  }
}

/** Inclusive upper bound for timestamptz comparisons. */
export function endOfDayIso(dateStr: string) {
  return `${dateStr}T23:59:59.999`;
}

export function startOfDayIso(dateStr: string) {
  return `${dateStr}T00:00:00.000`;
}

export function formatDate(value: string | null | undefined, lang: "ar" | "en") {
  if (!value) return "—";
  const d = new Date(value);
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}

export function formatDateTime(value: string | null | undefined, lang: "ar" | "en") {
  if (!value) return "—";
  const d = new Date(value);
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-GB", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}
