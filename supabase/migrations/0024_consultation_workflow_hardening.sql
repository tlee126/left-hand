-- Phase 4.2: consultation workflow, append-only status history, and concurrency.

-- Existing rows start at version zero. Every real state transition increments
-- this token exactly once; same-state retries remain idempotent no-ops.
ALTER TABLE consultations
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 0;

ALTER TABLE consultations
  DROP CONSTRAINT IF EXISTS chk_consultations_version_nonnegative;
ALTER TABLE consultations
  ADD CONSTRAINT chk_consultations_version_nonnegative
  CHECK (version >= 0);

CREATE INDEX IF NOT EXISTS idx_consultations_status_created_at_id
  ON consultations (status, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_consultations_full_name_trgm
  ON consultations USING gin (full_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_consultations_phone_trgm
  ON consultations USING gin (phone gin_trgm_ops);

CREATE TABLE IF NOT EXISTS consultation_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id UUID NOT NULL
    REFERENCES consultations(id)
    ON DELETE RESTRICT,
  old_status TEXT NOT NULL,
  new_status TEXT NOT NULL,
  changed_by UUID NOT NULL
    REFERENCES auth.users(id)
    ON DELETE RESTRICT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  version INTEGER NOT NULL,

  CONSTRAINT chk_consultation_history_old_status
    CHECK (old_status IN ('new', 'contacted', 'qualified', 'closed')),
  CONSTRAINT chk_consultation_history_new_status
    CHECK (new_status IN ('new', 'contacted', 'qualified', 'closed')),
  CONSTRAINT chk_consultation_history_status_changed
    CHECK (old_status <> new_status),
  CONSTRAINT chk_consultation_history_version
    CHECK (version > 0),
  CONSTRAINT uq_consultation_history_version
    UNIQUE (consultation_id, version)
);

CREATE INDEX IF NOT EXISTS idx_consultation_status_history_consultation_changed_at
  ON consultation_status_history (consultation_id, changed_at DESC, id DESC);

ALTER TABLE consultation_status_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE consultation_status_history FROM anon, authenticated;
GRANT SELECT ON TABLE consultation_status_history TO authenticated;

CREATE POLICY "consultation_status_history_allow_select_approved_admin"
ON consultation_status_history
FOR SELECT
TO authenticated
USING (public.is_approved_admin());

-- Tighten the legacy consultation policies to the same approved-admin boundary
-- used by the server page/action. Direct authenticated clients cannot bypass it.
DROP POLICY IF EXISTS "consultations_allow_select_admin" ON consultations;
CREATE POLICY "consultations_allow_select_admin"
ON consultations
FOR SELECT
TO authenticated
USING (public.is_approved_admin());

DROP POLICY IF EXISTS "consultations_allow_update_status_admin" ON consultations;
CREATE POLICY "consultations_allow_update_status_admin"
ON consultations
FOR UPDATE
TO authenticated
USING (public.is_approved_admin())
WITH CHECK (public.is_approved_admin());

REVOKE UPDATE ON TABLE consultations FROM anon, authenticated;
GRANT UPDATE (status, version) ON TABLE consultations TO authenticated;

-- The trigger is the database state-machine authority. It also rejects any
-- attempt to use a status update as a path to mutate lead or audit fields.
CREATE OR REPLACE FUNCTION public.enforce_consultation_status_workflow()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.request_id IS DISTINCT FROM OLD.request_id
    OR NEW.full_name IS DISTINCT FROM OLD.full_name
    OR NEW.phone IS DISTINCT FROM OLD.phone
    OR NEW.faculty IS DISTINCT FROM OLD.faculty
    OR NEW.interest IS DISTINCT FROM OLD.interest
    OR NEW.need IS DISTINCT FROM OLD.need
    OR NEW.major IS DISTINCT FROM OLD.major
    OR NEW.note IS DISTINCT FROM OLD.note
    OR NEW.source_path IS DISTINCT FROM OLD.source_path
    OR NEW.selected_product_slug IS DISTINCT FROM OLD.selected_product_slug
    OR NEW.selected_subject_slug IS DISTINCT FROM OLD.selected_subject_slug
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Consultation workflow permits only status transitions';
  END IF;

  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    IF NEW.version IS DISTINCT FROM OLD.version THEN
      RAISE EXCEPTION 'Consultation version conflict';
    END IF;
    NEW.updated_at = OLD.updated_at;
    NEW.updated_by = OLD.updated_by;
    RETURN NEW;
  END IF;

  IF NOT public.is_approved_admin() THEN
    RAISE EXCEPTION 'Consultation status update is not permitted';
  END IF;

  IF NOT (
    (OLD.status = 'new' AND NEW.status = 'contacted')
    OR (OLD.status = 'contacted' AND NEW.status = 'qualified')
    OR (OLD.status = 'qualified' AND NEW.status = 'closed')
  ) THEN
    RAISE EXCEPTION 'Consultation status transition is not permitted';
  END IF;

  IF NEW.version IS DISTINCT FROM OLD.version + 1 THEN
    RAISE EXCEPTION 'Consultation version conflict';
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Consultation status update requires an authenticated actor';
  END IF;

  NEW.updated_at = timezone('utc'::text, now());
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_consultations_status_workflow ON consultations;
CREATE TRIGGER trg_consultations_status_workflow
  BEFORE UPDATE ON consultations
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_consultation_status_workflow();

-- SECURITY DEFINER is limited to the trigger's one explicit insert. The
-- caller's auth.uid() remains the actor and no execute privilege is public.
CREATE OR REPLACE FUNCTION public.append_consultation_status_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.consultation_status_history (
      consultation_id,
      old_status,
      new_status,
      changed_by,
      changed_at,
      version
    )
    VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      auth.uid(),
      NEW.updated_at,
      NEW.version
    );
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.append_consultation_status_history() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_consultations_status_history ON consultations;
CREATE TRIGGER trg_consultations_status_history
  AFTER UPDATE ON consultations
  FOR EACH ROW
  EXECUTE FUNCTION public.append_consultation_status_history();

CREATE OR REPLACE FUNCTION public.prevent_consultation_status_history_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  RAISE EXCEPTION 'Consultation status history is append-only';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.prevent_consultation_status_history_mutation() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_consultation_status_history_append_only ON consultation_status_history;
CREATE TRIGGER trg_consultation_status_history_append_only
  BEFORE UPDATE OR DELETE ON consultation_status_history
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_consultation_status_history_mutation();
