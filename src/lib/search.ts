/**
 * Arabic-aware, token-based search matching for the menu.
 * Normalizes alef/ya/ta-marbuta variants and strips diacritics so that
 * customers typing any common spelling still find the item.
 */
export function normalizeArabic(s: string | null | undefined) {
  return (s ?? "")
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[\u064B-\u0652\u0640]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Split a query into normalized tokens (order-independent matching). */
export function searchTokens(query: string) {
  return normalizeArabic(query).split(" ").filter(Boolean);
}

/** Every token must appear somewhere in the combined normalized haystack. */
export function matchesTokens(tokens: string[], ...fields: (string | null | undefined)[]) {
  if (tokens.length === 0) return true;
  const hay = normalizeArabic(fields.filter(Boolean).join(" "));
  return tokens.every((tk) => hay.includes(tk));
}
