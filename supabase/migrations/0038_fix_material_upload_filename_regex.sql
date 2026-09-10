CREATE OR REPLACE FUNCTION public.reserve_material_asset_upload(
  p_product_id uuid,
  p_original_name text,
  p_safe_filename text,
  p_mime_type text,
  p_byte_size bigint,
  p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_reservation public.material_asset_upload_reservations;
  v_asset public.material_assets;
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
     OR p_original_name ~ E'\\.\\.'
     OR p_safe_filename IS NULL
     OR p_safe_filename !~ '^[a-z0-9][a-z0-9._-]{0,199}$'
     OR p_safe_filename ~ E'\\.\\.'
     OR p_safe_filename !~ E'\\.'
     OR p_mime_type NOT IN ('application/pdf', 'video/mp4', 'video/webm', 'video/quicktime')
     OR p_byte_size IS NULL
     OR p_byte_size <= 0
     OR (p_mime_type = 'application/pdf' AND p_byte_size > 20971520)
     OR (p_mime_type <> 'application/pdf' AND p_byte_size > 524288000)
  THEN
    RAISE EXCEPTION 'Material upload is not permitted' USING ERRCODE = '22023';
  END IF;

  IF p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'Material upload is not permitted' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':' || p_idempotency_key::text, 0));

  SELECT * INTO v_reservation
  FROM public.material_asset_upload_reservations
  WHERE uploaded_by = v_user_id
    AND upload_idempotency_key = p_idempotency_key
  FOR UPDATE;

  IF FOUND THEN
    IF v_reservation.product_id <> p_product_id
       OR v_reservation.original_name IS DISTINCT FROM p_original_name
       OR v_reservation.storage_path NOT LIKE 'materials/' || lower(p_product_id::text) || '/%'
       OR right(v_reservation.storage_path, length(p_safe_filename) + 1) IS DISTINCT FROM '-' || p_safe_filename
       OR v_reservation.mime_type IS DISTINCT FROM p_mime_type
       OR v_reservation.byte_size IS DISTINCT FROM p_byte_size
    THEN
      RETURN jsonb_build_object('status', 'conflict');
    END IF;
    IF v_reservation.cancelled_at IS NOT NULL OR v_reservation.cleanup_claim_id IS NOT NULL THEN
      RETURN jsonb_build_object('status', 'conflict');
    END IF;
    IF v_reservation.cleanup_pending_at IS NOT NULL THEN
      RETURN jsonb_build_object(
        'status', 'reserved',
        'is_new', false,
        'retryable', false,
        'cleanup_pending', true,
        'reservation_id', v_reservation.id,
        'version', v_reservation.version,
        'storage_path', v_reservation.storage_path
      );
    END IF;
    IF v_reservation.expires_at <= now() AND v_reservation.retryable_at IS NULL THEN
      RETURN jsonb_build_object('status', 'conflict');
    END IF;
    IF v_reservation.retryable_at IS NOT NULL AND v_reservation.expires_at <= now() THEN
      UPDATE public.material_asset_upload_reservations
      SET expires_at = now() + interval '2 hours'
      WHERE id = v_reservation.id;
      v_reservation.expires_at := now() + interval '2 hours';
    END IF;
    RETURN jsonb_build_object(
      'status', 'reserved',
      'is_new', false,
      'retryable', v_reservation.retryable_at IS NOT NULL,
      'cleanup_pending', false,
      'reservation_id', v_reservation.id,
      'version', v_reservation.version,
      'storage_path', v_reservation.storage_path
    );
  END IF;

  SELECT * INTO v_asset
  FROM public.material_assets
  WHERE uploaded_by = v_user_id
    AND upload_idempotency_key = p_idempotency_key
  FOR UPDATE;

  IF FOUND THEN
    IF v_asset.product_id <> p_product_id
       OR v_asset.original_name IS DISTINCT FROM p_original_name
       OR right(v_asset.storage_path, length(p_safe_filename) + 1) IS DISTINCT FROM '-' || p_safe_filename
       OR v_asset.mime_type IS DISTINCT FROM p_mime_type
       OR v_asset.byte_size IS DISTINCT FROM p_byte_size
       OR v_asset.upload_reservation_id IS NULL
    THEN
      RETURN jsonb_build_object('status', 'conflict');
    END IF;
    RETURN jsonb_build_object(
      'status', 'committed',
      'is_new', false,
      'retryable', false,
      'cleanup_pending', false,
      'reservation_id', v_asset.upload_reservation_id,
      'version', v_asset.version,
      'storage_path', v_asset.storage_path
    );
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
    id, product_id, version, uploaded_by, upload_idempotency_key, storage_path, original_name, mime_type, byte_size
  )
  VALUES (
    v_reservation_id, p_product_id, v_version, v_user_id, p_idempotency_key, v_storage_path, p_original_name, p_mime_type, p_byte_size
  );

  RETURN jsonb_build_object(
    'status', 'reserved',
    'is_new', true,
    'retryable', false,
    'cleanup_pending', false,
    'reservation_id', v_reservation_id,
    'version', v_version,
    'storage_path', v_storage_path
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.reserve_material_asset_upload(uuid, text, text, text, bigint, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reserve_material_asset_upload(uuid, text, text, text, bigint, uuid) TO authenticated;
