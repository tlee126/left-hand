-- Phase 4.2: Consultation Status Updater Audit Trail

ALTER TABLE consultations
  ADD COLUMN IF NOT EXISTS updated_by UUID
  REFERENCES auth.users(id)
  ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION set_consultations_updated_by()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_consultations_updated_by
  BEFORE UPDATE ON consultations
  FOR EACH ROW
  EXECUTE FUNCTION set_consultations_updated_by();
