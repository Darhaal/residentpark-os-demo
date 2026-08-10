// Title: Authentication & Role-Aware Proxy Guard
// Path: src/proxy.ts
// Functionality: Unified Edge-level security gate.
// Handles session management, Role-Based Access Control (RBAC) for /admin,
// and enforces Open Redirect protection for the 'next' parameter.

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isAdminRole, isApprovedStatus } from '@/config/domain';
import { getSafeRedirectPath, isAdminRoutePath, isAuthEntryRoutePath, isPublicRoutePath, ROUTES } from '@/config/routes';
import { logger } from '@/lib/logger';

export default async function proxy(request: NextRequest) {
  // Correlation id for this request: reuse an upstream/CDN one or mint a new one.
  // Echoed on every response so logs and client-side reports can be tied together.
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  const tagged = (response: NextResponse) => {
    response.headers.set('x-request-id', requestId);
    return response;
  };

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;
  const isPublicRoute = isPublicRoutePath(pathname);
  const isAuthEntryRoute = isAuthEntryRoutePath(pathname);

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = ROUTES.login;
    if (pathname !== ROUTES.home) {
      url.searchParams.set('next', pathname);
    }
    return tagged(NextResponse.redirect(url));
  }

  if (user && isAuthEntryRoute) {
    const nextParam = request.nextUrl.searchParams.get('next');
    const safeNext = getSafeRedirectPath(nextParam);

    const url = request.nextUrl.clone();
    url.pathname = safeNext;
    url.searchParams.delete('next');
    return tagged(NextResponse.redirect(url));
  }

  if (user && isAdminRoutePath(pathname)) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, approval_status')
      .eq('id', user.id)
      .single();

    const isAuthorized = profile && isAdminRole(profile.role) && isApprovedStatus(profile.approval_status);

    if (!isAuthorized) {
      logger.warn('Blocked unauthorized admin access', { requestId, pathname, userId: user.id });
      const url = request.nextUrl.clone();
      url.pathname = ROUTES.home;
      return tagged(NextResponse.redirect(url));
    }
  }

  return tagged(supabaseResponse);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
