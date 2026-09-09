-- Phase 5: cancellation cannot strand a retry-cleanup reservation.

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
    AND cleanup_claim_id IS NULL
    AND cleanup_pending_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.material_assets
      WHERE material_assets.upload_reservation_id = p_reservation_id
    );

  RETURN FOUND;
END;
$function$;

REVOKE ALL ON FUNCTION public.cancel_material_asset_upload(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_material_asset_upload(uuid) TO authenticated;
