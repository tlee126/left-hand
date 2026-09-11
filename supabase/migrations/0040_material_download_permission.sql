-- Per-material learner download policy. Product entitlements remain view access only.

ALTER TABLE public.materials
  ADD COLUMN IF NOT EXISTS allow_download boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.admin_material_download_permission_update(
  p_material_id uuid,
  p_allow_download boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF auth.uid() IS NULL
     OR p_material_id IS NULL
     OR p_allow_download IS NULL
     OR NOT EXISTS (
       SELECT 1
       FROM public.profiles
       WHERE profiles.id = auth.uid()
         AND profiles.role = 'admin'
         AND profiles.account_status = 'approved'
     )
  THEN
    RAISE EXCEPTION 'Material download policy update is not permitted' USING ERRCODE = '42501';
  END IF;

  UPDATE public.materials
  SET allow_download = p_allow_download
  WHERE product_id = p_material_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Material download policy update is not permitted' USING ERRCODE = '42501';
  END IF;

  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_material_download_permission_update(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_material_download_permission_update(uuid, boolean) TO authenticated;
