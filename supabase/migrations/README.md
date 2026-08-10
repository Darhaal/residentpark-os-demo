# Supabase Migrations

This directory is the canonical forward migration chain.

- `20260613000000` through `20260613000027` mirror the historical baseline plus
  `supabase/applied/0001` through `0027` byte-for-byte.
- `20260628000000` is the first migration authored only in the formal chain.
- Run `npm run verify:migrations` after changing database files.
- New database changes belong here. Do not add new numbered files to
  `supabase/applied/`.
- Do not run or repair this chain against live Supabase without a fresh schema
  export, backup, disposable reset proof, and owner-reviewed migration plan.

The historical `baseline/` and `applied/` sources remain read-only until live
migration metadata has been baselined and the old archive can be retired safely.
