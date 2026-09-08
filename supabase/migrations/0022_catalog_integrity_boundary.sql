-- Close the remaining catalog mutation and semantic integrity gaps.

CREATE OR REPLACE FUNCTION public.validate_subject_catalog_semantics()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
    expected_theme public.color_theme_enum;
BEGIN
    expected_theme := CASE NEW.category
        WHEN 'Kế toán' THEN 'accounting'::public.color_theme_enum
        WHEN 'Kinh tế' THEN 'economics'::public.color_theme_enum
        WHEN 'Thống kê' THEN 'statistics'::public.color_theme_enum
        WHEN 'Marketing' THEN 'marketing'::public.color_theme_enum
        WHEN 'Quản trị' THEN 'management'::public.color_theme_enum
        WHEN 'Tài chính' THEN 'finance'::public.color_theme_enum
        WHEN 'MIS' THEN 'mis'::public.color_theme_enum
        WHEN 'Luật' THEN 'law'::public.color_theme_enum
        WHEN 'Ngoại ngữ' THEN 'languages'::public.color_theme_enum
    END;
    IF NEW.color_theme IS DISTINCT FROM expected_theme THEN
        RAISE EXCEPTION 'subject category and color theme are inconsistent' USING ERRCODE = '23514';
    END IF;
    IF EXISTS (
        SELECT 1
        FROM public.products
        WHERE subject_id = NEW.id
          AND (category IS DISTINCT FROM NEW.category OR color_theme IS DISTINCT FROM NEW.color_theme)
    ) THEN
        RAISE EXCEPTION 'subject metadata conflicts with products' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_validate_subject_catalog_semantics ON public.subjects;
CREATE TRIGGER trg_validate_subject_catalog_semantics
BEFORE INSERT OR UPDATE OF category, color_theme
ON public.subjects
FOR EACH ROW
EXECUTE FUNCTION public.validate_subject_catalog_semantics();

CREATE OR REPLACE FUNCTION public.validate_product_delivery_semantics()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
    IF (NEW.kind = 'material' AND NEW.delivery_kind IS DISTINCT FROM 'digital_download'::public.delivery_kind_enum)
       OR (NEW.kind = 'tutor' AND NEW.delivery_kind IS DISTINCT FROM 'one_on_one_tutoring'::public.delivery_kind_enum)
       OR (NEW.kind = 'course' AND NEW.delivery_kind NOT IN ('live_session'::public.delivery_kind_enum, 'recorded_video'::public.delivery_kind_enum)) THEN
        RAISE EXCEPTION 'product kind and delivery are inconsistent' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_validate_product_delivery_semantics ON public.products;
CREATE TRIGGER trg_validate_product_delivery_semantics
BEFORE INSERT OR UPDATE OF kind, delivery_kind
ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.validate_product_delivery_semantics();

CREATE OR REPLACE FUNCTION public.validate_course_delivery_semantics()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
    parent_delivery public.delivery_kind_enum;
BEGIN
    SELECT delivery_kind INTO parent_delivery
    FROM public.products
    WHERE id = NEW.product_id AND kind = 'course';
    IF NOT FOUND OR ((NEW.format = 'video' AND parent_delivery IS DISTINCT FROM 'recorded_video'::public.delivery_kind_enum)
       OR (NEW.format <> 'video' AND parent_delivery IS DISTINCT FROM 'live_session'::public.delivery_kind_enum)) THEN
        RAISE EXCEPTION 'course format and delivery are inconsistent' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_validate_course_delivery_semantics ON public.courses;
CREATE TRIGGER trg_validate_course_delivery_semantics
BEFORE INSERT OR UPDATE OF product_id, format
ON public.courses
FOR EACH ROW
EXECUTE FUNCTION public.validate_course_delivery_semantics();

CREATE OR REPLACE FUNCTION public.validate_tutor_subject_invariant()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
    checked_product_id UUID;
    product_subject_id UUID;
    association_count INTEGER;
    primary_count INTEGER;
    distinct_count INTEGER;
    primary_subject_id UUID;
