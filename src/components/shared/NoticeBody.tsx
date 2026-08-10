// Title: Shared Notice Body
// Path: src/components/shared/NoticeBody.tsx
// Functionality: Safe rendering component for resident and admin notice content.

// Renders a rich-text (HTML) notice body, sanitized with DOMPurify.
// Sanitization runs on the client after mount, so SSR and the first client paint
// both render empty markup (no hydration mismatch) before the safe HTML appears.

'use client';

import { useEffect, useState } from 'react';
import DOMPurify from 'dompurify';

interface NoticeBodyProps {
  html: string;
  className?: string;
}

export function NoticeBody({ html, className }: NoticeBodyProps) {
  const [clean, setClean] = useState('');

  useEffect(() => {
    // Sanitize on the client only (DOMPurify needs the DOM). Server and the first
    // client paint both render empty, so there is no hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setClean(DOMPurify.sanitize(html, { USE_PROFILES: { html: true } }));
  }, [html]);

  return (
    <div
      className={`notice-prose${className ? ` ${className}` : ''}`}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
