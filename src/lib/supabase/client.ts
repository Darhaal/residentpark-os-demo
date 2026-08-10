// Title: Supabase Browser Client
// Path: src/lib/supabase/client.ts
// Functionality: Initializes and exposes the Supabase client for React Client Components.
// This allows secure, direct database and authentication interactions from the user's browser.

import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}