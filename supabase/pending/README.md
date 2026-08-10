# Pending Supabase SQL

This folder is currently empty by design. There are no pending SQL files waiting
for promotion.

Current applied archive: `supabase/applied/0001` through `0017`.

## Rule

Use this folder only as a temporary holding area for reviewed SQL that is ready
to apply but has not been applied yet. After application, move the file to
`supabase/applied/` and record the date there.

The next database change should preferably start a formal Supabase migration
chain instead of adding another one-off pending patch.

## Safe Application Process

1. Confirm the exact Supabase project and environment.
2. Back up or export the current schema and affected data.
3. Review the SQL and acceptance criteria for the change.
4. Apply to a disposable/staging project first.
5. Run DB authorization tests and read-only security verification.
6. Apply to production only with rollback evidence.
7. Move the file into `supabase/applied/` and record the applied date.
