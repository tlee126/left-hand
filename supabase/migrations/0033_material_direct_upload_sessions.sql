-- Phase 5: expire direct-upload reservations and make finalization retry-safe.

ALTER TABLE public.material_asset_upload_reservations
  ADD COLUMN expires_at timestamptz NOT NULL DEFAULT (now() + interval '2 hours');

ALTER TABLE public.material_assets
  ADD COLUMN upload_reservation_id uuid;

CREATE UNIQUE INDEX material_assets_upload_reservation_id_unique
ON public.material_assets (upload_reservation_id)
WHERE upload_reservation_id IS NOT NULL;

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
    SELECT * INTO v_row
    FROM public.material_assets
    WHERE upload_reservation_id = p_reservation_id
      AND uploaded_by = v_user_id;
    IF FOUND THEN RETURN v_row; END IF;
    RAISE EXCEPTION 'Material upload is not permitted' USING ERRCODE = '42501';
  END IF;

  IF v_reservation.expires_at <= now() THEN
    RAISE EXCEPTION 'Material upload is not permitted' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.material_assets (
    product_id, uploaded_by, upload_reservation_id, storage_path, original_name, mime_type, byte_size, version, visibility
  )
  VALUES (
    v_reservation.product_id,
    v_reservation.uploaded_by,
    v_reservation.id,
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

REVOKE ALL ON FUNCTION public.finalize_material_asset_upload(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalize_material_asset_upload(uuid) TO authenticated;
