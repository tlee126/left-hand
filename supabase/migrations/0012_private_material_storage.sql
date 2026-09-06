-- Private material object storage foundation.

INSERT INTO storage.buckets (id, name, public)
VALUES ('materials', 'materials', false)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    public = false;

DROP POLICY IF EXISTS "materials_approved_admin_select" ON storage.objects;
CREATE POLICY "materials_approved_admin_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'materials'
  AND EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE public.profiles.id = auth.uid()
      AND public.profiles.role = 'admin'
      AND public.profiles.account_status = 'approved'
  )
);

DROP POLICY IF EXISTS "materials_approved_admin_insert" ON storage.objects;
CREATE POLICY "materials_approved_admin_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'materials'
  AND EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE public.profiles.id = auth.uid()
      AND public.profiles.role = 'admin'
      AND public.profiles.account_status = 'approved'
  )
);

DROP POLICY IF EXISTS "materials_approved_admin_update" ON storage.objects;
CREATE POLICY "materials_approved_admin_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'materials'
  AND EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE public.profiles.id = auth.uid()
      AND public.profiles.role = 'admin'
      AND public.profiles.account_status = 'approved'
  )
)
WITH CHECK (
  bucket_id = 'materials'
  AND EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE public.profiles.id = auth.uid()
      AND public.profiles.role = 'admin'
      AND public.profiles.account_status = 'approved'
  )
);

DROP POLICY IF EXISTS "materials_approved_admin_delete" ON storage.objects;
CREATE POLICY "materials_approved_admin_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'materials'
  AND EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE public.profiles.id = auth.uid()
      AND public.profiles.role = 'admin'
      AND public.profiles.account_status = 'approved'
  )
);
