import { useEffect, useState } from "react";
import { rangeForPreset, todayInCairo, type DateRange, type PresetKey } from "@/lib/dates";

/**
 * Cairo's current calendar day, re-evaluated on a timer so an admin screen left
 * open across midnight (Africa/Cairo) rolls over to the new day on its own.
 */
export function useCairoToday() {
  const [today, setToday] = useState(todayInCairo);
  useEffect(() => {
    const id = setInterval(() => {
      const now = todayInCairo();
      setToday((prev) => (prev === now ? prev : now));
    }, 30_000);
    return () => clearInterval(id);
  }, []);
  return today;
}

/**
 * Resolves a preset (or the custom range) into concrete Cairo-anchored dates,
 * recomputing automatically when the Cairo day changes.
 */
export function usePresetRange<P extends PresetKey | null>(
  preset: P,
  custom: DateRange,
): P extends null ? DateRange | null : DateRange {
  // Depending on the Cairo day keeps relative presets ("today", "last7", …) fresh.
  const today = useCairoToday();
  void today;
  if (!preset) return null as never;
  return (preset === "customRange" ? custom : rangeForPreset(preset)) as never;
}
