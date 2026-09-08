-- Keep public catalog search normalized in the database for every product kind.

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION public.normalize_catalog_search(value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public, extensions
AS $function$
    SELECT btrim(
        regexp_replace(
            regexp_replace(
                lower(extensions.unaccent(coalesce(value, ''))),
                '[^[:alnum:]\s-]', ' ', 'g'
            ),
            '\s+', ' ', 'g'
        )
    );
$function$;

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS search_document TEXT NOT NULL DEFAULT '';
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS search_document TEXT NOT NULL DEFAULT '';

CREATE OR REPLACE FUNCTION public.refresh_product_search_document()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $function$
DECLARE
    subject_search TEXT;
BEGIN
    SELECT concat_ws(' ', slug, name)
    INTO subject_search
    FROM public.subjects
    WHERE id = NEW.subject_id;

    NEW.search_document := public.normalize_catalog_search(
        concat_ws(' ', NEW.slug, NEW.title, NEW.description, subject_search)
    );
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_subject_search_document()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $function$
BEGIN
    NEW.search_document := public.normalize_catalog_search(
        concat_ws(' ', NEW.slug, NEW.name)
    );
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_products_for_subject_search()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $function$
BEGIN
    UPDATE public.products
    SET search_document = public.normalize_catalog_search(
        concat_ws(' ', products.slug, products.title, products.description, NEW.slug, NEW.name)
    )
    WHERE products.subject_id = NEW.id;
    RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_refresh_product_search_document ON public.products;
CREATE TRIGGER trg_refresh_product_search_document
BEFORE INSERT OR UPDATE OF slug, title, description, subject_id
ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.refresh_product_search_document();

DROP TRIGGER IF EXISTS trg_refresh_subject_search_document ON public.subjects;
CREATE TRIGGER trg_refresh_subject_search_document
BEFORE INSERT OR UPDATE OF slug, name
ON public.subjects
FOR EACH ROW
EXECUTE FUNCTION public.refresh_subject_search_document();

DROP TRIGGER IF EXISTS trg_refresh_products_for_subject_search ON public.subjects;
CREATE TRIGGER trg_refresh_products_for_subject_search
AFTER UPDATE OF slug, name
ON public.subjects
FOR EACH ROW
EXECUTE FUNCTION public.refresh_products_for_subject_search();

UPDATE public.products
SET search_document = public.normalize_catalog_search(
    concat_ws(' ', products.slug, products.title, products.description, subjects.slug, subjects.name)
)
FROM public.subjects
WHERE subjects.id = products.subject_id;
UPDATE public.subjects
SET search_document = public.normalize_catalog_search(concat_ws(' ', slug, name));

CREATE INDEX IF NOT EXISTS idx_products_search_document ON public.products USING gin (search_document gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_subjects_search_document ON public.subjects USING gin (search_document gin_trgm_ops);

REVOKE ALL ON FUNCTION public.normalize_catalog_search(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refresh_product_search_document() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refresh_subject_search_document() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refresh_products_for_subject_search() FROM PUBLIC;
