/**
 * Admin-facing customer label.
 * When an internal display_name exists it becomes the primary bold label and the
 * customer's own name/email is shown smaller beneath it for reference.
 */
export function CustomerName({
  displayName,
  fullName,
  email,
  className,
  primaryClassName = "font-semibold",
  fallback,
}: {
  displayName?: string | null;
  fullName?: string | null;
  email?: string | null;
  className?: string;
  primaryClassName?: string;
  fallback?: string;
}) {
  const own = [fullName, email].filter(Boolean).join(" — ");
  const primary = displayName?.trim() || fullName || email || fallback || "—";
  const showSecondary = Boolean(displayName?.trim()) && own.length > 0;

  return (
    <span className={className}>
      <span className={`block truncate ${primaryClassName}`}>{primary}</span>
      {showSecondary && <span className="block truncate text-xs text-muted-foreground">{own}</span>}
    </span>
  );
}
