// Title: Next.js Configuration
// Path: next.config.ts
// Functionality: Application runtime configuration for Next.js builds and local development.

import type { NextConfig } from "next";

// ── Content-Security-Policy ───────────────────────────────────────────────────
// Derive the Supabase origin so the browser may reach Auth/PostgREST/Realtime.
// Realtime uses a WebSocket, so the wss:// origin is allowed alongside https://.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
let supabaseHttp = "https://*.supabase.co";
let supabaseWss = "wss://*.supabase.co";
try {
  if (supabaseUrl) {
    const { host, protocol } = new URL(supabaseUrl);
    supabaseHttp = `${protocol}//${host}`;
    supabaseWss = `wss://${host}`;
  }
} catch {
  // Fall back to the wildcard Supabase origins above if the env var is malformed.
}

// Enforced as Content-Security-Policy (promoted from Report-Only and verified
// 2026-06-15 with a browser smoke: login + admin pages render with no CSP
// violations). `unsafe-inline`/`unsafe-eval` are required by the current Next.js
// runtime; tighten script-src to nonces in a later pass.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseHttp} ${supabaseWss}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

// Headers safe to enforce immediately — they do not alter normal app behaviour.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "Content-Security-Policy", value: csp },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
