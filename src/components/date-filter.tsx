import { useI18n } from "@/lib/i18n";
import { presetKeys, rangeForPreset, type DateRange, type PresetKey } from "@/lib/dates";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function DateFilter({
  preset,
  custom,
  onChange,
  onClear,
  placeholder,
}: {
  preset: PresetKey | null;
  custom: DateRange;
  onChange: (preset: PresetKey, custom: DateRange) => void;
  /** When provided, a clear button returns the list to its unfiltered default. */
  onClear?: () => void;
  placeholder?: string;
}) {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        {...(preset ? { value: preset } : {})}
        onValueChange={(v) => onChange(v as PresetKey, rangeForPreset(v as PresetKey, custom))}
      >
        <SelectTrigger className="w-44 bg-card">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {presetKeys.map((k) => (
            <SelectItem key={k} value={k}>
              {t(k)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {preset === "customRange" && (
        <div className="flex items-center gap-2">
          <Input
            type="date"
            className="w-40 bg-card"
            value={custom.from}
            onChange={(e) => onChange(preset, { ...custom, from: e.target.value })}
            aria-label={t("from")}
          />
          <span className="text-muted-foreground">—</span>
          <Input
            type="date"
            className="w-40 bg-card"
            value={custom.to}
            onChange={(e) => onChange(preset, { ...custom, to: e.target.value })}
            aria-label={t("to")}
          />
        </div>
      )}
      {onClear && preset && (
        <button
          type="button"
          onClick={onClear}
          className="text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          {t("clearFilter")}
        </button>
      )}
    </div>
  );
}
