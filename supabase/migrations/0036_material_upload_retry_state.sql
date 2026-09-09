-- Phase 5: preserve upload reservations across pre-commit failures.

ALTER TABLE public.material_asset_upload_reservations
  ADD COLUMN retryable_at timestamptz,
  ADD COLUMN cleanup_pending_at timestamptz,
  ADD CONSTRAINT material_asset_upload_reservations_retry_state_check CHECK (
    NOT (retryable_at IS NOT NULL AND cleanup_pending_at IS NOT NULL)
  );

CREATE INDEX material_asset_upload_reservations_retry_state_idx
ON public.material_asset_upload_reservations (cleanup_pending_at, expires_at, cancelled_at, cleanup_claimed_at, id);

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
      AND public.material_asset_upload_reservations.cancelled_at IS NULL
      AND public.material_asset_upload_reservations.cleanup_pending_at IS NULL
      AND public.material_asset_upload_reservations.expires_at > now()
  )
);

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
     OR p_original_name ~ '\\.\\.'
     OR p_safe_filename IS NULL
     OR p_safe_filename !~ '^[a-z0-9][a-z0-9._-]{0,199}$'
     OR p_safe_filename ~ '\\.\\.'
     OR p_safe_filename !~ '\\.'
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

CREATE OR REPLACE FUNCTION public.mark_material_asset_upload_retryable(p_reservation_id uuid)
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

  UPDATE public.material_asset_upload_reservations
  SET retryable_at = coalesce(retryable_at, now()),
      cleanup_pending_at = NULL,
      expires_at = greatest(expires_at, now() + interval '2 hours')
  WHERE id = p_reservation_id
    AND uploaded_by = v_user_id
    AND cancelled_at IS NULL
    AND cleanup_claim_id IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.material_assets
      WHERE material_assets.upload_reservation_id = p_reservation_id
    );

  RETURN FOUND;
END;
$function$;

CREATE OR REPLACE FUNCTION public.begin_material_asset_upload_retry_cleanup(p_reservation_id uuid)
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

  UPDATE public.material_asset_upload_reservations
  SET cleanup_pending_at = coalesce(cleanup_pending_at, now()),
      retryable_at = NULL
  WHERE id = p_reservation_id
    AND uploaded_by = v_user_id
    AND cancelled_at IS NULL
    AND cleanup_claim_id IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.material_assets
      WHERE material_assets.upload_reservation_id = p_reservation_id
    );

  RETURN FOUND;
END;
$function$;

CREATE OR REPLACE FUNCTION public.complete_material_asset_upload_retry_cleanup(p_reservation_id uuid)
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

  UPDATE public.material_asset_upload_reservations
  SET cleanup_pending_at = NULL,
      retryable_at = now(),
      expires_at = greatest(expires_at, now() + interval '2 hours')
  WHERE id = p_reservation_id
    AND uploaded_by = v_user_id
    AND cleanup_pending_at IS NOT NULL
    AND cleanup_claim_id IS NULL
    AND cancelled_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.material_assets
      WHERE material_assets.upload_reservation_id = p_reservation_id
    );

  RETURN FOUND;
END;
$function$;

CREATE OR REPLACE FUNCTION public.claim_expired_material_asset_uploads(p_limit integer)
RETURNS TABLE (reservation_id uuid, storage_path text, claim_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100 THEN
    RAISE EXCEPTION 'Invalid cleanup limit' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT reservations.id
    FROM public.material_asset_upload_reservations AS reservations
    WHERE (
        reservations.cleanup_pending_at IS NOT NULL
        OR reservations.cancelled_at IS NOT NULL
        OR reservations.expires_at <= now()
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.material_assets AS assets
        WHERE assets.upload_reservation_id = reservations.id
      )
      AND (
        reservations.cleanup_claimed_at IS NULL
        OR reservations.cleanup_claimed_at < now() - interval '15 minutes'
      )
    ORDER BY reservations.cleanup_pending_at NULLS LAST, reservations.expires_at, reservations.id
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  ), claimed AS (
    UPDATE public.material_asset_upload_reservations AS reservations
    SET cleanup_claim_id = gen_random_uuid(),
        cleanup_claimed_at = now(),
        cleanup_attempts = reservations.cleanup_attempts + 1
    FROM candidates
    WHERE reservations.id = candidates.id
    RETURNING reservations.id, reservations.storage_path, reservations.cleanup_claim_id
  )
  SELECT claimed.id, claimed.storage_path, claimed.cleanup_claim_id FROM claimed;
