-- Add nullable material resume positions without changing the legacy progress RPC.

ALTER TABLE public.learning_progress
  ADD COLUMN IF NOT EXISTS resume_page integer NULL,
  ADD COLUMN IF NOT EXISTS resume_seconds numeric NULL;

ALTER TABLE public.learning_progress
  ADD CONSTRAINT learning_progress_resume_page_check CHECK (resume_page IS NULL OR resume_page >= 1),
  ADD CONSTRAINT learning_progress_resume_seconds_check CHECK (resume_seconds IS NULL OR resume_seconds >= 0),
  ADD CONSTRAINT learning_progress_resume_position_exclusive_check CHECK (resume_page IS NULL OR resume_seconds IS NULL),
  ADD CONSTRAINT learning_progress_resume_position_material_check CHECK (item_type = 'material' OR (resume_page IS NULL AND resume_seconds IS NULL));

CREATE FUNCTION public.save_learning_progress(
  p_product_id uuid,
  p_item_type text,
  p_item_id uuid,
  p_status text,
  p_watched_percent numeric,
  p_started_at timestamptz,
  p_completed_at timestamptz,
  p_expected_version integer,
  p_resume_page integer,
  p_resume_seconds numeric
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
       SELECT 1 FROM public.profiles
       WHERE profiles.id = v_user_id
         AND profiles.account_status = 'approved'
         AND profiles.role = 'student'
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
     OR (p_status = 'completed' AND p_watched_percent <> 100)
     OR p_expected_version IS NULL
     OR p_expected_version < 0
     OR (p_status = 'completed' AND p_completed_at IS NULL)
     OR (p_status <> 'completed' AND p_completed_at IS NOT NULL)
     OR (p_resume_page IS NOT NULL AND p_resume_page < 1)
     OR (p_resume_seconds IS NOT NULL AND p_resume_seconds < 0)
     OR (p_resume_page IS NOT NULL AND p_resume_seconds IS NOT NULL)
     OR (p_item_type = 'lesson' AND (p_resume_page IS NOT NULL OR p_resume_seconds IS NOT NULL))
  THEN
    RAISE EXCEPTION 'Progress write is not permitted' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.products WHERE products.id = p_product_id) THEN
    RAISE EXCEPTION 'Progress write is not permitted' USING ERRCODE = '42501';
  END IF;

  IF p_item_type = 'material' THEN
    IF p_item_id <> p_product_id
       OR NOT EXISTS (SELECT 1 FROM public.materials WHERE materials.product_id = p_product_id)
    THEN
      RAISE EXCEPTION 'Progress write is not permitted' USING ERRCODE = '42501';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.material_direct_grants
      WHERE material_direct_grants.user_id = v_user_id
        AND material_direct_grants.material_id = p_product_id
    ) THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.material_direct_grants
        WHERE material_direct_grants.user_id = v_user_id
          AND material_direct_grants.material_id = p_product_id
          AND material_direct_grants.can_view = true
          AND material_direct_grants.revoked_at IS NULL
          AND (material_direct_grants.expires_at IS NULL OR material_direct_grants.expires_at > now())
      ) THEN
        RAISE EXCEPTION 'Progress write is not permitted' USING ERRCODE = '42501';
      END IF;
    ELSIF NOT EXISTS (
      SELECT 1 FROM public.product_entitlements
      WHERE product_entitlements.user_id = v_user_id
        AND product_entitlements.product_id = p_product_id
        AND product_entitlements.status = 'active'
        AND product_entitlements.revoked_at IS NULL
        AND (product_entitlements.expires_at IS NULL OR product_entitlements.expires_at > now())
    ) THEN
      RAISE EXCEPTION 'Progress write is not permitted' USING ERRCODE = '42501';
    END IF;
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM public.course_lessons
      WHERE course_lessons.id = p_item_id AND course_lessons.course_id = p_product_id
    ) THEN
      RAISE EXCEPTION 'Progress write is not permitted' USING ERRCODE = '42501';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.product_entitlements
      WHERE product_entitlements.user_id = v_user_id
        AND product_entitlements.product_id = p_product_id
        AND product_entitlements.status = 'active'
        AND product_entitlements.revoked_at IS NULL
        AND (product_entitlements.expires_at IS NULL OR product_entitlements.expires_at > now())
    ) THEN
      RAISE EXCEPTION 'Progress write is not permitted' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF p_expected_version > 0 AND NOT EXISTS (
    SELECT 1 FROM public.learning_progress
    WHERE learning_progress.user_id = v_user_id AND learning_progress.product_id = p_product_id
      AND learning_progress.item_type = p_item_type AND learning_progress.item_id = p_item_id
  ) THEN
    RAISE EXCEPTION 'Progress conflict' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.learning_progress (
    user_id, product_id, item_type, item_id, status, watched_percent, started_at, completed_at, version, resume_page, resume_seconds
  ) VALUES (
    v_user_id, p_product_id, p_item_type, p_item_id, p_status, p_watched_percent, p_started_at, p_completed_at, 1, p_resume_page, p_resume_seconds
  )
  ON CONFLICT (user_id, product_id, item_type, item_id)
  DO UPDATE SET
    status = EXCLUDED.status,
    watched_percent = EXCLUDED.watched_percent,
    started_at = COALESCE(public.learning_progress.started_at, EXCLUDED.started_at),
    completed_at = COALESCE(EXCLUDED.completed_at, public.learning_progress.completed_at),
    resume_page = CASE WHEN p_resume_page IS NULL AND p_resume_seconds IS NULL THEN public.learning_progress.resume_page ELSE p_resume_page END,
    resume_seconds = CASE WHEN p_resume_page IS NULL AND p_resume_seconds IS NULL THEN public.learning_progress.resume_seconds ELSE p_resume_seconds END,
    version = public.learning_progress.version + 1
  WHERE public.learning_progress.version = p_expected_version
    AND p_watched_percent >= public.learning_progress.watched_percent
    AND (CASE public.learning_progress.status WHEN 'completed' THEN 2 WHEN 'in_progress' THEN 1 ELSE 0 END
      <= CASE p_status WHEN 'completed' THEN 2 WHEN 'in_progress' THEN 1 ELSE 0 END)
  RETURNING * INTO v_row;

  IF NOT FOUND THEN RAISE EXCEPTION 'Progress conflict' USING ERRCODE = 'P0002'; END IF;
  RETURN v_row;
END;
$function$;

REVOKE ALL ON FUNCTION public.save_learning_progress(uuid, text, uuid, text, numeric, timestamptz, timestamptz, integer, integer, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_learning_progress(uuid, text, uuid, text, numeric, timestamptz, timestamptz, integer, integer, numeric) TO authenticated;
