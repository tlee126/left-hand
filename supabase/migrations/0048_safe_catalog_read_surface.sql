-- Keep catalog row policies intact, but stop exposing base rows through the
-- column grants from 0047. PostgreSQL column grants must be revoked explicitly.
REVOKE SELECT ON TABLE public.products FROM anon, authenticated;
REVOKE SELECT (id, slug, kind, title, description, subject_id, category, delivery_kind, publication_status, price_vnd, old_price_vnd, is_contact_for_price, rating, is_hot, color_theme, created_at, updated_at, search_document)
  ON TABLE public.products FROM anon, authenticated;

REVOKE SELECT ON TABLE public.materials FROM anon, authenticated;
REVOKE SELECT (product_id, pages, tags, includes, suitable_for, allow_download, created_at, updated_at)
  ON TABLE public.materials FROM anon, authenticated;

-- Public catalog projection. This view runs with its owner privileges, so its
-- published-only predicate and exact product/child bindings are explicit.
CREATE VIEW public.public_catalog_read_surface
WITH (security_barrier = true)
AS
SELECT
  product.id,
  product.slug,
  product.kind,
  product.title,
  product.description,
  product.subject_id,
  product.category,
  product.delivery_kind,
  product.publication_status,
  product.price_vnd,
  product.old_price_vnd,
  product.is_contact_for_price,
  product.rating,
  product.is_hot,
  product.color_theme,
  product.created_at,
  jsonb_build_object(
    'id', subject.id,
    'slug', subject.slug,
    'name', subject.name,
    'category', subject.category,
    'faculty_group', subject.faculty_group,
    'color_theme', subject.color_theme
  ) AS subjects,
  CASE WHEN material.product_id IS NULL THEN NULL ELSE jsonb_build_object(
    'product_id', material.product_id,
    'pages', material.pages,
    'tags', material.tags,
    'includes', material.includes,
    'suitable_for', material.suitable_for
  ) END AS materials,
  CASE WHEN course.product_id IS NULL THEN NULL ELSE jsonb_build_object(
    'product_id', course.product_id,
    'format', course.format,
    'sessions', course.sessions,
    'duration', course.duration,
    'schedule', course.schedule,
    'enrollment_status', course.enrollment_status,
    'mentor', course.mentor,
    'tags', course.tags,
    'curriculum', course.curriculum,
    'suitable_for', course.suitable_for,
    'preparation', course.preparation
  ) END AS courses,
  CASE WHEN tutor.product_id IS NULL THEN NULL ELSE jsonb_build_object(
    'product_id', tutor.product_id,
    'name', tutor.name,
    'faculty', tutor.faculty,
    'format', tutor.format,
    'availability', tutor.availability,
    'short_bio', tutor.short_bio,
    'strengths', tutor.strengths,
    'tags', tutor.tags,
    'suitable_for', tutor.suitable_for,
    'support_methods', tutor.support_methods,
    'tutor_subjects', COALESCE(tutor_subjects.rows, '[]'::jsonb)
  ) END AS tutors
FROM public.products AS product
JOIN public.subjects AS subject ON subject.id = product.subject_id
LEFT JOIN public.materials AS material ON material.product_id = product.id
LEFT JOIN public.courses AS course ON course.product_id = product.id
LEFT JOIN public.tutors AS tutor ON tutor.product_id = product.id
LEFT JOIN LATERAL (
  SELECT jsonb_agg(
    jsonb_build_object(
      'is_primary', tutor_subject.is_primary,
      'subjects', jsonb_build_object(
        'id', tutor_subject_row.id,
        'slug', tutor_subject_row.slug,
        'name', tutor_subject_row.name,
        'category', tutor_subject_row.category,
        'faculty_group', tutor_subject_row.faculty_group,
        'color_theme', tutor_subject_row.color_theme
      )
    ) ORDER BY tutor_subject.is_primary DESC, tutor_subject.subject_id
  ) AS rows
  FROM public.tutor_subjects AS tutor_subject
  JOIN public.subjects AS tutor_subject_row ON tutor_subject_row.id = tutor_subject.subject_id
  WHERE tutor_subject.tutor_product_id = tutor.product_id
) AS tutor_subjects ON true
WHERE product.publication_status = 'published'
  AND (
    (product.kind = 'material' AND material.product_id = product.id)
    OR (product.kind = 'course' AND course.product_id = product.id)
    OR (product.kind = 'tutor' AND tutor.product_id = product.id)
  );

REVOKE ALL ON TABLE public.public_catalog_read_surface FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.public_catalog_read_surface TO anon, authenticated;

