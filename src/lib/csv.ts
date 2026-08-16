export function toCsv(rows: Record<string, unknown>[], headers: { key: string; label: string }[]) {
  const escape = (v: unknown) => {
    let s = v === null || v === undefined ? "" : String(v);
    // Neutralize spreadsheet formula injection: values starting with =, +, -, @,
    // tab or CR are executed as formulas by Excel/Sheets. Prefix with an apostrophe.
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = headers.map((h) => escape(h.label)).join(",");
  const body = rows.map((r) => headers.map((h) => escape(r[h.key])).join(",")).join("\n");
  return `${head}\n${body}`;
}

export function downloadCsv(filename: string, csv: string) {
  // BOM keeps Arabic readable when the file is opened in Excel.
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
