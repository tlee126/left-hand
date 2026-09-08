-- 0018_catalog_semantic_invariants.sql
-- Enforce cross-table catalog semantics that enum types and foreign keys cannot express.

ALTER TABLE public.products
    ADD CONSTRAINT chk_products_old_price_semantics CHECK (
        old_price_vnd IS NULL
        OR (
            is_contact_for_price = false
            AND price_vnd IS NOT NULL
            AND old_price_vnd >= price_vnd
        )
    );

ALTER TABLE public.tutors
    ADD CONSTRAINT chk_tutors_format_canonical CHECK (format IN (
        '1:1 & Nhóm nhỏ (Online/Offline)',
        '1:1 (Online/Offline quận 7)',
        '1:1 & Nhóm nhỏ (Online)',
        '1:1 (Online qua Google Meet)',
        '1:1 & Nhóm nhỏ (Offline/Online)',
        '1:1 (Online)',
        '1:1 & Nhóm nhỏ (Online/Offline Q7)'
    ));

CREATE UNIQUE INDEX uq_tutor_subjects_one_primary
    ON public.tutor_subjects (tutor_product_id)
    WHERE is_primary = true;

CREATE OR REPLACE FUNCTION public.validate_product_catalog_semantics()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
    subject_category category_enum;
    subject_theme color_theme_enum;
    expected_theme color_theme_enum;
BEGIN
    SELECT category, color_theme
    INTO subject_category, subject_theme
    FROM public.subjects
    WHERE id = NEW.subject_id;

    IF subject_category IS NULL THEN
        RAISE EXCEPTION 'Product subject does not exist';
    END IF;

    expected_theme := CASE NEW.category
        WHEN 'Kế toán' THEN 'accounting'::color_theme_enum
        WHEN 'Kinh tế' THEN 'economics'::color_theme_enum
        WHEN 'Thống kê' THEN 'statistics'::color_theme_enum
        WHEN 'Marketing' THEN 'marketing'::color_theme_enum
        WHEN 'Quản trị' THEN 'management'::color_theme_enum
        WHEN 'Tài chính' THEN 'finance'::color_theme_enum
        WHEN 'MIS' THEN 'mis'::color_theme_enum
        WHEN 'Luật' THEN 'law'::color_theme_enum
        WHEN 'Ngoại ngữ' THEN 'languages'::color_theme_enum
    END;

    IF NEW.category <> subject_category OR NEW.color_theme <> subject_theme OR NEW.color_theme <> expected_theme THEN
        RAISE EXCEPTION 'Product category and color theme must match its subject';
    END IF;

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_subject_catalog_semantics()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
    expected_theme color_theme_enum;
BEGIN
    expected_theme := CASE NEW.category
        WHEN 'Kế toán' THEN 'accounting'::color_theme_enum
        WHEN 'Kinh tế' THEN 'economics'::color_theme_enum
        WHEN 'Thống kê' THEN 'statistics'::color_theme_enum
        WHEN 'Marketing' THEN 'marketing'::color_theme_enum
        WHEN 'Quản trị' THEN 'management'::color_theme_enum
        WHEN 'Tài chính' THEN 'finance'::color_theme_enum
        WHEN 'MIS' THEN 'mis'::color_theme_enum
        WHEN 'Luật' THEN 'law'::color_theme_enum
        WHEN 'Ngoại ngữ' THEN 'languages'::color_theme_enum
    END;

    IF NEW.color_theme <> expected_theme THEN
        RAISE EXCEPTION 'Subject color theme must match its category';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.products
        WHERE subject_id = NEW.id
          AND (category <> NEW.category OR color_theme <> NEW.color_theme)
    ) THEN
        RAISE EXCEPTION 'Subject category and color theme cannot invalidate existing products';
    END IF;

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_material_product_kind()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = NEW.product_id AND kind = 'material') THEN
        RAISE EXCEPTION 'Material extension requires a material product';
    END IF;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_course_product_kind()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = NEW.product_id AND kind = 'course') THEN
        RAISE EXCEPTION 'Course extension requires a course product';
    END IF;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_tutor_product_kind()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = NEW.product_id AND kind = 'tutor') THEN
        RAISE EXCEPTION 'Tutor extension requires a tutor product';
    END IF;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_tutor_subject_product_kind()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = NEW.tutor_product_id AND kind = 'tutor') THEN
        RAISE EXCEPTION 'Tutor subject association requires a tutor product';
    END IF;
    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_validate_product_catalog_semantics ON public.products;
CREATE TRIGGER trg_validate_product_catalog_semantics
BEFORE INSERT OR UPDATE OF subject_id, category, color_theme
ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.validate_product_catalog_semantics();

DROP TRIGGER IF EXISTS trg_validate_subject_catalog_semantics ON public.subjects;
CREATE TRIGGER trg_validate_subject_catalog_semantics
BEFORE UPDATE OF category, color_theme
ON public.subjects
FOR EACH ROW
EXECUTE FUNCTION public.validate_subject_catalog_semantics();

DROP TRIGGER IF EXISTS trg_validate_material_product_kind ON public.materials;
CREATE TRIGGER trg_validate_material_product_kind
BEFORE INSERT OR UPDATE OF product_id
ON public.materials
FOR EACH ROW
EXECUTE FUNCTION public.validate_material_product_kind();

DROP TRIGGER IF EXISTS trg_validate_course_product_kind ON public.courses;
CREATE TRIGGER trg_validate_course_product_kind
BEFORE INSERT OR UPDATE OF product_id
ON public.courses
FOR EACH ROW
EXECUTE FUNCTION public.validate_course_product_kind();

DROP TRIGGER IF EXISTS trg_validate_tutor_product_kind ON public.tutors;
CREATE TRIGGER trg_validate_tutor_product_kind
BEFORE INSERT OR UPDATE OF product_id
ON public.tutors
FOR EACH ROW
EXECUTE FUNCTION public.validate_tutor_product_kind();

DROP TRIGGER IF EXISTS trg_validate_tutor_subject_product_kind ON public.tutor_subjects;
CREATE TRIGGER trg_validate_tutor_subject_product_kind
BEFORE INSERT OR UPDATE OF tutor_product_id
ON public.tutor_subjects
FOR EACH ROW
EXECUTE FUNCTION public.validate_tutor_subject_product_kind();

REVOKE ALL ON FUNCTION public.validate_product_catalog_semantics() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_subject_catalog_semantics() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_material_product_kind() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_course_product_kind() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_tutor_product_kind() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_tutor_subject_product_kind() FROM PUBLIC;
