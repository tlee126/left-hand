-- 0010_admin_account_approval_rls.sql
-- Admin account approval read/update access with database-managed audit fields.

-- The helper is SECURITY DEFINER only to avoid querying profiles recursively from
-- a profiles RLS policy. It has no dynamic SQL or credential/bypass capability.
DROP POLICY IF EXISTS "profiles_allow_select_admin" ON profiles;
DROP POLICY IF EXISTS "profiles_allow_update_approval_admin" ON profiles;
DROP TRIGGER IF EXISTS trg_profiles_approval_audit ON profiles;
DROP FUNCTION IF EXISTS public.set_profiles_approval_audit();
DROP FUNCTION IF EXISTS public.is_approved_admin();

CREATE OR REPLACE FUNCTION public.is_approved_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.account_status = 'approved'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_approved_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_approved_admin() TO authenticated;
GRANT SELECT ON TABLE profiles TO authenticated;

-- Preserve the existing own-profile policies and add the admin read/update paths.
CREATE POLICY "profiles_allow_select_admin"
ON profiles
FOR SELECT
TO authenticated
USING (public.is_approved_admin());

CREATE POLICY "profiles_allow_update_approval_admin"
ON profiles
FOR UPDATE
TO authenticated
USING (
  public.is_approved_admin()
  AND profiles.id <> auth.uid()
)
WITH CHECK (
  public.is_approved_admin()
  AND profiles.id <> auth.uid()
);

-- Keep table-wide UPDATE revoked. Existing own-profile column grants remain in
-- force; the approval workflow adds only its two workflow input columns.
REVOKE UPDATE ON TABLE profiles FROM authenticated;
GRANT UPDATE (account_status, rejection_reason) ON TABLE profiles TO authenticated;

-- RLS policies are permissive and the existing own-profile UPDATE policy must
-- remain available. This trigger therefore enforces the approval-only scope for
-- admin updates and rejects approval changes by non-admins or on the admin row.
CREATE OR REPLACE FUNCTION public.set_profiles_approval_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF public.is_approved_admin() AND OLD.id <> auth.uid() THEN
    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.full_name IS DISTINCT FROM OLD.full_name
      OR NEW.email IS DISTINCT FROM OLD.email
      OR NEW.phone IS DISTINCT FROM OLD.phone
      OR NEW.faculty IS DISTINCT FROM OLD.faculty
      OR NEW.major IS DISTINCT FROM OLD.major
      OR NEW.student_code IS DISTINCT FROM OLD.student_code
      OR NEW.avatar_url IS DISTINCT FROM OLD.avatar_url
      OR NEW.gpa_goal IS DISTINCT FROM OLD.gpa_goal
      OR NEW.role IS DISTINCT FROM OLD.role
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
      OR NEW.updated_at IS DISTINCT FROM OLD.updated_at
    THEN
      RAISE EXCEPTION 'Profile approval updates may change only approval fields';
    END IF;
  END IF;

  IF NEW.account_status IS DISTINCT FROM OLD.account_status
    OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason
    OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
    OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
  THEN
    IF OLD.id = auth.uid() OR NOT public.is_approved_admin() THEN
      RAISE EXCEPTION 'Profile approval update is not permitted';
    END IF;

    NEW.approved_by = auth.uid();
    NEW.approved_at = timezone('utc'::text, now());
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_approval_audit
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_profiles_approval_audit();
