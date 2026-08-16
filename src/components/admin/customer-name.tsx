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
  displayName?: string | null | undefined;
  fullName?: string | null | undefined;
  email?: string | null | undefined;
  className?: string | undefined;
  primaryClassName?: string | undefined;
  fallback?: string | undefined;
}) {
  const own = [fullName, email].filter(Boolean).join(" — ");
  const label = displayName?.trim();
  // Signup seeds display_name from full_name; treat that as "not set".
  const hasOverride = Boolean(label) && label !== (fullName ?? "").trim();
  const primary = label || fullName || email || fallback || "—";
  const showSecondary = hasOverride && own.length > 0;


  return (
    <span className={className}>
      <span className={`block truncate ${primaryClassName}`}>{primary}</span>
      {showSecondary && <span className="block truncate text-xs text-muted-foreground">{own}</span>}
    </span>
  );
}