BEGIN
    IF TG_TABLE_NAME = 'products' AND TG_OP = 'DELETE' THEN
        checked_product_id := OLD.id;
    ELSIF TG_TABLE_NAME = 'products' THEN
        checked_product_id := NEW.id;
    ELSIF TG_OP = 'DELETE' THEN
        checked_product_id := OLD.tutor_product_id;
    ELSE
        checked_product_id := NEW.tutor_product_id;
    END IF;

    SELECT subject_id INTO product_subject_id
    FROM public.products
    WHERE id = checked_product_id AND kind = 'tutor';
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    SELECT count(*), count(*) FILTER (WHERE is_primary)
    INTO association_count, primary_count
    FROM public.tutor_subjects
    WHERE tutor_product_id = checked_product_id;
    SELECT subject_id INTO primary_subject_id
    FROM public.tutor_subjects
    WHERE tutor_product_id = checked_product_id AND is_primary
    LIMIT 1;

    IF association_count = 0 OR primary_count <> 1 OR primary_subject_id IS DISTINCT FROM product_subject_id THEN
        RAISE EXCEPTION 'tutor subject associations are inconsistent' USING ERRCODE = '23514';
    END IF;
    RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_validate_tutor_subject_invariant ON public.tutor_subjects;
CREATE CONSTRAINT TRIGGER trg_validate_tutor_subject_invariant
AFTER INSERT OR UPDATE OR DELETE ON public.tutor_subjects
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.validate_tutor_subject_invariant();

DROP TRIGGER IF EXISTS trg_validate_tutor_product_subject_invariant ON public.products;
CREATE CONSTRAINT TRIGGER trg_validate_tutor_product_subject_invariant
AFTER INSERT OR UPDATE OR DELETE ON public.products
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.validate_tutor_subject_invariant();

