// Title: Local Auth Email Capture Tests
// Path: src/test/local-mail.test.ts
// Functionality: Verifies Mailpit support, legacy Inbucket fallback, and confirmation-link decoding.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { waitForConfirmationLink } from '../../e2e/inbucket';

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('local auth email capture', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads and decodes a Supabase verification link from Mailpit', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('/api/v1/search?')) return jsonResponse({ messages: [{ ID: 'mailpit-message' }] });
      if (url.endsWith('/api/v1/message/mailpit-message')) {
        return jsonResponse({
          Text: '',
          HTML: '<a href="http://127.0.0.1:54321/auth/v1/verify?token=abc&amp;type=signup">Confirm</a>',
        });
      }
      return jsonResponse({}, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(waitForConfirmationLink('resident@example.test', 100)).resolves.toBe(
      'http://127.0.0.1:54321/auth/v1/verify?token=abc&type=signup',
    );
  });

  it('falls back to the legacy Inbucket mailbox API', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('/api/v1/search?')) return jsonResponse({}, 404);
      if (url.endsWith('/api/v1/mailbox/resident')) return jsonResponse([{ id: 'inbucket-message' }]);
      if (url.endsWith('/api/v1/mailbox/resident/inbucket-message')) {
        return jsonResponse({
          body: {
            text: 'http://127.0.0.1:54321/auth/v1/verify?token=legacy&type=signup',
          },
        });
      }
      if (url.endsWith('/api/v1/mailbox/resident%40example.test')) return jsonResponse([]);
      return jsonResponse({}, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(waitForConfirmationLink('resident@example.test', 100)).resolves.toContain('token=legacy');
  });

  it('reports capture-backend failures instead of pretending the mailbox is empty', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: 'unavailable' }, 500)));

    await expect(waitForConfirmationLink('resident@example.test', 100)).rejects.toThrow(
      /Mailpit request failed \(500\)/,
    );
  });
});
