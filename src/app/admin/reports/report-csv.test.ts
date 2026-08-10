// Title: Reports CSV Utilities Test
// Path: src/app/admin/reports/report-csv.test.ts
// Functionality: Unit coverage for safe report CSV generation.

import { describe, expect, it } from 'vitest';
import { buildCSV, csvCell } from './report-csv';

describe('csvCell', () => {
  it('quotes values and doubles inner quotes', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('he said "hi"')).toBe('"he said ""hi"""');
  });

  it('neutralizes formula-injection prefixes', () => {
    expect(csvCell('=1+1')).toBe('"\'=1+1"');
    expect(csvCell('+cmd')).toBe('"\'+cmd"');
    expect(csvCell('-2')).toBe('"\'-2"');
    expect(csvCell('@cmd')).toBe('"\'@cmd"');
    expect(csvCell('\tcmd')).toBe('"\'\tcmd"');
    expect(csvCell('\rcmd')).toBe('"\'\rcmd"');
  });

  it('renders null as an empty quoted cell', () => {
    expect(csvCell(null)).toBe('""');
  });
});

describe('buildCSV', () => {
  it('builds header and row content', () => {
    expect(buildCSV(['Plate', 'Owner'], [['ABC123', 'Ada']])).toBe('"Plate","Owner"\n"ABC123","Ada"');
  });

  it('handles large report exports without changing row order', () => {
    const rows = Array.from({ length: 5000 }, (_, index) => [`UNIT-${index}`, index]);
    const csv = buildCSV(['Unit', 'Residents'], rows);
    const lines = csv.split('\n');

    expect(lines).toHaveLength(5001);
    expect(lines.at(-1)).toBe('"UNIT-4999","4999"');
  });
});