-- Text search uses the internal search_document only to resolve IDs. The
-- function never returns that index and can only return published products.
CREATE FUNCTION public.search_public_catalog_product_ids(
  p_kind public.product_kind_enum,
  p_search text
)
RETURNS TABLE (id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT product.id
  FROM public.products AS product
  WHERE product.publication_status = 'published'
    AND product.kind = p_kind
    AND p_search IS NOT NULL
    AND length(p_search) BETWEEN 1 AND 200
    AND product.search_document ILIKE ('%' || p_search || '%')
  ORDER BY product.id;
$function$;

REVOKE ALL ON FUNCTION public.search_public_catalog_product_ids(public.product_kind_enum, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_public_catalog_product_ids(public.product_kind_enum, text) TO anon, authenticated;

-- Approved-admin catalog reads stay available through a separate projection.
-- The profile predicate is required because this view also executes as owner.
CREATE VIEW public.admin_catalog_read_surface
WITH (security_barrier = true)
AS
SELECT
  product.id,
  product.slug,
  product.kind,
  product.title,
  product.description,
  product.subject_id,
  product.category,
  product.delivery_kind,
  product.publication_status,
  product.price_vnd,
  product.old_price_vnd,
  product.is_contact_for_price,
  product.rating,
  product.is_hot,
  product.color_theme,
  product.created_at,
  product.updated_at,
  CASE WHEN material.product_id IS NULL THEN NULL ELSE jsonb_build_object(
    'product_id', material.product_id,
    'pages', material.pages,
    'tags', material.tags,
    'includes', material.includes,
    'suitable_for', material.suitable_for,
    'allow_download', material.allow_download,
    'created_at', material.created_at,
    'updated_at', material.updated_at
  ) END AS materials,
  CASE WHEN course.product_id IS NULL THEN NULL ELSE jsonb_build_object(
    'product_id', course.product_id,
    'format', course.format,
    'sessions', course.sessions,
    'duration', course.duration,
    'schedule', course.schedule,
    'enrollment_status', course.enrollment_status,
    'mentor', course.mentor,
    'tags', course.tags,
    'curriculum', course.curriculum,
    'suitable_for', course.suitable_for,
    'preparation', course.preparation,
    'created_at', course.created_at,
    'updated_at', course.updated_at
  ) END AS courses,
  CASE WHEN tutor.product_id IS NULL THEN NULL ELSE jsonb_build_object(
    'product_id', tutor.product_id,
    'name', tutor.name,
    'faculty', tutor.faculty,
    'format', tutor.format,
    'availability', tutor.availability,
    'short_bio', tutor.short_bio,
    'strengths', tutor.strengths,
    'tags', tutor.tags,
    'suitable_for', tutor.suitable_for,
    'support_methods', tutor.support_methods,
    'created_at', tutor.created_at,
    'updated_at', tutor.updated_at
  ) END AS tutors
FROM public.products AS product
LEFT JOIN public.materials AS material ON material.product_id = product.id
LEFT JOIN public.courses AS course ON course.product_id = product.id
LEFT JOIN public.tutors AS tutor ON tutor.product_id = product.id
WHERE EXISTS (
  SELECT 1
  FROM public.profiles AS administrator
  WHERE administrator.id = auth.uid()
    AND administrator.role = 'admin'
    AND administrator.account_status = 'approved'
);

REVOKE ALL ON TABLE public.admin_catalog_read_surface FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.admin_catalog_read_surface TO authenticated;

-- Learner material projection: no raw grant fields, provider data, storage
-- paths, search index, or non-material products are included.
CREATE VIEW public.learner_material_read_surface
WITH (security_barrier = true)
AS
SELECT
  product.id AS product_id,
  product.subject_id,
  product.title,
  product.description,
  material.pages,
  material.allow_download
FROM public.products AS product
JOIN public.materials AS material ON material.product_id = product.id
WHERE product.kind = 'material'
  AND material.product_id = product.id
  AND EXISTS (
    SELECT 1
    FROM public.profiles AS learner
    WHERE learner.id = auth.uid()
      AND learner.role = 'student'
      AND learner.account_status = 'approved'
  )
  AND (
    product.publication_status = 'published'
    OR (
      product.publication_status IN ('draft', 'archived')
      AND public.has_active_direct_granted_material_visibility(material.product_id)
    )
  );

REVOKE ALL ON TABLE public.learner_material_read_surface FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.learner_material_read_surface TO authenticated;

-- Workspace courses remain a separate published-only learner surface.
CREATE VIEW public.learner_course_read_surface
WITH (security_barrier = true)
AS
SELECT
  product.id AS product_id,
  product.subject_id,
  product.title,
  product.description
FROM public.products AS product
JOIN public.courses AS course ON course.product_id = product.id
WHERE product.kind = 'course'
  AND course.product_id = product.id
  AND product.publication_status = 'published'
  AND EXISTS (
    SELECT 1
    FROM public.profiles AS learner
    WHERE learner.id = auth.uid()
      AND learner.role = 'student'
      AND learner.account_status = 'approved'
  );

REVOKE ALL ON TABLE public.learner_course_read_surface FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.learner_course_read_surface TO authenticated;

-- The workspace index combines only the two explicit learner surfaces above;
-- tutor products can never enter discovery or workspace queries.
CREATE VIEW public.student_workspace_product_read_surface
WITH (security_barrier = true)
AS
SELECT
  material.product_id AS id,
  material.subject_id,
  'material'::public.product_kind_enum AS kind,
  material.title,
  material.description
FROM public.learner_material_read_surface AS material
UNION ALL
SELECT
  course.product_id AS id,
  course.subject_id,
  'course'::public.product_kind_enum AS kind,
  course.title,
  course.description
FROM public.learner_course_read_surface AS course;

REVOKE ALL ON TABLE public.student_workspace_product_read_surface FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.student_workspace_product_read_surface TO authenticated;
