# ResidentPark OS Database Baseline

`baseline.sql` is the consolidated clean-rebuild snapshot for the public schema.

It contains product enums, 13 tables, constraints, indexes, grants, RLS policies,
the auth profile trigger, helper functions, and the application RPC layer.

## Use

- Use it for a new or intentionally reset Supabase project.
- Follow `REBUILD.md` and take a backup before destructive work.
- Apply all post-baseline migrations after it.
- Do not treat it as the ongoing migration history.
- Do not repeatedly run it against a populated production database.

## Historical SQL

Superseded reconstruction files are kept in a historical archive (not part of this copy). They are
reference material only and must not be applied as a migration chain.

## Post-Baseline Changes

Applied one-off SQL is archived in `supabase/applied/` (`0001`-`0006`, applied
2026-06-13). Un-applied targeted SQL goes in `supabase/pending/` (currently
empty). The project should eventually adopt numbered files under
`supabase/migrations/` with the Supabase CLI.
