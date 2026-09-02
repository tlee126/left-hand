-- Phase 4.2-E-A: Consultation Admin Status Update Policy

-- Remove any table-wide UPDATE privilege before granting the sole permitted
-- client mutation: changing a consultation's status.
REVOKE UPDATE ON TABLE consultations FROM anon, authenticated;
GRANT UPDATE (status) ON TABLE consultations TO authenticated;

-- Reuse the established timestamp trigger from migration 0004. The trigger
-- updates the database-managed updated_at value without granting that column
-- to clients.
CREATE TRIGGER trg_consultations_updated_at
  BEFORE UPDATE ON consultations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Only authenticated admins may update consultation rows, including the new
-- value, while column grants restrict the mutation to status alone.
CREATE POLICY "consultations_allow_update_status_admin"
ON consultations
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
  )
);
