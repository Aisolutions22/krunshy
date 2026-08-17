import { useRef } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

type Props = {
  label: string;
  hint?: string;
  previewUrl?: string | null | undefined;
  hasValue: boolean;
  uploading?: boolean;
  previewClassName?: string;
  onSelect: (file: File) => void;
  onRemove: () => void;
};

/** Clearly-labelled upload control: visible preview + real button + remove action. */
export function ImageUpload({
  label,
  hint,
  previewUrl,
  hasValue,
  uploading = false,
  previewClassName = "size-20",
  onSelect,
  onRemove,
}: Props) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-muted/30 p-3">
      <div
        className={`grid ${previewClassName} shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-background`}
      >
        {previewUrl ? (
          <img src={previewUrl} alt={label} className="size-full object-contain" />
        ) : (
          <ImagePlus className="size-6 text-muted-foreground" aria-hidden="true" />
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="text-sm font-semibold">{label}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="gap-1.5"
          >
            {uploading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <ImagePlus className="size-4" aria-hidden="true" />
            )}
            {hasValue ? t("changeImage") : t("uploadImage")}
          </Button>
          {hasValue && !uploading && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5 text-destructive"
              onClick={onRemove}
            >
              <Trash2 className="size-4" aria-hidden="true" />
              {t("removeImage")}
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{hint ?? t("imageHint")}</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="sr-only"
          aria-label={label}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onSelect(file);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
