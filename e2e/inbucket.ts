// Title: Local Auth Email Capture Helper
// Path: e2e/inbucket.ts
// Functionality: Reads Supabase Auth confirmation links from current Mailpit or legacy Inbucket stacks.

const MAIL_CAPTURE_URL = process.env.LOCAL_MAIL_URL
  ?? process.env.INBUCKET_URL
  ?? 'http://127.0.0.1:54324';

const VERIFY_LINK = /https?:\/\/[^\s"'<>]+\/auth\/v1\/verify\?[^\s"'<>]+/i;

interface MailCaptureResult {
  backend: 'Mailpit' | 'Inbucket';
  bodies: string[];
}

interface MailpitSummary {
  ID?: unknown;
}

interface InbucketSummary {
  id?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

async function responseJson(response: Response, backend: string, endpoint: string): Promise<unknown> {
  if (!response.ok) {
    throw new Error(`${backend} request failed (${response.status}) at ${endpoint}`);
  }
  try {
    return await response.json();
  } catch {
    throw new Error(`${backend} returned invalid JSON at ${endpoint}`);
  }
}

async function mailpitBodies(email: string): Promise<MailCaptureResult | null> {
  const endpoint = `${MAIL_CAPTURE_URL}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}&limit=50`;
  const response = await fetch(endpoint);
  if (response.status === 404) return null;

  const payload = await responseJson(response, 'Mailpit', endpoint);
  if (!isRecord(payload) || !Array.isArray(payload.messages)) {
    throw new Error(`Mailpit returned an invalid message list at ${endpoint}`);
  }

  const bodies: string[] = [];
  for (const summary of payload.messages as MailpitSummary[]) {
    if (typeof summary.ID !== 'string' || !summary.ID) continue;
    const messageEndpoint = `${MAIL_CAPTURE_URL}/api/v1/message/${encodeURIComponent(summary.ID)}`;
    const message = await responseJson(await fetch(messageEndpoint), 'Mailpit', messageEndpoint);
    if (!isRecord(message)) continue;
    bodies.push(`${typeof message.Text === 'string' ? message.Text : ''}\n${typeof message.HTML === 'string' ? message.HTML : ''}`);
  }

  return { backend: 'Mailpit', bodies };
}

function mailboxOf(email: string): string {
  return email.split('@')[0];
}

async function inbucketBodies(email: string): Promise<MailCaptureResult> {
  const bodies: string[] = [];
  const mailboxes = [mailboxOf(email), email];

  for (const mailbox of mailboxes) {
    const listEndpoint = `${MAIL_CAPTURE_URL}/api/v1/mailbox/${encodeURIComponent(mailbox)}`;
    const response = await fetch(listEndpoint);
    if (response.status === 404) continue;
    const payload = await responseJson(response, 'Inbucket', listEndpoint);
    if (!Array.isArray(payload)) {
      throw new Error(`Inbucket returned an invalid message list at ${listEndpoint}`);
    }

    for (const summary of payload as InbucketSummary[]) {
      if (typeof summary.id !== 'string' || !summary.id) continue;
      const messageEndpoint = `${listEndpoint}/${encodeURIComponent(summary.id)}`;
      const message = await responseJson(await fetch(messageEndpoint), 'Inbucket', messageEndpoint);
      if (!isRecord(message) || !isRecord(message.body)) continue;
      const text = typeof message.body.text === 'string' ? message.body.text : '';
      const html = typeof message.body.html === 'string' ? message.body.html : '';
      bodies.push(`${text}\n${html}`);
    }
  }

  return { backend: 'Inbucket', bodies };
}

async function capturedBodies(email: string): Promise<MailCaptureResult> {
  return await mailpitBodies(email) ?? inbucketBodies(email);
}

export function extractVerificationLink(body: string): string | null {
  return body.match(VERIFY_LINK)?.[0].replace(/&amp;/g, '&') ?? null;
}

export async function waitForConfirmationLink(email: string, timeoutMs = 30_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  let backend: MailCaptureResult['backend'] | 'unknown' = 'unknown';

  while (Date.now() < deadline) {
    const captured = await capturedBodies(email);
    backend = captured.backend;
    for (const body of captured.bodies) {
      const link = extractVerificationLink(body);
      if (link) return link;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 1_000));
  }

  throw new Error(
    `No confirmation email with a verify link for ${email} in ${backend} at ${MAIL_CAPTURE_URL} within ${timeoutMs}ms`,
  );
}
