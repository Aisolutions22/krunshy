import { useI18n, pickName } from "@/lib/i18n";

/**
 * Shows the product name in the current UI language, with the other language
 * underneath in a muted line. Renders one line only when a translation is missing.
 */
export function DualName({
  ar,
  en,
  className,
}: {
  ar: string | null | undefined;
  en: string | null | undefined;
  className?: string;
}) {
  const { lang } = useI18n();
  const primary = (pickName(lang, ar, en) ?? "").trim();
  const other = ((lang === "ar" ? en : ar) ?? "").trim();
  return (
    <span className={className}>
      <span dir="auto">{primary}</span>
      {other && other !== primary && (
        <span dir="auto" className="block text-xs font-normal text-muted-foreground">
          {other}
        </span>
      )}
    </span>
  );
}
