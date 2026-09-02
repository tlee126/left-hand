-- Phase 4.2-A: Consultation Admin RLS
-- Migration: 0007_consultation_admin_rls.sql

-- Grant SELECT to authenticated users so RLS policies can evaluate.
-- (anon stays revoked from SELECT per migration 0006)
GRANT SELECT ON TABLE consultations TO authenticated;

-- Allow SELECT if the authenticated user has the 'admin' role in their profile.
CREATE POLICY "consultations_allow_select_admin"
ON consultations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
  )
);
