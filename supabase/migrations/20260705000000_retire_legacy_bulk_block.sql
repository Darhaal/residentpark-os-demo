-- Title: Retire Legacy Bulk-Block RPC (roadmap F7)
-- Path: supabase/migrations/20260705000000_retire_legacy_bulk_block.sql
-- Functionality: Drops public.tx_bulk_block_spots. Its atomic replacement,
--   tx_bulk_block_and_relocate (20260630000000 + fixes), owns the whole
--   relocate/revoke/block workflow in one transaction and is CI-proven (run #52)
--   and live. The legacy primitive blocked spots and revoked assignments WITHOUT
--   relocating, relied on the retired service-side relocation loop (partial-commit
--   risk), and logged the synthetic `spot_number: 'BULK_ZONE'` event sentinel. No
--   application code references it (verified 2026-07-05); dropping it closes the
--   direct-RPC path to the weaker semantics, following the 0005/0019 precedent of
--   removing unused RPCs instead of leaving them callable.

BEGIN;

DROP FUNCTION IF EXISTS public.tx_bulk_block_spots(
  text, text, text, text, uuid, jsonb
);

COMMIT;
