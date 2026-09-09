-- Phase 5: make expired and cancelled upload reservations safely reclaimable.

ALTER TABLE public.material_asset_upload_reservations
  ADD COLUMN cancelled_at timestamptz,
  ADD COLUMN cleanup_claim_id uuid,
  ADD COLUMN cleanup_claimed_at timestamptz,
  ADD COLUMN cleanup_attempts integer NOT NULL DEFAULT 0,
  ADD CONSTRAINT material_asset_upload_reservations_cleanup_attempts_check CHECK (cleanup_attempts >= 0);

CREATE INDEX material_asset_upload_reservations_cleanup_idx
ON public.material_asset_upload_reservations (expires_at, cancelled_at, cleanup_claimed_at, id);

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
  SET cancelled_at = COALESCE(cancelled_at, now()),
      expires_at = least(expires_at, now())
  WHERE id = p_reservation_id
    AND uploaded_by = v_user_id
    AND cleanup_claim_id IS NULL;

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
    WHERE (reservations.cancelled_at IS NOT NULL OR reservations.expires_at <= now())
      AND NOT EXISTS (
        SELECT 1
        FROM public.material_assets AS assets
        WHERE assets.upload_reservation_id = reservations.id
      )
      AND (
        reservations.cleanup_claimed_at IS NULL
        OR reservations.cleanup_claimed_at < now() - interval '15 minutes'
      )
    ORDER BY reservations.expires_at, reservations.id
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
  DELETE FROM public.material_asset_upload_reservations AS reservations
  WHERE reservations.id = p_reservation_id
    AND reservations.cleanup_claim_id = p_claim_id
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
    AND uploaded_by = v_user_id
    AND cleanup_claim_id IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.material_assets
      WHERE material_assets.upload_reservation_id = p_reservation_id
    );

  RETURN FOUND;
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
    SELECT * INTO v_row
    FROM public.material_assets
    WHERE upload_reservation_id = p_reservation_id
      AND uploaded_by = v_user_id;
    IF FOUND THEN RETURN v_row; END IF;
    RAISE EXCEPTION 'Material upload is not permitted' USING ERRCODE = '42501';
  END IF;

  IF v_reservation.cancelled_at IS NOT NULL
     OR v_reservation.expires_at <= now()
     OR v_reservation.cleanup_claim_id IS NOT NULL
  THEN
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

REVOKE ALL ON FUNCTION public.cancel_material_asset_upload(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_expired_material_asset_uploads(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_expired_material_asset_upload_cleanup(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_expired_material_asset_upload_cleanup(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_material_asset_upload(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_material_asset_upload(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_material_asset_upload(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_expired_material_asset_uploads(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_expired_material_asset_upload_cleanup(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_expired_material_asset_upload_cleanup(uuid, uuid) TO service_role;
