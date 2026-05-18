-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 001: quotation_number column + atomic generator
-- ─────────────────────────────────────────────────────────────────────────────
-- PROBLEM:
--   1. The frontend reads/writes a `quotation_number` field on `quotations`,
--      but the column doesn't exist in the database. Writes silently lost
--      that field; reads returned undefined.
--   2. Even with the column, the previous client-side generation
--      (read latest + increment + insert) has a race condition under
--      concurrent users.
--
-- SOLUTION:
--   - Add the `quotation_number` column (TEXT, nullable initially).
--   - Backfill existing rows with COT-{year}-{padded sequential number}.
--   - Add a UNIQUE constraint.
--   - Create an atomic generator function using an advisory lock so
--     concurrent calls serialize and produce unique sequential numbers.
--
-- DEPLOY:
--   Run this in the Supabase SQL Editor.
--   Idempotent — safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Add the column if missing ─────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'quotations'
      AND column_name = 'quotation_number'
  ) THEN
    ALTER TABLE public.quotations
      ADD COLUMN quotation_number text;
  END IF;
END $$;

-- ── 2. Backfill existing rows that don't have a number yet ───────────────────
-- Each existing row gets COT-{creation_year}-{padded sequential within that year}.
WITH ordered AS (
  SELECT
    id,
    EXTRACT(YEAR FROM created_at)::int AS yr,
    ROW_NUMBER() OVER (
      PARTITION BY EXTRACT(YEAR FROM created_at)
      ORDER BY created_at
    ) AS seq
  FROM public.quotations
  WHERE quotation_number IS NULL
)
UPDATE public.quotations q
SET quotation_number = 'COT-' || o.yr || '-' || LPAD(o.seq::text, 4, '0')
FROM ordered o
WHERE q.id = o.id;

-- ── 3. Add unique constraint (skip if already present) ───────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'quotations_quotation_number_key'
      AND conrelid = 'public.quotations'::regclass
  ) THEN
    ALTER TABLE public.quotations
      ADD CONSTRAINT quotations_quotation_number_key UNIQUE (quotation_number);
  END IF;
END $$;

-- ── 4. Atomic generator function ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.generate_next_quotation_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year     int  := EXTRACT(YEAR FROM NOW())::int;
  v_prefix   text := 'COT-' || v_year || '-';
  v_last_num int;
BEGIN
  -- Serialize concurrent callers on a fixed advisory lock key.
  -- 9482631 is an arbitrary constant; any single int works.
  PERFORM pg_advisory_xact_lock(9482631);

  -- Highest existing sequential for the current year.
  SELECT COALESCE(
    MAX(NULLIF(SPLIT_PART(quotation_number, '-', 3), '')::int),
    0
  )
  INTO v_last_num
  FROM public.quotations
  WHERE quotation_number LIKE v_prefix || '%';

  RETURN v_prefix || LPAD((v_last_num + 1)::text, 4, '0');
END;
$$;

-- Allow client-side calls from authenticated and anon users.
GRANT EXECUTE ON FUNCTION public.generate_next_quotation_number() TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_next_quotation_number() TO anon;

-- ── 5. Quick sanity check (uncomment to verify after running) ────────────────
-- SELECT public.generate_next_quotation_number();
-- SELECT id, quotation_number, created_at FROM public.quotations ORDER BY created_at LIMIT 10;
