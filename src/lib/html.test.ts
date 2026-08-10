// Title: HTML Utilities Tests
// Path: src/lib/html.test.ts
// Functionality: Unit coverage for HTML sanitization and rendering safety helpers.

import { describe, expect, it } from 'vitest';
import { isRichTextEmpty, stripHtml } from './html';

describe('stripHtml', () => {
  it('removes tags and collapses whitespace', () => {
    expect(stripHtml('<p>Hi <b>there</b></p>')).toBe('Hi there');
  });

  it('decodes common entities', () => {
    expect(stripHtml('a&nbsp;b')).toBe('a b');
    expect(stripHtml('x &amp; y')).toBe('x & y');
  });

  it('handles empty / whitespace-only markup', () => {
    expect(stripHtml('<p></p>')).toBe('');
    expect(stripHtml('   ')).toBe('');
  });
});

describe('isRichTextEmpty', () => {
  it('treats an empty paragraph as empty', () => {
    expect(isRichTextEmpty('<p></p>')).toBe(true);
    expect(isRichTextEmpty('   ')).toBe(true);
    expect(isRichTextEmpty('')).toBe(true);
  });

  it('treats real content as non-empty', () => {
    expect(isRichTextEmpty('<p>hello</p>')).toBe(false);
    expect(isRichTextEmpty('<ul><li>x</li></ul>')).toBe(false);
  });
});
