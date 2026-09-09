-- Phase 5: reserve material versions before storage writes and finalize metadata atomically.

CREATE TABLE public.material_asset_upload_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.materials(product_id) ON DELETE CASCADE,
  version integer NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path text NOT NULL UNIQUE,
  original_name text NOT NULL,
  mime_type text NOT NULL,
  byte_size bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT material_asset_upload_reservations_product_version_unique UNIQUE (product_id, version),
  CONSTRAINT material_asset_upload_reservations_version_positive CHECK (version >= 1),
  CONSTRAINT material_asset_upload_reservations_byte_size_positive CHECK (byte_size > 0),
  CONSTRAINT material_asset_upload_reservations_path_binding CHECK (
    storage_path ~ ('^materials/' || lower(product_id::text) || '/v' || version::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[a-z0-9][a-z0-9._-]*$')
  )
);

ALTER TABLE public.material_asset_upload_reservations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.material_asset_upload_reservations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.material_asset_upload_reservations TO authenticated;
CREATE POLICY "material_asset_upload_reservations_uploader_select"
ON public.material_asset_upload_reservations
FOR SELECT
TO authenticated
USING (uploaded_by = auth.uid());
REVOKE INSERT ON TABLE public.material_assets FROM PUBLIC, anon, authenticated;

ALTER TABLE public.material_assets
  ADD CONSTRAINT material_assets_product_version_path_binding CHECK (
    storage_path ~ ('^materials/' || lower(product_id::text) || '/v' || version::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[a-z0-9][a-z0-9._-]*$')
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
  AND EXISTS (
    SELECT 1
    FROM public.material_asset_upload_reservations
    WHERE public.material_asset_upload_reservations.storage_path = name
      AND public.material_asset_upload_reservations.uploaded_by = auth.uid()
  )
);

DROP POLICY IF EXISTS "materials_approved_admin_update" ON storage.objects;
DROP POLICY IF EXISTS "materials_approved_admin_delete" ON storage.objects;

CREATE OR REPLACE FUNCTION public.reserve_material_asset_upload(
  p_product_id uuid,
  p_original_name text,
  p_safe_filename text,
  p_mime_type text,
  p_byte_size bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_reservation_id uuid := gen_random_uuid();
  v_version integer;
  v_storage_path text;
BEGIN
  IF v_user_id IS NULL
     OR NOT EXISTS (
       SELECT 1
       FROM public.profiles
       WHERE profiles.id = v_user_id
         AND profiles.role = 'admin'
         AND profiles.account_status = 'approved'
     )
  THEN
    RAISE EXCEPTION 'Material upload is not permitted' USING ERRCODE = '42501';
  END IF;

  IF p_product_id IS NULL
     OR p_original_name IS NULL
     OR length(p_original_name) = 0
     OR length(p_original_name) > 200
     OR p_original_name ~ E'[/\\\\]'
     OR p_original_name ~ E'[\\x00-\\x1F\\x7F]'
     OR p_original_name ~ '\.\.'
     OR p_safe_filename IS NULL
     OR p_safe_filename !~ '^[a-z0-9][a-z0-9._-]{0,199}$'
     OR p_safe_filename ~ '\.\.'
     OR p_safe_filename !~ '\.'
     OR p_mime_type NOT IN ('application/pdf', 'video/mp4', 'video/webm', 'video/quicktime')
     OR p_byte_size IS NULL
     OR p_byte_size <= 0
     OR (p_mime_type = 'application/pdf' AND p_byte_size > 20971520)
     OR (p_mime_type <> 'application/pdf' AND p_byte_size > 524288000)
  THEN
    RAISE EXCEPTION 'Material upload is not permitted' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.materials
    WHERE materials.product_id = p_product_id
  ) THEN
    RAISE EXCEPTION 'Material upload is not permitted' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_product_id::text, 0));

  SELECT greatest(
    coalesce((SELECT max(material_assets.version) FROM public.material_assets WHERE material_assets.product_id = p_product_id), 0),
    coalesce((SELECT max(material_asset_upload_reservations.version) FROM public.material_asset_upload_reservations WHERE material_asset_upload_reservations.product_id = p_product_id), 0)
  ) + 1
  INTO v_version;

  v_storage_path := 'materials/' || lower(p_product_id::text) || '/v' || v_version::text || '/' || v_reservation_id::text || '-' || p_safe_filename;

  INSERT INTO public.material_asset_upload_reservations (
    id, product_id, version, uploaded_by, storage_path, original_name, mime_type, byte_size
  )
  VALUES (
    v_reservation_id, p_product_id, v_version, v_user_id, v_storage_path, p_original_name, p_mime_type, p_byte_size
  );

  RETURN jsonb_build_object(
    'reservation_id', v_reservation_id,
    'version', v_version,
    'storage_path', v_storage_path
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.finalize_material_asset_upload(p_reservation_id uuid)
RETURNS public.material_assets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_reservation public.material_asset_upload_reservations;
  v_row public.material_assets;
BEGIN
  IF v_user_id IS NULL
     OR NOT EXISTS (
       SELECT 1
       FROM public.profiles
       WHERE profiles.id = v_user_id
         AND profiles.role = 'admin'
         AND profiles.account_status = 'approved'
     )
  THEN
    RAISE EXCEPTION 'Material upload is not permitted' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_reservation
  FROM public.material_asset_upload_reservations
  WHERE id = p_reservation_id
    AND uploaded_by = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Material upload is not permitted' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.material_assets (
    product_id, uploaded_by, storage_path, original_name, mime_type, byte_size, version, visibility
  )
  VALUES (
    v_reservation.product_id,
    v_reservation.uploaded_by,
    v_reservation.storage_path,
    v_reservation.original_name,
    v_reservation.mime_type,
    v_reservation.byte_size,
    v_reservation.version,
    'private'
  )
  RETURNING * INTO v_row;

  DELETE FROM public.material_asset_upload_reservations WHERE id = p_reservation_id;
  RETURN v_row;
END;
$function$;

CREATE OR REPLACE FUNCTION public.release_material_asset_upload(p_reservation_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL
     OR NOT EXISTS (
       SELECT 1
       FROM public.profiles
       WHERE profiles.id = v_user_id
         AND profiles.role = 'admin'
         AND profiles.account_status = 'approved'
     )
  THEN
    RAISE EXCEPTION 'Material upload is not permitted' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.material_asset_upload_reservations
  WHERE id = p_reservation_id
    AND uploaded_by = v_user_id;

  RETURN FOUND;
END;
$function$;

REVOKE ALL ON FUNCTION public.reserve_material_asset_upload(uuid, text, text, text, bigint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.finalize_material_asset_upload(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.release_material_asset_upload(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reserve_material_asset_upload(uuid, text, text, text, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_material_asset_upload(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_material_asset_upload(uuid) TO authenticated;
