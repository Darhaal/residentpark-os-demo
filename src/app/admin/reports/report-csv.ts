// Title: Reports CSV Utilities
// Path: src/app/admin/reports/report-csv.ts
// Functionality: Build safe CSV exports for admin report tables.

type CsvValue = string | number | null;

const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export function csvCell(value: CsvValue) {
  if (value == null) return '""';

  const text = String(value);
  const escapedText = FORMULA_PREFIX.test(text) ? "'" + text : text;

  return `"${escapedText.replace(/"/g, '""')}"`;
}

export function buildCSV(headers: readonly string[], rows: readonly (readonly CsvValue[])[]) {
  return [
    headers.map(csvCell).join(','),
    ...rows.map(row => row.map(csvCell).join(',')),
  ].join('\n');
}
