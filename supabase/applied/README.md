# Applied Supabase SQL (archive)

These one-off SQL files have already been applied according to the project
records. They are kept here for history and reproducibility.

Do not treat this archive as a substitute for a formal migration chain. A clean
rebuild starts from `supabase/baseline/baseline.sql` and replays the applied
archive in filename order.

Files ready but not yet applied belong in `supabase/pending/`. That folder is
currently empty except for its README.

## Applied files

| File | Applied | Purpose |
| --- | --- | --- |
| `get_resident_parking_map.sql` | 2026-06-08 | Privacy-safe resident garage map RPC; already part of `baseline.sql` on clean rebuilds. |
| `0001_security_hardening.sql` | 2026-06-13 | Profile self-update protection, resident vehicle ownership, privileged account boundary foundations. |
| `0002_parking_assignment_history.sql` | 2026-06-13 | Date-based Parking Map assignment history. |
| `0003_invitation_event_transactions.sql` | 2026-06-13 | Atomic invitation/event RPCs and superadmin audit boundary. |
| `0004_identity_apartment_invariants.sql` | 2026-06-13 | Occupancy and manager reconciliation. |
| `0005_remove_unused_rpcs.sql` | 2026-06-13 | Drops unused read RPCs. |
| `0006_invitation_consumption.sql` | 2026-06-13 | Invitation auto-consumption after registration; later runtime bug fixed by `0009`. |
| `0007_revoke_public_function_execute.sql` | 2026-06-15 | Revokes default PUBLIC/anon EXECUTE from privileged SECURITY DEFINER functions. |
| `0008_revoke_direct_table_writes.sql` | 2026-06-15 | Revokes direct core table writes so mutations go through RPCs. |
| `0009_fix_invitation_consume_status.sql` | 2026-06-15 | Fixes invalid invitation-consumption status comparison. |
| `0010_fix_disruption_restore_cast.sql` | 2026-06-18 | Fixes disruption completion enum casts. |
| `0011_fixed_settings_policy.sql` | 2026-06-19 | Enforces fixed operational policy and narrow portal-banner mutation. |
| `0012_preserve_apartment_manager.sql` | 2026-06-19 | Preserves existing eligible apartment manager by default. |
| `0013_parking_issue_lifecycle.sql` | 2026-06-19 | Hardens approved caller checks and multi-issue conflict restoration. |
| `0014_vehicle_transition_hardening.sql` | 2026-06-19 | Hardens vehicle owner/unit consistency, transitions, and assignment release. |
| `0015_account_status_authorization.sql` | 2026-06-19 | Requires approved account status across admin/resident DB authorization boundaries. |
| `0016_rate_limiting.sql` | 2026-06-19 | Adds DB-backed per-actor rate-limit windows. |
| `0017_token_bound_invitation.sql` | 2026-06-20 | Requires matching unexpired invitation token and verified authenticated email for invitation acceptance. |

## Replay order for a clean rebuild

1. `supabase/baseline/baseline.sql`
2. `0001_security_hardening.sql`
3. `0002_parking_assignment_history.sql`
4. `0003_invitation_event_transactions.sql`
5. `0004_identity_apartment_invariants.sql`
6. `0005_remove_unused_rpcs.sql`
7. `0006_invitation_consumption.sql`
8. `0007_revoke_public_function_execute.sql`
9. `0008_revoke_direct_table_writes.sql`
10. `0009_fix_invitation_consume_status.sql`
11. `0010_fix_disruption_restore_cast.sql`
12. `0011_fixed_settings_policy.sql`
13. `0012_preserve_apartment_manager.sql`
14. `0013_parking_issue_lifecycle.sql`
15. `0014_vehicle_transition_hardening.sql`
16. `0015_account_status_authorization.sql`
17. `0016_rate_limiting.sql`
18. `0017_token_bound_invitation.sql`

`get_resident_parking_map.sql` can be skipped on a clean rebuild because its RPC
is already part of `baseline.sql`.

## Verification rule

After replaying this archive in a disposable database, run:

```bash
npm.cmd run test:db
npm.cmd run verify:security
```

Do not run DB tests against the production project.
