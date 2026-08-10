// Title: Supabase Server Client
// Path: src/lib/supabase/server.ts
// Functionality: Initializes the Supabase client for Next.js Server Components, Server Actions, and API routes.
// Automatically handles secure cookie reading and writing to maintain user sessions across the stack.

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  // In Next.js 15+, cookies() returns a Promise. We must await it.
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // This error is intentionally caught and ignored.
            // It occurs when trying to set cookies from a Server Component (which is read-only).
            // Middleware handles the actual cookie updates securely.
          }
        },
      },
    }
  )
}
