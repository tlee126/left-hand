-- Phase 4 final intake boundary.
--
-- Migration 0006 allowed public column-level INSERT for the original form.
-- That allowed callers to bypass API source, catalog, and idempotency checks.
-- Keep the historical migration immutable and replace its public DML surface
-- with one fixed-signature, validation-owning database boundary.

REVOKE INSERT ON TABLE public.consultations FROM anon, authenticated;
DROP POLICY IF EXISTS "consultations_allow_insert_anon_authenticated" ON public.consultations;

CREATE OR REPLACE FUNCTION public.submit_consultation_intake(
  p_request_id TEXT,
  p_full_name TEXT,
  p_phone TEXT,
  p_faculty TEXT,
  p_major TEXT,
  p_interest TEXT,
  p_need TEXT,
  p_note TEXT,
  p_source_path TEXT,
  p_selected_product_slug TEXT,
  p_selected_subject_slug TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_phone TEXT;
  v_major TEXT;
  v_note TEXT;
  v_source_path TEXT;
  v_product_slug TEXT;
  v_subject_slug TEXT;
  v_product_count INTEGER;
  v_subject_count INTEGER;
  v_id UUID;
BEGIN
  IF p_request_id IS NULL OR p_request_id <> btrim(p_request_id)
    OR char_length(p_request_id) NOT BETWEEN 1 AND 100
    OR p_full_name IS NULL OR p_full_name <> btrim(p_full_name)
    OR char_length(p_full_name) NOT BETWEEN 2 AND 150
    OR p_faculty IS NULL OR p_faculty <> btrim(p_faculty)
    OR char_length(p_faculty) NOT BETWEEN 1 AND 150
    OR p_interest IS NULL OR p_interest <> btrim(p_interest)
    OR char_length(p_interest) NOT BETWEEN 1 AND 200
    OR p_need IS NULL OR p_need <> btrim(p_need)
    OR char_length(p_need) NOT BETWEEN 1 AND 2000
  THEN
    RAISE EXCEPTION 'Invalid consultation intake.' USING ERRCODE = '22023';
  END IF;

  v_phone := regexp_replace(COALESCE(p_phone, ''), '[ .()\-]', '', 'g');
  IF char_length(COALESCE(p_phone, '')) > 30
    OR v_phone !~ '^(?:\+84|84|0)(?:2|3|5|7|8|9)[0-9]{8,9}$'
  THEN
    RAISE EXCEPTION 'Invalid consultation intake.' USING ERRCODE = '22023';
  END IF;
  v_phone := CASE
    WHEN v_phone LIKE '+84%' THEN '0' || substring(v_phone FROM 4)
    WHEN v_phone LIKE '84%' THEN '0' || substring(v_phone FROM 3)
    ELSE v_phone
  END;

  v_major := NULLIF(btrim(COALESCE(p_major, '')), '');
  v_note := NULLIF(btrim(COALESCE(p_note, '')), '');
  IF char_length(COALESCE(v_major, '')) > 150 OR char_length(COALESCE(v_note, '')) > 5000 THEN
    RAISE EXCEPTION 'Invalid consultation intake.' USING ERRCODE = '22023';
  END IF;

  v_source_path := NULLIF(btrim(COALESCE(p_source_path, '')), '');
  IF v_source_path IS NOT NULL AND (
    char_length(v_source_path) > 500
    OR position(chr(92) IN v_source_path) > 0
    OR v_source_path LIKE '%?%'
    OR v_source_path LIKE '%#%'
    OR v_source_path LIKE '%' || chr(13) || '%'
    OR v_source_path LIKE '%' || chr(10) || '%'
    OR v_source_path = '//'
    OR v_source_path LIKE '//%'
    OR NOT (
      v_source_path = '/'
      OR v_source_path = '/tai-lieu' OR v_source_path LIKE '/tai-lieu/%'
      OR v_source_path = '/khoa-hoc' OR v_source_path LIKE '/khoa-hoc/%'
      OR v_source_path = '/tutor' OR v_source_path LIKE '/tutor/%'
    )
  ) THEN
    RAISE EXCEPTION 'Invalid consultation intake.' USING ERRCODE = '22023';
  END IF;

  v_product_slug := NULLIF(btrim(COALESCE(p_selected_product_slug, '')), '');
  v_subject_slug := NULLIF(btrim(COALESCE(p_selected_subject_slug, '')), '');
  IF char_length(COALESCE(v_product_slug, '')) > 150 OR char_length(COALESCE(v_subject_slug, '')) > 150 THEN
    RAISE EXCEPTION 'Invalid consultation intake.' USING ERRCODE = '22023';
  END IF;

  IF v_product_slug IS NOT NULL THEN
    SELECT count(*) INTO v_product_count
    FROM public.products AS product
    WHERE product.slug = v_product_slug
      AND product.publication_status = 'published';
    IF v_product_count <> 1 THEN
      RAISE EXCEPTION 'Invalid consultation intake.' USING ERRCODE = '22023';
    END IF;

    SELECT product.slug, subject.slug INTO v_product_slug, v_subject_slug
    FROM public.products AS product
    INNER JOIN public.subjects AS subject ON subject.id = product.subject_id
    WHERE product.slug = v_product_slug
      AND product.publication_status = 'published';

    IF p_selected_subject_slug IS NOT NULL
      AND NULLIF(btrim(p_selected_subject_slug), '') IS DISTINCT FROM v_subject_slug
    THEN
      RAISE EXCEPTION 'Invalid consultation intake.' USING ERRCODE = '22023';
    END IF;
  ELSIF v_subject_slug IS NOT NULL THEN
    SELECT count(*) INTO v_subject_count
    FROM public.subjects AS subject
    WHERE subject.slug = v_subject_slug;
    IF v_subject_count <> 1 THEN
      RAISE EXCEPTION 'Invalid consultation intake.' USING ERRCODE = '22023';
    END IF;
  END IF;

  INSERT INTO public.consultations (
    request_id, full_name, phone, faculty, major, interest, need, note,
    source_path, selected_product_slug, selected_subject_slug
  ) VALUES (
    p_request_id, p_full_name, v_phone, p_faculty, v_major, p_interest, p_need, v_note,
    v_source_path, v_product_slug, v_subject_slug
  ) ON CONFLICT (request_id) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object('outcome', 'duplicate');
  END IF;
  RETURN jsonb_build_object('outcome', 'created');
END;
$$;

REVOKE ALL ON FUNCTION public.submit_consultation_intake(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_consultation_intake(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
