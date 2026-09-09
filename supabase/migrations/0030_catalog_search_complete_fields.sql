-- Phase 5: keep one canonical, normalized search document for every catalog field.

CREATE OR REPLACE FUNCTION public.catalog_product_search_text(p_product_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public, extensions
AS $function$
  SELECT concat_ws(
    ' ',
    products.slug,
    products.kind,
    products.title,
    products.description,
    products.category,
    products.delivery_kind,
    products.publication_status,
    products.color_theme,
    subjects.slug,
    subjects.name,
    subjects.category,
    subjects.faculty_group,
    subjects.color_theme,
    materials.pages,
    array_to_string(materials.tags, ' '),
    array_to_string(materials.includes, ' '),
    array_to_string(materials.suitable_for, ' '),
    courses.format,
    courses.sessions,
    courses.duration,
    courses.schedule,
    courses.enrollment_status,
    courses.mentor,
    array_to_string(courses.tags, ' '),
    array_to_string(courses.curriculum, ' '),
    array_to_string(courses.suitable_for, ' '),
    array_to_string(courses.preparation, ' '),
    tutors.name,
    tutors.faculty,
    tutors.format,
    tutors.availability,
    tutors.short_bio,
    array_to_string(tutors.strengths, ' '),
    array_to_string(tutors.tags, ' '),
    array_to_string(tutors.suitable_for, ' '),
    array_to_string(tutors.support_methods, ' '),
    (
      SELECT string_agg(tutor_subjects.subject_id::text || ' ' || associated_subjects.slug || ' ' || associated_subjects.name, ' ' ORDER BY associated_subjects.slug)
      FROM public.tutor_subjects AS tutor_subjects
      JOIN public.subjects AS associated_subjects ON associated_subjects.id = tutor_subjects.subject_id
      WHERE tutor_subjects.tutor_product_id = products.id
    )
  )
  FROM public.products AS products
  JOIN public.subjects AS subjects ON subjects.id = products.subject_id
  LEFT JOIN public.materials AS materials ON materials.product_id = products.id
  LEFT JOIN public.courses AS courses ON courses.product_id = products.id
  LEFT JOIN public.tutors AS tutors ON tutors.product_id = products.id
  WHERE products.id = p_product_id;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_product_search_document()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $function$
DECLARE
  child_search text;
BEGIN
  SELECT concat_ws(
    ' ',
    NEW.slug,
    NEW.kind,
    NEW.title,
    NEW.description,
    NEW.category,
    NEW.delivery_kind,
    NEW.publication_status,
    NEW.color_theme,
    subjects.slug,
    subjects.name,
    subjects.category,
    subjects.faculty_group,
    subjects.color_theme,
    materials.pages,
    array_to_string(materials.tags, ' '),
    array_to_string(materials.includes, ' '),
    array_to_string(materials.suitable_for, ' '),
    courses.format,
    courses.sessions,
    courses.duration,
    courses.schedule,
    courses.enrollment_status,
    courses.mentor,
    array_to_string(courses.tags, ' '),
    array_to_string(courses.curriculum, ' '),
    array_to_string(courses.suitable_for, ' '),
    array_to_string(courses.preparation, ' '),
    tutors.name,
    tutors.faculty,
    tutors.format,
    tutors.availability,
    tutors.short_bio,
    array_to_string(tutors.strengths, ' '),
    array_to_string(tutors.tags, ' '),
    array_to_string(tutors.suitable_for, ' '),
    array_to_string(tutors.support_methods, ' '),
    (
      SELECT string_agg(tutor_subjects.subject_id::text || ' ' || associated_subjects.slug || ' ' || associated_subjects.name, ' ' ORDER BY associated_subjects.slug)
      FROM public.tutor_subjects AS tutor_subjects
      JOIN public.subjects AS associated_subjects ON associated_subjects.id = tutor_subjects.subject_id
      WHERE tutor_subjects.tutor_product_id = NEW.id
    )
  )
  INTO child_search
  FROM public.subjects AS subjects
  LEFT JOIN public.materials AS materials ON materials.product_id = NEW.id
  LEFT JOIN public.courses AS courses ON courses.product_id = NEW.id
  LEFT JOIN public.tutors AS tutors ON tutors.product_id = NEW.id
  WHERE subjects.id = NEW.subject_id;
  NEW.search_document := public.normalize_catalog_search(child_search);
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
  SET search_document = public.normalize_catalog_search(public.catalog_product_search_text(products.id))
  WHERE products.subject_id = NEW.id;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_product_search_document_from_child()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $function$
DECLARE
  checked_product_id uuid;
BEGIN
  checked_product_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.product_id ELSE NEW.product_id END;
  UPDATE public.products
  SET search_document = public.normalize_catalog_search(public.catalog_product_search_text(products.id))
  WHERE products.id = checked_product_id;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_product_search_document_from_tutor_subject()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $function$
DECLARE
  checked_product_id uuid;
BEGIN
  checked_product_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.tutor_product_id ELSE NEW.tutor_product_id END;
  UPDATE public.products
  SET search_document = public.normalize_catalog_search(public.catalog_product_search_text(products.id))
  WHERE products.id = checked_product_id;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_subject_search_document()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $function$
BEGIN
  NEW.search_document := public.normalize_catalog_search(concat_ws(' ', NEW.slug, NEW.name, NEW.category, NEW.faculty_group, NEW.color_theme));
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_refresh_product_search_document ON public.products;
CREATE TRIGGER trg_refresh_product_search_document
BEFORE INSERT OR UPDATE OF slug, kind, title, description, subject_id, category, delivery_kind, publication_status, color_theme
ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.refresh_product_search_document();

DROP TRIGGER IF EXISTS trg_refresh_products_for_subject_search ON public.subjects;
CREATE TRIGGER trg_refresh_products_for_subject_search
AFTER UPDATE OF slug, name, category, faculty_group, color_theme
ON public.subjects
FOR EACH ROW
EXECUTE FUNCTION public.refresh_products_for_subject_search();

DROP TRIGGER IF EXISTS trg_refresh_subject_search_document ON public.subjects;
CREATE TRIGGER trg_refresh_subject_search_document
BEFORE INSERT OR UPDATE OF slug, name, category, faculty_group, color_theme
ON public.subjects
FOR EACH ROW
EXECUTE FUNCTION public.refresh_subject_search_document();

DROP TRIGGER IF EXISTS trg_refresh_material_search_document ON public.materials;
CREATE TRIGGER trg_refresh_material_search_document
AFTER INSERT OR UPDATE OF product_id, pages, tags, includes, suitable_for OR DELETE
ON public.materials
FOR EACH ROW
EXECUTE FUNCTION public.refresh_product_search_document_from_child();

DROP TRIGGER IF EXISTS trg_refresh_course_search_document ON public.courses;
CREATE TRIGGER trg_refresh_course_search_document
AFTER INSERT OR UPDATE OF product_id, format, sessions, duration, schedule, enrollment_status, mentor, tags, curriculum, suitable_for, preparation OR DELETE
ON public.courses
FOR EACH ROW
EXECUTE FUNCTION public.refresh_product_search_document_from_child();

DROP TRIGGER IF EXISTS trg_refresh_tutor_search_document ON public.tutors;
CREATE TRIGGER trg_refresh_tutor_search_document
AFTER INSERT OR UPDATE OF product_id, name, faculty, format, availability, short_bio, strengths, tags, suitable_for, support_methods OR DELETE
ON public.tutors
FOR EACH ROW
EXECUTE FUNCTION public.refresh_product_search_document_from_child();

DROP TRIGGER IF EXISTS trg_refresh_tutor_subject_search_document ON public.tutor_subjects;
CREATE TRIGGER trg_refresh_tutor_subject_search_document
AFTER INSERT OR UPDATE OF tutor_product_id, subject_id OR DELETE
ON public.tutor_subjects
FOR EACH ROW
EXECUTE FUNCTION public.refresh_product_search_document_from_tutor_subject();

UPDATE public.products
SET search_document = public.normalize_catalog_search(public.catalog_product_search_text(products.id));
UPDATE public.subjects
SET search_document = public.normalize_catalog_search(concat_ws(' ', slug, name, category, faculty_group, color_theme));

REVOKE ALL ON FUNCTION public.catalog_product_search_text(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refresh_product_search_document() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refresh_products_for_subject_search() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refresh_product_search_document_from_child() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refresh_product_search_document_from_tutor_subject() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refresh_subject_search_document() FROM PUBLIC;
