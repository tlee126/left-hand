-- Per-learner, per-material direct access grants.
-- Product entitlements and materials.allow_download remain independent sources of truth.

CREATE TABLE public.material_direct_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES public.materials(product_id) ON DELETE CASCADE,
  can_view boolean NOT NULL DEFAULT true,
  can_download boolean NOT NULL DEFAULT false,
  expires_at timestamptz NULL,
  revoked_at timestamptz NULL,
  granted_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT material_direct_grants_user_material_unique UNIQUE (user_id, material_id),
  CONSTRAINT material_direct_grants_download_requires_view CHECK (can_download = false OR can_view = true)
);

CREATE INDEX idx_material_direct_grants_material_user
  ON public.material_direct_grants (material_id, user_id);

CREATE INDEX idx_material_direct_grants_user_material
  ON public.material_direct_grants (user_id, material_id);

ALTER TABLE public.material_direct_grants ENABLE ROW LEVEL SECURITY;

-- Learners cannot read or mutate this table directly. Server routes read through
-- the server-only client, and all writes use the approved-admin RPCs below.
REVOKE ALL ON TABLE public.material_direct_grants FROM anon, public, authenticated;

CREATE OR REPLACE FUNCTION public.admin_material_direct_grant_upsert(
  p_material_id uuid,
  p_user_id uuid,
  p_can_view boolean,
  p_can_download boolean,
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  grant_row public.material_direct_grants%ROWTYPE;
BEGIN
  IF NOT public.is_approved_admin() THEN
    RAISE EXCEPTION 'Material direct access mutation is not permitted' USING ERRCODE = '42501';
  END IF;

  IF p_material_id IS NULL
     OR p_user_id IS NULL
     OR p_can_view IS NULL
     OR p_can_download IS NULL
     OR (p_can_download AND NOT p_can_view)
  THEN
    RAISE EXCEPTION 'Invalid material direct access payload' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
       SELECT 1
       FROM public.materials
       WHERE materials.product_id = p_material_id
     )
     OR NOT EXISTS (
       SELECT 1
       FROM public.profiles
       WHERE profiles.id = p_user_id
         AND profiles.role = 'student'
         AND profiles.account_status = 'approved'
     )
  THEN
    RAISE EXCEPTION 'Material direct access mutation is not permitted' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.material_direct_grants (
    user_id,
    material_id,
    can_view,
    can_download,
    expires_at,
    revoked_at,
    granted_by
  )
  VALUES (
    p_user_id,
    p_material_id,
    p_can_view,
    p_can_download,
    p_expires_at,
    NULL,
    auth.uid()
  )
  ON CONFLICT (user_id, material_id)
  DO UPDATE SET
    can_view = EXCLUDED.can_view,
    can_download = EXCLUDED.can_download,
    expires_at = EXCLUDED.expires_at,
    revoked_at = NULL,
    granted_by = auth.uid(),
    updated_at = timezone('utc'::text, now())
  RETURNING * INTO grant_row;

  RETURN to_jsonb(grant_row);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_material_direct_grant_update(
  p_material_id uuid,
  p_user_id uuid,
  p_can_view boolean DEFAULT NULL,
  p_can_download boolean DEFAULT NULL,
  p_expires_at timestamptz DEFAULT NULL,
  p_set_expires_at boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  current_row public.material_direct_grants%ROWTYPE;
  next_can_view boolean;
  next_can_download boolean;
  next_expires_at timestamptz;
BEGIN
  IF NOT public.is_approved_admin() THEN
    RAISE EXCEPTION 'Material direct access mutation is not permitted' USING ERRCODE = '42501';
  END IF;

  IF p_material_id IS NULL
     OR p_user_id IS NULL
     OR p_set_expires_at IS NULL
     OR (p_can_view IS NULL AND p_can_download IS NULL AND NOT p_set_expires_at)
  THEN
    RAISE EXCEPTION 'Invalid material direct access payload' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO current_row
  FROM public.material_direct_grants
  WHERE material_id = p_material_id
    AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Material direct access mutation is not permitted' USING ERRCODE = '42501';
  END IF;

  next_can_view := COALESCE(p_can_view, current_row.can_view);
  next_can_download := COALESCE(p_can_download, current_row.can_download);
  next_expires_at := CASE WHEN p_set_expires_at THEN p_expires_at ELSE current_row.expires_at END;

  IF next_can_download AND NOT next_can_view THEN
    RAISE EXCEPTION 'Invalid material direct access payload' USING ERRCODE = '22023';
  END IF;

  UPDATE public.material_direct_grants
  SET can_view = next_can_view,
      can_download = next_can_download,
      expires_at = next_expires_at,
      updated_at = timezone('utc'::text, now())
  WHERE id = current_row.id
  RETURNING * INTO current_row;

  RETURN to_jsonb(current_row);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_material_direct_grant_revoke(
  p_material_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  grant_row public.material_direct_grants%ROWTYPE;
BEGIN
  IF NOT public.is_approved_admin()
     OR p_material_id IS NULL
     OR p_user_id IS NULL
  THEN
    RAISE EXCEPTION 'Material direct access mutation is not permitted' USING ERRCODE = '42501';
  END IF;

  UPDATE public.material_direct_grants
  SET revoked_at = COALESCE(revoked_at, timezone('utc'::text, now())),
      updated_at = timezone('utc'::text, now())
  WHERE material_id = p_material_id
    AND user_id = p_user_id
  RETURNING * INTO grant_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Material direct access mutation is not permitted' USING ERRCODE = '42501';
  END IF;

  RETURN to_jsonb(grant_row);
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_material_direct_grant_upsert(uuid, uuid, boolean, boolean, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_material_direct_grant_update(uuid, uuid, boolean, boolean, timestamptz, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_material_direct_grant_revoke(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_material_direct_grant_upsert(uuid, uuid, boolean, boolean, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_material_direct_grant_update(uuid, uuid, boolean, boolean, timestamptz, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_material_direct_grant_revoke(uuid, uuid) TO authenticated;