REVOKE INSERT, UPDATE, DELETE ON TABLE public.subjects FROM anon, public, authenticated;
DROP POLICY IF EXISTS subjects_admin_insert ON public.subjects;
DROP POLICY IF EXISTS subjects_admin_update ON public.subjects;
DROP POLICY IF EXISTS subjects_admin_delete ON public.subjects;
REVOKE ALL ON FUNCTION public.admin_catalog_mutate_atomic(TEXT, public.product_kind_enum, JSONB, JSONB, UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_subject_mutate_atomic(
    p_operation TEXT,
    p_subject JSONB DEFAULT '{}'::jsonb,
    p_subject_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    subject_row public.subjects%ROWTYPE;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin' AND account_status = 'approved'
    ) THEN
        RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
    END IF;
    IF p_operation IS NULL OR p_operation NOT IN ('create', 'update', 'delete')
       OR jsonb_typeof(p_subject) IS DISTINCT FROM 'object' THEN
        RAISE EXCEPTION 'invalid subject payload' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (
        SELECT 1 FROM jsonb_object_keys(p_subject) AS key
        WHERE key NOT IN ('slug', 'name', 'category', 'faculty_group', 'color_theme')
    ) THEN
        RAISE EXCEPTION 'invalid subject payload' USING ERRCODE = '22023';
    END IF;
    IF p_operation = 'delete' THEN
        IF p_subject_id IS NULL OR p_subject <> '{}'::jsonb THEN
            RAISE EXCEPTION 'invalid subject delete payload' USING ERRCODE = '22023';
        END IF;
        DELETE FROM public.subjects WHERE id = p_subject_id RETURNING * INTO subject_row;
        IF NOT FOUND THEN RETURN NULL; END IF;
        RETURN jsonb_build_object('deleted', true, 'id', subject_row.id);
    END IF;
    IF p_operation = 'create' THEN
        IF p_subject_id IS NOT NULL
           OR NOT (p_subject ? 'slug') OR NOT (p_subject ? 'name')
           OR NOT (p_subject ? 'category') OR NOT (p_subject ? 'faculty_group')
           OR NOT (p_subject ? 'color_theme') THEN
            RAISE EXCEPTION 'invalid subject create payload' USING ERRCODE = '22023';
        END IF;
        INSERT INTO public.subjects (slug, name, category, faculty_group, color_theme)
        VALUES (p_subject->>'slug', p_subject->>'name', (p_subject->>'category')::public.category_enum, p_subject->>'faculty_group', (p_subject->>'color_theme')::public.color_theme_enum)
        RETURNING * INTO subject_row;
    ELSE
        IF p_subject_id IS NULL OR p_subject = '{}'::jsonb THEN
            RAISE EXCEPTION 'invalid subject update payload' USING ERRCODE = '22023';
        END IF;
        UPDATE public.subjects
        SET slug = CASE WHEN p_subject ? 'slug' THEN p_subject->>'slug' ELSE slug END,
            name = CASE WHEN p_subject ? 'name' THEN p_subject->>'name' ELSE name END,
            category = CASE WHEN p_subject ? 'category' THEN (p_subject->>'category')::public.category_enum ELSE category END,
            faculty_group = CASE WHEN p_subject ? 'faculty_group' THEN p_subject->>'faculty_group' ELSE faculty_group END,
            color_theme = CASE WHEN p_subject ? 'color_theme' THEN (p_subject->>'color_theme')::public.color_theme_enum ELSE color_theme END
        WHERE id = p_subject_id
        RETURNING * INTO subject_row;
        IF NOT FOUND THEN RETURN NULL; END IF;
    END IF;
    RETURN jsonb_build_object('subject', to_jsonb(subject_row));
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_subject_mutate_atomic(TEXT, JSONB, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_subject_mutate_atomic(TEXT, JSONB, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_catalog_mutate_v2(
    p_operation TEXT,
    p_kind public.product_kind_enum,
    p_product JSONB DEFAULT '{}'::jsonb,
    p_child JSONB DEFAULT '{}'::jsonb,
    p_product_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    product_row public.products%ROWTYPE;
    material_row public.materials%ROWTYPE;
    course_row public.courses%ROWTYPE;
    tutor_row public.tutors%ROWTYPE;
    association_count INTEGER;
    distinct_count INTEGER;
    primary_count INTEGER;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin' AND account_status = 'approved') THEN
        RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
    END IF;
    IF p_operation IS NULL OR p_operation NOT IN ('create', 'update', 'delete')
       OR jsonb_typeof(p_product) IS DISTINCT FROM 'object'
       OR jsonb_typeof(p_child) IS DISTINCT FROM 'object' THEN
        RAISE EXCEPTION 'invalid catalog payload' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (SELECT 1 FROM jsonb_object_keys(p_product) AS key WHERE key NOT IN ('slug', 'title', 'description', 'subject_id', 'category', 'delivery_kind', 'publication_status', 'price_vnd', 'old_price_vnd', 'is_contact_for_price', 'rating', 'is_hot', 'color_theme')) THEN
        RAISE EXCEPTION 'invalid product payload' USING ERRCODE = '22023';
    END IF;
    IF p_kind = 'material' AND EXISTS (SELECT 1 FROM jsonb_object_keys(p_child) AS key WHERE key NOT IN ('pages', 'tags', 'includes', 'suitable_for')) THEN
        RAISE EXCEPTION 'invalid material payload' USING ERRCODE = '22023';
    ELSIF p_kind = 'course' AND EXISTS (SELECT 1 FROM jsonb_object_keys(p_child) AS key WHERE key NOT IN ('format', 'sessions', 'duration', 'schedule', 'enrollment_status', 'mentor', 'tags', 'curriculum', 'suitable_for', 'preparation')) THEN
        RAISE EXCEPTION 'invalid course payload' USING ERRCODE = '22023';
    ELSIF p_kind = 'tutor' AND EXISTS (SELECT 1 FROM jsonb_object_keys(p_child) AS key WHERE key NOT IN ('name', 'faculty', 'format', 'availability', 'short_bio', 'strengths', 'tags', 'suitable_for', 'support_methods', 'subject_associations')) THEN
        RAISE EXCEPTION 'invalid tutor payload' USING ERRCODE = '22023';
    END IF;
    IF p_operation = 'delete' THEN
        IF p_product_id IS NULL OR p_product <> '{}'::jsonb OR p_child <> '{}'::jsonb THEN
            RAISE EXCEPTION 'invalid catalog delete payload' USING ERRCODE = '22023';
        END IF;
        DELETE FROM public.products WHERE id = p_product_id AND kind = p_kind RETURNING * INTO product_row;
        IF NOT FOUND THEN RETURN NULL; END IF;
        RETURN jsonb_build_object('deleted', true, 'id', product_row.id);
    END IF;
    IF p_operation = 'create' THEN
        IF p_product_id IS NOT NULL OR NOT (p_product ? 'slug') OR NOT (p_product ? 'title') OR NOT (p_product ? 'description') OR NOT (p_product ? 'subject_id') OR NOT (p_product ? 'category') OR NOT (p_product ? 'delivery_kind') OR NOT (p_product ? 'price_vnd') OR NOT (p_product ? 'is_contact_for_price') OR NOT (p_product ? 'color_theme') THEN
            RAISE EXCEPTION 'invalid catalog create payload' USING ERRCODE = '22023';
        END IF;
        INSERT INTO public.products (slug, kind, title, description, subject_id, category, delivery_kind, publication_status, price_vnd, old_price_vnd, is_contact_for_price, rating, is_hot, color_theme)
        VALUES (p_product->>'slug', p_kind, p_product->>'title', p_product->>'description', (p_product->>'subject_id')::uuid, (p_product->>'category')::public.category_enum, (p_product->>'delivery_kind')::public.delivery_kind_enum, COALESCE((p_product->>'publication_status')::public.publication_status_enum, 'published'), (p_product->>'price_vnd')::integer, CASE WHEN p_product ? 'old_price_vnd' THEN (p_product->>'old_price_vnd')::integer ELSE NULL END, (p_product->>'is_contact_for_price')::boolean, COALESCE((p_product->>'rating')::numeric, 5.00), COALESCE((p_product->>'is_hot')::boolean, false), (p_product->>'color_theme')::public.color_theme_enum)
        RETURNING * INTO product_row;
    ELSE
        IF p_product_id IS NULL OR (p_product = '{}'::jsonb AND p_child = '{}'::jsonb) THEN
            RAISE EXCEPTION 'invalid catalog update payload' USING ERRCODE = '22023';
        END IF;
        UPDATE public.products
        SET slug = CASE WHEN p_product ? 'slug' THEN p_product->>'slug' ELSE slug END,
            title = CASE WHEN p_product ? 'title' THEN p_product->>'title' ELSE title END,
            description = CASE WHEN p_product ? 'description' THEN p_product->>'description' ELSE description END,
            subject_id = CASE WHEN p_product ? 'subject_id' THEN (p_product->>'subject_id')::uuid ELSE subject_id END,
            category = CASE WHEN p_product ? 'category' THEN (p_product->>'category')::public.category_enum ELSE category END,
            delivery_kind = CASE WHEN p_product ? 'delivery_kind' THEN (p_product->>'delivery_kind')::public.delivery_kind_enum ELSE delivery_kind END,
            publication_status = CASE WHEN p_product ? 'publication_status' THEN (p_product->>'publication_status')::public.publication_status_enum ELSE publication_status END,
            price_vnd = CASE WHEN p_product ? 'price_vnd' THEN (p_product->>'price_vnd')::integer ELSE price_vnd END,
            old_price_vnd = CASE WHEN p_product ? 'old_price_vnd' THEN (p_product->>'old_price_vnd')::integer ELSE old_price_vnd END,
            is_contact_for_price = CASE WHEN p_product ? 'is_contact_for_price' THEN (p_product->>'is_contact_for_price')::boolean ELSE is_contact_for_price END,
            rating = CASE WHEN p_product ? 'rating' THEN (p_product->>'rating')::numeric ELSE rating END,
            is_hot = CASE WHEN p_product ? 'is_hot' THEN (p_product->>'is_hot')::boolean ELSE is_hot END,
            color_theme = CASE WHEN p_product ? 'color_theme' THEN (p_product->>'color_theme')::public.color_theme_enum ELSE color_theme END
        WHERE id = p_product_id AND kind = p_kind
        RETURNING * INTO product_row;
        IF NOT FOUND THEN RETURN NULL; END IF;
    END IF;
    IF p_kind = 'material' THEN
        IF p_operation = 'create' THEN
            IF NOT (p_child ? 'pages') THEN RAISE EXCEPTION 'invalid material payload' USING ERRCODE = '22023'; END IF;
            INSERT INTO public.materials (product_id, pages, tags, includes, suitable_for)
            VALUES (product_row.id, (p_child->>'pages')::integer, CASE WHEN p_child ? 'tags' THEN ARRAY(SELECT jsonb_array_elements_text(p_child->'tags')) ELSE '{}'::text[] END, CASE WHEN p_child ? 'includes' THEN ARRAY(SELECT jsonb_array_elements_text(p_child->'includes')) ELSE '{}'::text[] END, CASE WHEN p_child ? 'suitable_for' THEN ARRAY(SELECT jsonb_array_elements_text(p_child->'suitable_for')) ELSE '{}'::text[] END)
            RETURNING * INTO material_row;
        ELSIF p_child <> '{}'::jsonb THEN
            UPDATE public.materials SET pages = CASE WHEN p_child ? 'pages' THEN (p_child->>'pages')::integer ELSE pages END, tags = CASE WHEN p_child ? 'tags' THEN ARRAY(SELECT jsonb_array_elements_text(p_child->'tags')) ELSE tags END, includes = CASE WHEN p_child ? 'includes' THEN ARRAY(SELECT jsonb_array_elements_text(p_child->'includes')) ELSE includes END, suitable_for = CASE WHEN p_child ? 'suitable_for' THEN ARRAY(SELECT jsonb_array_elements_text(p_child->'suitable_for')) ELSE suitable_for END WHERE product_id = product_row.id RETURNING * INTO material_row;
        ELSE SELECT * INTO material_row FROM public.materials WHERE product_id = product_row.id;
        END IF;
        IF NOT FOUND THEN RAISE EXCEPTION 'catalog child is missing' USING ERRCODE = '23503'; END IF;
        RETURN jsonb_build_object('product', to_jsonb(product_row), 'child', to_jsonb(material_row));
    ELSIF p_kind = 'course' THEN
        IF p_operation = 'create' THEN
            IF NOT (p_child ? 'format') OR NOT (p_child ? 'sessions') OR NOT (p_child ? 'duration') OR NOT (p_child ? 'schedule') OR NOT (p_child ? 'mentor') THEN RAISE EXCEPTION 'invalid course payload' USING ERRCODE = '22023'; END IF;
            INSERT INTO public.courses (product_id, format, sessions, duration, schedule, enrollment_status, mentor, tags, curriculum, suitable_for, preparation)
            VALUES (product_row.id, (p_child->>'format')::public.course_format_enum, (p_child->>'sessions')::integer, p_child->>'duration', p_child->>'schedule', COALESCE((p_child->>'enrollment_status')::public.enrollment_status_enum, 'open'), p_child->>'mentor', CASE WHEN p_child ? 'tags' THEN ARRAY(SELECT jsonb_array_elements_text(p_child->'tags')) ELSE '{}'::text[] END, CASE WHEN p_child ? 'curriculum' THEN ARRAY(SELECT jsonb_array_elements_text(p_child->'curriculum')) ELSE '{}'::text[] END, CASE WHEN p_child ? 'suitable_for' THEN ARRAY(SELECT jsonb_array_elements_text(p_child->'suitable_for')) ELSE '{}'::text[] END, CASE WHEN p_child ? 'preparation' THEN ARRAY(SELECT jsonb_array_elements_text(p_child->'preparation')) ELSE '{}'::text[] END)
            RETURNING * INTO course_row;
        ELSIF p_child <> '{}'::jsonb THEN
            UPDATE public.courses SET format = CASE WHEN p_child ? 'format' THEN (p_child->>'format')::public.course_format_enum ELSE format END, sessions = CASE WHEN p_child ? 'sessions' THEN (p_child->>'sessions')::integer ELSE sessions END, duration = CASE WHEN p_child ? 'duration' THEN p_child->>'duration' ELSE duration END, schedule = CASE WHEN p_child ? 'schedule' THEN p_child->>'schedule' ELSE schedule END, enrollment_status = CASE WHEN p_child ? 'enrollment_status' THEN (p_child->>'enrollment_status')::public.enrollment_status_enum ELSE enrollment_status END, mentor = CASE WHEN p_child ? 'mentor' THEN p_child->>'mentor' ELSE mentor END, tags = CASE WHEN p_child ? 'tags' THEN ARRAY(SELECT jsonb_array_elements_text(p_child->'tags')) ELSE tags END, curriculum = CASE WHEN p_child ? 'curriculum' THEN ARRAY(SELECT jsonb_array_elements_text(p_child->'curriculum')) ELSE curriculum END, suitable_for = CASE WHEN p_child ? 'suitable_for' THEN ARRAY(SELECT jsonb_array_elements_text(p_child->'suitable_for')) ELSE suitable_for END, preparation = CASE WHEN p_child ? 'preparation' THEN ARRAY(SELECT jsonb_array_elements_text(p_child->'preparation')) ELSE preparation END WHERE product_id = product_row.id RETURNING * INTO course_row;
        ELSE SELECT * INTO course_row FROM public.courses WHERE product_id = product_row.id;
        END IF;
        IF NOT FOUND THEN RAISE EXCEPTION 'catalog child is missing' USING ERRCODE = '23503'; END IF;
        RETURN jsonb_build_object('product', to_jsonb(product_row), 'child', to_jsonb(course_row));
    ELSE
        IF p_operation = 'create' THEN
            IF NOT (p_child ? 'name') OR NOT (p_child ? 'faculty') OR NOT (p_child ? 'format') OR NOT (p_child ? 'availability') OR NOT (p_child ? 'short_bio') OR NOT (p_child ? 'subject_associations') THEN RAISE EXCEPTION 'invalid tutor payload' USING ERRCODE = '22023'; END IF;
            INSERT INTO public.tutors (product_id, name, faculty, format, availability, short_bio, strengths, tags, suitable_for, support_methods)
            VALUES (product_row.id, p_child->>'name', p_child->>'faculty', p_child->>'format', p_child->>'availability', p_child->>'short_bio', CASE WHEN p_child ? 'strengths' THEN ARRAY(SELECT jsonb_array_elements_text(p_child->'strengths')) ELSE '{}'::text[] END, CASE WHEN p_child ? 'tags' THEN ARRAY(SELECT jsonb_array_elements_text(p_child->'tags')) ELSE '{}'::text[] END, CASE WHEN p_child ? 'suitable_for' THEN ARRAY(SELECT jsonb_array_elements_text(p_child->'suitable_for')) ELSE '{}'::text[] END, CASE WHEN p_child ? 'support_methods' THEN ARRAY(SELECT jsonb_array_elements_text(p_child->'support_methods')) ELSE '{}'::text[] END)
            RETURNING * INTO tutor_row;
        ELSIF p_child <> '{}'::jsonb THEN
            UPDATE public.tutors SET name = CASE WHEN p_child ? 'name' THEN p_child->>'name' ELSE name END, faculty = CASE WHEN p_child ? 'faculty' THEN p_child->>'faculty' ELSE faculty END, format = CASE WHEN p_child ? 'format' THEN p_child->>'format' ELSE format END, availability = CASE WHEN p_child ? 'availability' THEN p_child->>'availability' ELSE availability END, short_bio = CASE WHEN p_child ? 'short_bio' THEN p_child->>'short_bio' ELSE short_bio END, strengths = CASE WHEN p_child ? 'strengths' THEN ARRAY(SELECT jsonb_array_elements_text(p_child->'strengths')) ELSE strengths END, tags = CASE WHEN p_child ? 'tags' THEN ARRAY(SELECT jsonb_array_elements_text(p_child->'tags')) ELSE tags END, suitable_for = CASE WHEN p_child ? 'suitable_for' THEN ARRAY(SELECT jsonb_array_elements_text(p_child->'suitable_for')) ELSE suitable_for END, support_methods = CASE WHEN p_child ? 'support_methods' THEN ARRAY(SELECT jsonb_array_elements_text(p_child->'support_methods')) ELSE support_methods END WHERE product_id = product_row.id RETURNING * INTO tutor_row;
        ELSE SELECT * INTO tutor_row FROM public.tutors WHERE product_id = product_row.id;
        END IF;
        IF NOT FOUND THEN RAISE EXCEPTION 'catalog child is missing' USING ERRCODE = '23503'; END IF;

        IF p_operation = 'create' OR p_child ? 'subject_associations' THEN
            IF jsonb_typeof(p_child->'subject_associations') IS DISTINCT FROM 'array' OR jsonb_array_length(p_child->'subject_associations') = 0 THEN RAISE EXCEPTION 'invalid tutor subject associations' USING ERRCODE = '22023'; END IF;
            IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_child->'subject_associations') AS association WHERE jsonb_typeof(association) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(association)) <> 2 OR EXISTS (SELECT 1 FROM jsonb_object_keys(association) AS key WHERE key NOT IN ('subject_id', 'is_primary')) OR jsonb_typeof(association->'subject_id') IS DISTINCT FROM 'string' OR jsonb_typeof(association->'is_primary') IS DISTINCT FROM 'boolean') THEN RAISE EXCEPTION 'invalid tutor subject associations' USING ERRCODE = '22023'; END IF;
            SELECT count(*), count(DISTINCT (association->>'subject_id')::uuid), count(*) FILTER (WHERE (association->>'is_primary')::boolean) INTO association_count, distinct_count, primary_count FROM jsonb_array_elements(p_child->'subject_associations') AS association;
            IF association_count <> distinct_count OR primary_count <> 1 OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_child->'subject_associations') AS association WHERE (association->>'is_primary')::boolean AND (association->>'subject_id')::uuid = product_row.subject_id) THEN RAISE EXCEPTION 'invalid tutor subject associations' USING ERRCODE = '22023'; END IF;
            IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_child->'subject_associations') AS association WHERE NOT EXISTS (SELECT 1 FROM public.subjects WHERE id = (association->>'subject_id')::uuid)) THEN RAISE EXCEPTION 'invalid tutor subject associations' USING ERRCODE = '23503'; END IF;
            DELETE FROM public.tutor_subjects WHERE tutor_product_id = product_row.id;
            INSERT INTO public.tutor_subjects (tutor_product_id, subject_id, is_primary)
            SELECT product_row.id, (association->>'subject_id')::uuid, (association->>'is_primary')::boolean FROM jsonb_array_elements(p_child->'subject_associations') AS association;
        ELSIF p_operation = 'update' AND p_product ? 'subject_id' THEN
            UPDATE public.tutor_subjects SET is_primary = false WHERE tutor_product_id = product_row.id;
            INSERT INTO public.tutor_subjects (tutor_product_id, subject_id, is_primary) VALUES (product_row.id, product_row.subject_id, true)
            ON CONFLICT (tutor_product_id, subject_id) DO UPDATE SET is_primary = true;
        END IF;
        RETURN jsonb_build_object('product', to_jsonb(product_row), 'child', to_jsonb(tutor_row));
    END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_catalog_mutate_v2(TEXT, public.product_kind_enum, JSONB, JSONB, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_catalog_mutate_v2(TEXT, public.product_kind_enum, JSONB, JSONB, UUID) TO authenticated;
