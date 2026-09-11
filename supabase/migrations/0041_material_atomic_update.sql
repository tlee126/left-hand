-- Update material catalog metadata and its per-material download policy atomically.

CREATE OR REPLACE FUNCTION public.admin_material_mutate_atomic(
  p_operation text,
  p_product jsonb DEFAULT '{}'::jsonb,
  p_material jsonb DEFAULT '{}'::jsonb,
  p_product_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  mutation_result jsonb;
  target_product_id uuid;
  product_row public.products%ROWTYPE;
  material_row public.materials%ROWTYPE;
  allow_download_value boolean;
BEGIN
  IF auth.uid() IS NULL
     OR NOT EXISTS (
       SELECT 1
       FROM public.profiles
       WHERE profiles.id = auth.uid()
         AND profiles.role = 'admin'
         AND profiles.account_status = 'approved'
     )
  THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  IF p_operation IS NULL
     OR p_operation NOT IN ('create', 'update')
     OR jsonb_typeof(p_product) IS DISTINCT FROM 'object'
     OR jsonb_typeof(p_material) IS DISTINCT FROM 'object'
  THEN
    RAISE EXCEPTION 'invalid material mutation payload' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_object_keys(p_product) AS key
    WHERE key NOT IN ('slug', 'title', 'description', 'subject_id', 'category', 'delivery_kind', 'publication_status', 'price_vnd', 'old_price_vnd', 'is_contact_for_price', 'rating', 'is_hot', 'color_theme')
  ) THEN
    RAISE EXCEPTION 'invalid product payload' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_object_keys(p_material) AS key
    WHERE key NOT IN ('pages', 'tags', 'includes', 'suitable_for', 'allow_download')
  ) THEN
    RAISE EXCEPTION 'invalid material payload' USING ERRCODE = '22023';
  END IF;

  IF p_material ? 'allow_download'
     AND jsonb_typeof(p_material->'allow_download') IS DISTINCT FROM 'boolean'
  THEN
    RAISE EXCEPTION 'invalid material payload' USING ERRCODE = '22023';
  END IF;

  IF p_operation = 'create' THEN
    IF p_product_id IS NOT NULL OR NOT (p_material ? 'pages') THEN
      RAISE EXCEPTION 'invalid material create payload' USING ERRCODE = '22023';
    END IF;

    mutation_result := public.admin_catalog_mutate_v2(
      'create',
      'material',
      p_product,
      p_material - 'allow_download',
      NULL
    );
    IF mutation_result IS NULL OR jsonb_typeof(mutation_result->'product') IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'material mutation failed' USING ERRCODE = '23503';
    END IF;
    target_product_id := (mutation_result->'product'->>'id')::uuid;
    allow_download_value := COALESCE((p_material->>'allow_download')::boolean, false);
  ELSE
    IF p_product_id IS NULL OR (p_product = '{}'::jsonb AND (p_material - 'allow_download') = '{}'::jsonb AND NOT (p_material ? 'allow_download')) THEN
      RAISE EXCEPTION 'invalid material update payload' USING ERRCODE = '22023';
    END IF;

    IF p_product <> '{}'::jsonb OR (p_material - 'allow_download') <> '{}'::jsonb THEN
      mutation_result := public.admin_catalog_mutate_v2(
        'update',
        'material',
        p_product,
        p_material - 'allow_download',
        p_product_id
      );
      IF mutation_result IS NULL THEN
        RETURN NULL;
      END IF;
    ELSE
      SELECT * INTO product_row
      FROM public.products
      WHERE id = p_product_id AND kind = 'material';
      IF NOT FOUND THEN RETURN NULL; END IF;
      SELECT * INTO material_row
      FROM public.materials
      WHERE product_id = p_product_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'catalog child is missing' USING ERRCODE = '23503';
      END IF;
    END IF;
    target_product_id := p_product_id;
  END IF;

  IF p_material ? 'allow_download' THEN
    allow_download_value := (p_material->>'allow_download')::boolean;
    UPDATE public.materials
    SET allow_download = allow_download_value
    WHERE product_id = target_product_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'catalog child is missing' USING ERRCODE = '23503';
    END IF;
  END IF;

  SELECT * INTO product_row
  FROM public.products
  WHERE id = target_product_id AND kind = 'material';
  SELECT * INTO material_row
  FROM public.materials
  WHERE product_id = target_product_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'catalog child is missing' USING ERRCODE = '23503';
  END IF;
  RETURN jsonb_build_object('product', to_jsonb(product_row), 'child', to_jsonb(material_row));
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_material_mutate_atomic(text, jsonb, jsonb, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_material_mutate_atomic(text, jsonb, jsonb, uuid) TO authenticated;
