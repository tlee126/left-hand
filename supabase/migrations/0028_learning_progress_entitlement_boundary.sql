-- Phase 5: database-enforced entitlement and item binding for learning progress.

REVOKE INSERT, UPDATE ON TABLE public.learning_progress FROM anon, public, authenticated;

CREATE OR REPLACE FUNCTION public.save_learning_progress(
  p_product_id uuid,
  p_item_type text,
  p_item_id uuid,
  p_status text,
  p_watched_percent numeric,
  p_started_at timestamptz,
  p_completed_at timestamptz
)
RETURNS public.learning_progress
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_row public.learning_progress;
BEGIN
  IF v_user_id IS NULL
     OR NOT EXISTS (
       SELECT 1
       FROM public.profiles
       WHERE profiles.id = v_user_id
         AND profiles.account_status = 'approved'
         AND profiles.role <> 'admin'
     )
  THEN
    RAISE EXCEPTION 'Progress write is not permitted' USING ERRCODE = '42501';
  END IF;

  IF p_product_id IS NULL
     OR p_item_id IS NULL
     OR p_item_type NOT IN ('material', 'lesson')
     OR p_status NOT IN ('not_started', 'in_progress', 'completed')
     OR p_watched_percent IS NULL
     OR p_watched_percent < 0
     OR p_watched_percent > 100
     OR (p_status = 'completed' AND p_completed_at IS NULL)
     OR (p_status <> 'completed' AND p_completed_at IS NOT NULL)
  THEN
    RAISE EXCEPTION 'Progress write is not permitted' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.products
    WHERE products.id = p_product_id
  )
  OR NOT EXISTS (
    SELECT 1
    FROM public.product_entitlements
    WHERE product_entitlements.user_id = v_user_id
      AND product_entitlements.product_id = p_product_id
      AND product_entitlements.status = 'active'
      AND product_entitlements.revoked_at IS NULL
      AND (product_entitlements.expires_at IS NULL OR product_entitlements.expires_at > now())
  )
  THEN
    RAISE EXCEPTION 'Progress write is not permitted' USING ERRCODE = '42501';
  END IF;

  IF p_item_type = 'material' THEN
    IF p_item_id <> p_product_id
       OR NOT EXISTS (
         SELECT 1
         FROM public.materials
         WHERE materials.product_id = p_product_id
       )
    THEN
      RAISE EXCEPTION 'Progress write is not permitted' USING ERRCODE = '42501';
    END IF;
  ELSIF NOT EXISTS (
    SELECT 1
    FROM public.course_lessons
    WHERE course_lessons.id = p_item_id
      AND course_lessons.course_id = p_product_id
  ) THEN
    RAISE EXCEPTION 'Progress write is not permitted' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.learning_progress (
    user_id,
    product_id,
    item_type,
    item_id,
    status,
    watched_percent,
    started_at,
    completed_at
  )
  VALUES (
    v_user_id,
    p_product_id,
    p_item_type,
    p_item_id,
    p_status,
    p_watched_percent,
    p_started_at,
    p_completed_at
  )
  ON CONFLICT (user_id, product_id, item_type, item_id)
  DO UPDATE SET
    status = EXCLUDED.status,
    watched_percent = EXCLUDED.watched_percent,
    started_at = EXCLUDED.started_at,
    completed_at = EXCLUDED.completed_at
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$function$;

REVOKE ALL ON FUNCTION public.save_learning_progress(uuid, text, uuid, text, numeric, timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_learning_progress(uuid, text, uuid, text, numeric, timestamptz, timestamptz) TO authenticated;
