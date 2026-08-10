// Title: Auth Callback Route
// Path: src/app/auth/callback/route.ts
// Functionality: Next.js route handler that completes Supabase authentication callbacks.

// Exchanges Supabase auth codes for a session and returns users to a safe app path.

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSafeRedirectPath, ROUTES } from '@/config/routes';
import { AuthAcceptanceService } from '@/services/AuthAcceptanceService';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = getSafeRedirectPath(requestUrl.searchParams.get('next'));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // If this verified session came from an invited registration, accept the
      // invitation now that the email is confirmed. Token-bound: the RPC requires
      // the one-time token (stashed in user metadata at signUp) to match the
      // invited email. Best-effort — a failure must not block the redirect.
      const { data: { user } } = await supabase.auth.getUser();
      const inviteToken = user?.user_metadata?.invite_token;
      if (typeof inviteToken === 'string' && inviteToken) {
        try { await AuthAcceptanceService.consumeInvitation(supabase, inviteToken); } catch { /* non-blocking */ }
      }
      // Admin-provisioned accounts finalize on acceptance (0018); token-less and keyed
      // on the session identity. No-op for everyone else. Best-effort.
      try { await AuthAcceptanceService.finalizePendingAccount(supabase); } catch { /* non-blocking */ }
      return NextResponse.redirect(new URL(next, requestUrl.origin));
    }
  }

  return NextResponse.redirect(new URL(`${ROUTES.login}?error=auth-callback`, requestUrl.origin));
}
