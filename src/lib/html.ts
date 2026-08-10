// Title: HTML Utilities
// Path: src/lib/html.ts
// Functionality: Shared HTML sanitization and rendering helpers for rich text content.

// Helpers for working with rich-text (HTML) notice bodies.

// Strip tags to plain text — for short previews (notification bell, search). Not a
// security boundary; rendering trusted HTML always goes through DOMPurify (NoticeBody).
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

// A rich-text editor emits "<p></p>" (or whitespace-only markup) when empty.
export function isRichTextEmpty(html: string): boolean {
  return stripHtml(html).length === 0;
}
