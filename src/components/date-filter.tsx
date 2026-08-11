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
}: {
  preset: PresetKey;
  custom: DateRange;
  onChange: (preset: PresetKey, custom: DateRange) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={preset}
        onValueChange={(v) => onChange(v as PresetKey, rangeForPreset(v as PresetKey, custom))}
      >
        <SelectTrigger className="w-44 bg-card">
          <SelectValue />
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
    </div>
  );
}
