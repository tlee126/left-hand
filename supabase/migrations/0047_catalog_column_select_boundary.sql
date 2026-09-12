-- Replace catalog table-wide SELECT with the smallest column sets used by
-- public catalog queries and current authenticated learner/admin repositories.
-- PostgreSQL column privileges are role-wide; admin-required timestamps on
-- materials therefore remain selectable by authenticated learners as well.

REVOKE SELECT ON TABLE public.products FROM anon, authenticated;
REVOKE SELECT ON TABLE public.materials FROM anon, authenticated;

-- Public catalog projections, filters, ordering, consultation selection, and
-- product/material RLS predicates use these product columns. search_document
-- is needed by the public catalog text-search filter even though it is not in
-- the response projection.
GRANT SELECT (
  id,
  slug,
  kind,
  title,
  description,
  subject_id,
  category,
  delivery_kind,
  publication_status,
  price_vnd,
  old_price_vnd,
  is_contact_for_price,
  rating,
  is_hot,
  color_theme,
  created_at,
  updated_at,
  search_document
)
ON TABLE public.products
TO anon, authenticated;

-- Public catalog material projections need the descriptive fields; learner
-- workspace needs allow_download. The current authenticated admin catalog
-- query also selects the timestamps, so they must remain granted to the shared
-- authenticated role and are consequently readable by learners on visible rows.
GRANT SELECT (
  product_id,
  pages,
  tags,
  includes,
  suitable_for
)
ON TABLE public.materials
TO anon, authenticated;

GRANT SELECT (
  allow_download,
  created_at,
  updated_at
)
ON TABLE public.materials
TO authenticated;
