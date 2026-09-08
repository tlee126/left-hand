-- Keep indexed public search documents complete for every catalog child.

CREATE OR REPLACE FUNCTION public.normalize_catalog_search(value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public, extensions
AS $function$
    SELECT btrim(regexp_replace(regexp_replace(lower(extensions.unaccent(replace(replace(coalesce(value, ''), 'đ', 'd'), 'Đ', 'D'))), '[^[:alnum:]\s-]', ' ', 'g'), '\s+', ' ', 'g'));
$function$;

CREATE OR REPLACE FUNCTION public.refresh_product_search_document()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $function$
DECLARE
    subject_search TEXT;
    child_search TEXT;
BEGIN
    SELECT concat_ws(' ', subjects.slug, subjects.name, array_to_string(materials.tags, ' '), courses.mentor, array_to_string(courses.tags, ' '), tutors.name, tutors.faculty, tutors.format, array_to_string(tutors.tags, ' '))
    INTO subject_search
    FROM public.subjects AS subjects
    LEFT JOIN public.materials AS materials ON materials.product_id = NEW.id
    LEFT JOIN public.courses AS courses ON courses.product_id = NEW.id
    LEFT JOIN public.tutors AS tutors ON tutors.product_id = NEW.id
    WHERE subjects.id = NEW.subject_id;
    child_search := subject_search;
    NEW.search_document := public.normalize_catalog_search(concat_ws(' ', NEW.slug, NEW.title, NEW.description, child_search));
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
    SET search_document = public.normalize_catalog_search(concat_ws(' ', products.slug, products.title, products.description, subjects.slug, subjects.name, array_to_string(materials.tags, ' '), courses.mentor, array_to_string(courses.tags, ' '), tutors.name, tutors.faculty, tutors.format, array_to_string(tutors.tags, ' ')))
    FROM public.subjects AS subjects
    LEFT JOIN public.materials AS materials ON materials.product_id = products.id
    LEFT JOIN public.courses AS courses ON courses.product_id = products.id
    LEFT JOIN public.tutors AS tutors ON tutors.product_id = products.id
    WHERE products.subject_id = NEW.id AND subjects.id = products.subject_id;
    RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_product_search_document_from_child()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $function$
DECLARE
    checked_product_id UUID;
BEGIN
    checked_product_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.product_id ELSE NEW.product_id END;
    UPDATE public.products
    SET search_document = public.normalize_catalog_search(concat_ws(' ', products.slug, products.title, products.description, subjects.slug, subjects.name, array_to_string(materials.tags, ' '), courses.mentor, array_to_string(courses.tags, ' '), tutors.name, tutors.faculty, tutors.format, array_to_string(tutors.tags, ' ')))
    FROM public.subjects AS subjects
    LEFT JOIN public.materials AS materials ON materials.product_id = products.id
    LEFT JOIN public.courses AS courses ON courses.product_id = products.id
    LEFT JOIN public.tutors AS tutors ON tutors.product_id = products.id
    WHERE products.id = checked_product_id AND subjects.id = products.subject_id;
    RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_refresh_material_search_document ON public.materials;
CREATE TRIGGER trg_refresh_material_search_document
AFTER INSERT OR UPDATE OF product_id, tags, includes, suitable_for OR DELETE
ON public.materials
FOR EACH ROW
EXECUTE FUNCTION public.refresh_product_search_document_from_child();

DROP TRIGGER IF EXISTS trg_refresh_course_search_document ON public.courses;
CREATE TRIGGER trg_refresh_course_search_document
AFTER INSERT OR UPDATE OF product_id, mentor, tags, format OR DELETE
ON public.courses
FOR EACH ROW
EXECUTE FUNCTION public.refresh_product_search_document_from_child();

DROP TRIGGER IF EXISTS trg_refresh_tutor_search_document ON public.tutors;
CREATE TRIGGER trg_refresh_tutor_search_document
AFTER INSERT OR UPDATE OF product_id, name, faculty, format, tags OR DELETE
ON public.tutors
FOR EACH ROW
EXECUTE FUNCTION public.refresh_product_search_document_from_child();

UPDATE public.products
SET search_document = public.normalize_catalog_search(concat_ws(' ', products.slug, products.title, products.description, subjects.slug, subjects.name, array_to_string(materials.tags, ' '), courses.mentor, array_to_string(courses.tags, ' '), tutors.name, tutors.faculty, tutors.format, array_to_string(tutors.tags, ' ')))
FROM public.subjects AS subjects
LEFT JOIN public.materials AS materials ON materials.product_id = products.id
LEFT JOIN public.courses AS courses ON courses.product_id = products.id
LEFT JOIN public.tutors AS tutors ON tutors.product_id = products.id
WHERE subjects.id = products.subject_id;

REVOKE ALL ON FUNCTION public.normalize_catalog_search(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refresh_product_search_document() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refresh_products_for_subject_search() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refresh_product_search_document_from_child() FROM PUBLIC;