END;
$function$;

CREATE OR REPLACE FUNCTION public.complete_expired_material_asset_upload_cleanup(p_reservation_id uuid, p_claim_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  UPDATE public.material_asset_upload_reservations AS reservations
  SET cleanup_pending_at = NULL,
      retryable_at = now(),
      cleanup_claim_id = NULL,
      cleanup_claimed_at = NULL,
      expires_at = greatest(reservations.expires_at, now() + interval '2 hours')
  WHERE reservations.id = p_reservation_id
    AND reservations.cleanup_claim_id = p_claim_id
    AND reservations.cleanup_pending_at IS NOT NULL
    AND reservations.cancelled_at IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.material_assets AS assets
      WHERE assets.upload_reservation_id = reservations.id
    );
  IF FOUND THEN RETURN true; END IF;

  DELETE FROM public.material_asset_upload_reservations AS reservations
  WHERE reservations.id = p_reservation_id
    AND reservations.cleanup_claim_id = p_claim_id
    AND reservations.cleanup_pending_at IS NULL
    AND (reservations.cancelled_at IS NOT NULL OR reservations.expires_at <= now())
    AND NOT EXISTS (
      SELECT 1
      FROM public.material_assets AS assets
      WHERE assets.upload_reservation_id = reservations.id
    );
  RETURN FOUND;
END;
$function$;

CREATE OR REPLACE FUNCTION public.release_expired_material_asset_upload_cleanup(p_reservation_id uuid, p_claim_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  UPDATE public.material_asset_upload_reservations
  SET cleanup_claim_id = NULL,
      cleanup_claimed_at = NULL
  WHERE id = p_reservation_id
    AND cleanup_claim_id = p_claim_id;
  RETURN FOUND;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cancel_material_asset_upload(p_reservation_id uuid)
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

  UPDATE public.material_asset_upload_reservations
  SET cancelled_at = coalesce(cancelled_at, now()),
      retryable_at = NULL,
      expires_at = least(expires_at, now())
  WHERE id = p_reservation_id
    AND uploaded_by = v_user_id
    AND cleanup_claim_id IS NULL;

  RETURN FOUND;
END;
$function$;

CREATE OR REPLACE FUNCTION public.finalize_material_asset_upload(p_reservation_id uuid, p_idempotency_key uuid)
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
     OR p_idempotency_key IS NULL
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
    AND upload_idempotency_key = p_idempotency_key
  FOR UPDATE;

  IF NOT FOUND THEN
    SELECT * INTO v_row
    FROM public.material_assets
    WHERE upload_reservation_id = p_reservation_id
      AND uploaded_by = v_user_id
      AND upload_idempotency_key = p_idempotency_key;
    IF FOUND THEN RETURN v_row; END IF;
    RAISE EXCEPTION 'Material upload is not permitted' USING ERRCODE = '42501';
  END IF;

  IF v_reservation.cancelled_at IS NOT NULL
     OR v_reservation.expires_at <= now()
     OR v_reservation.cleanup_claim_id IS NOT NULL
     OR v_reservation.cleanup_pending_at IS NOT NULL
  THEN
    RAISE EXCEPTION 'Material upload is not permitted' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.material_assets (
    product_id, uploaded_by, upload_reservation_id, upload_idempotency_key, storage_path, original_name, mime_type, byte_size, version, visibility
  )
  VALUES (
    v_reservation.product_id,
    v_reservation.uploaded_by,
    v_reservation.id,
    v_reservation.upload_idempotency_key,
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

REVOKE ALL ON FUNCTION public.mark_material_asset_upload_retryable(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.begin_material_asset_upload_retry_cleanup(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.complete_material_asset_upload_retry_cleanup(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_material_asset_upload_retryable(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.begin_material_asset_upload_retry_cleanup(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_material_asset_upload_retry_cleanup(uuid) TO authenticated;
