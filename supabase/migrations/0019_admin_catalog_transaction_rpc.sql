-- 0019_admin_catalog_transaction_rpc.sql
-- Make product/child catalog mutations atomic and close the product-kind boundary.

CREATE OR REPLACE FUNCTION public.admin_catalog_mutate(
    p_operation TEXT,
    p_kind public.product_kind_enum,
    p_product JSONB DEFAULT '{}'::jsonb,
    p_child JSONB DEFAULT '{}'::jsonb,
    p_product_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
    product_row public.products%ROWTYPE;
    material_row public.materials%ROWTYPE;
    course_row public.courses%ROWTYPE;
    tutor_row public.tutors%ROWTYPE;
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid()
          AND role = 'admin'
          AND account_status = 'approved'
    ) THEN
        RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
    END IF;

    IF p_operation IS NULL OR p_operation NOT IN ('create', 'update', 'delete') THEN
        RAISE EXCEPTION 'invalid catalog operation' USING ERRCODE = '22023';
    END IF;
    IF jsonb_typeof(p_product) IS DISTINCT FROM 'object'
       OR jsonb_typeof(p_child) IS DISTINCT FROM 'object' THEN
        RAISE EXCEPTION 'invalid catalog payload' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (
        SELECT 1
        FROM jsonb_object_keys(p_product) AS product_key
        WHERE product_key NOT IN (
            'slug', 'title', 'description', 'subject_id', 'category',
            'delivery_kind', 'publication_status', 'price_vnd',
            'old_price_vnd', 'is_contact_for_price', 'rating', 'is_hot',
            'color_theme'
        )
    ) THEN
        RAISE EXCEPTION 'invalid product payload' USING ERRCODE = '22023';
    END IF;
    IF p_kind = 'material' AND EXISTS (
        SELECT 1 FROM jsonb_object_keys(p_child) AS child_key
        WHERE child_key NOT IN ('pages', 'tags', 'includes', 'suitable_for')
    ) THEN
        RAISE EXCEPTION 'invalid material payload' USING ERRCODE = '22023';
    ELSIF p_kind = 'course' AND EXISTS (
        SELECT 1 FROM jsonb_object_keys(p_child) AS child_key
        WHERE child_key NOT IN ('format', 'sessions', 'duration', 'schedule', 'enrollment_status', 'mentor', 'tags', 'curriculum', 'suitable_for', 'preparation')
    ) THEN
        RAISE EXCEPTION 'invalid course payload' USING ERRCODE = '22023';
    ELSIF p_kind = 'tutor' AND EXISTS (
        SELECT 1 FROM jsonb_object_keys(p_child) AS child_key
        WHERE child_key NOT IN ('name', 'faculty', 'format', 'availability', 'short_bio', 'strengths', 'tags', 'suitable_for', 'support_methods')
    ) THEN
        RAISE EXCEPTION 'invalid tutor payload' USING ERRCODE = '22023';
    END IF;

    IF p_operation = 'delete' THEN
        IF p_product_id IS NULL OR p_product <> '{}'::jsonb OR p_child <> '{}'::jsonb THEN
            RAISE EXCEPTION 'invalid delete payload' USING ERRCODE = '22023';
        END IF;

        DELETE FROM public.products
        WHERE id = p_product_id AND kind = p_kind
        RETURNING * INTO product_row;

        IF NOT FOUND THEN
            RETURN NULL;
        END IF;
        RETURN jsonb_build_object('deleted', true, 'id', product_row.id);
    END IF;

    IF p_operation = 'create' THEN
        IF p_product_id IS NOT NULL
           OR NOT (p_product ? 'slug')
           OR NOT (p_product ? 'title')
           OR NOT (p_product ? 'description')
           OR NOT (p_product ? 'subject_id')
           OR NOT (p_product ? 'category')
           OR NOT (p_product ? 'delivery_kind')
           OR NOT (p_product ? 'price_vnd')
           OR NOT (p_product ? 'is_contact_for_price')
           OR NOT (p_product ? 'color_theme') THEN
            RAISE EXCEPTION 'invalid create payload' USING ERRCODE = '22023';
        END IF;

        INSERT INTO public.products (
            slug, kind, title, description, subject_id, category, delivery_kind,
            publication_status, price_vnd, old_price_vnd, is_contact_for_price,
            rating, is_hot, color_theme
        )
        VALUES (
            p_product->>'slug',
            p_kind,
            p_product->>'title',
            p_product->>'description',
            (p_product->>'subject_id')::uuid,
            (p_product->>'category')::public.category_enum,
            (p_product->>'delivery_kind')::public.delivery_kind_enum,
            COALESCE((p_product->>'publication_status')::public.publication_status_enum, 'published'),
            (p_product->>'price_vnd')::integer,
            CASE WHEN p_product ? 'old_price_vnd' THEN (p_product->>'old_price_vnd')::integer ELSE NULL END,
            (p_product->>'is_contact_for_price')::boolean,
            COALESCE((p_product->>'rating')::numeric, 5.00),
            COALESCE((p_product->>'is_hot')::boolean, false),
            (p_product->>'color_theme')::public.color_theme_enum
        )
        RETURNING * INTO product_row;
    ELSE
        IF p_product_id IS NULL OR (p_product = '{}'::jsonb AND p_child = '{}'::jsonb) THEN
            RAISE EXCEPTION 'invalid update payload' USING ERRCODE = '22023';
        END IF;

        UPDATE public.products
        SET
            slug = CASE WHEN p_product ? 'slug' THEN p_product->>'slug' ELSE slug END,
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

        IF NOT FOUND THEN
            RETURN NULL;
        END IF;
    END IF;

    IF p_kind = 'material' THEN
        IF p_operation = 'create' THEN
            IF NOT (p_child ? 'pages') THEN
                RAISE EXCEPTION 'invalid material payload' USING ERRCODE = '22023';
            END IF;
            INSERT INTO public.materials (product_id, pages, tags, includes, suitable_for)
            VALUES (
                product_row.id,
                (p_child->>'pages')::integer,
                CASE WHEN p_child ? 'tags' THEN ARRAY(SELECT jsonb_array_elements_text(p_child->'tags')) ELSE '{}'::text[] END,
                CASE WHEN p_child ? 'includes' THEN ARRAY(SELECT jsonb_array_elements_text(p_child->'includes')) ELSE '{}'::text[] END,
                CASE WHEN p_child ? 'suitable_for' THEN ARRAY(SELECT jsonb_array_elements_text(p_child->'suitable_for')) ELSE '{}'::text[] END
            )
            RETURNING * INTO material_row;
        ELSIF p_child <> '{}'::jsonb THEN
            UPDATE public.materials
            SET
                pages = CASE WHEN p_child ? 'pages' THEN (p_child->>'pages')::integer ELSE pages END,
                tags = CASE WHEN p_child ? 'tags' THEN ARRAY(SELECT jsonb_array_elements_text(p_child->'tags')) ELSE tags END,
                includes = CASE WHEN p_child ? 'includes' THEN ARRAY(SELECT jsonb_array_elements_text(p_child->'includes')) ELSE includes END,
                suitable_for = CASE WHEN p_child ? 'suitable_for' THEN ARRAY(SELECT jsonb_array_elements_text(p_child->'suitable_for')) ELSE suitable_for END
            WHERE product_id = product_row.id
            RETURNING * INTO material_row;
        ELSE
            SELECT * INTO material_row FROM public.materials WHERE product_id = product_row.id;
        END IF;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'catalog child is missing' USING ERRCODE = '23503';
        END IF;
        RETURN jsonb_build_object('product', to_jsonb(product_row), 'child', to_jsonb(material_row));
    ELSIF p_kind = 'course' THEN
        IF p_operation = 'create' THEN
            IF NOT (p_child ? 'format') OR NOT (p_child ? 'sessions') OR NOT (p_child ? 'duration') OR NOT (p_child ? 'schedule') OR NOT (p_child ? 'mentor') THEN
                RAISE EXCEPTION 'invalid course payload' USING ERRCODE = '22023';
            END IF;
            INSERT INTO public.courses (product_id, format, sessions, duration, schedule, enrollment_status, mentor, tags, curriculum, suitable_for, preparation)
            VALUES (
                product_row.id,
                (p_child->>'format')::public.course_format_enum,
                (p_child->>'sessions')::integer,
                p_child->>'duration',
                p_child->>'schedule',
                COALESCE((p_child->>'enrollment_status')::public.enrollment_status_enum, 'open'),
                p_child->>'mentor',
                CASE WHEN p_child ? 'tags' THEN ARRAY(SELECT jsonb_array_elements_text(p_child->'tags')) ELSE '{}'::text[] END,
                CASE WHEN p_child ? 'curriculum' THEN ARRAY(SELECT jsonb_array_elements_text(p_child->'curriculum')) ELSE '{}'::text[] END,
                CASE WHEN p_child ? 'suitable_for' THEN ARRAY(SELECT jsonb_array_elements_text(p_child->'suitable_for')) ELSE '{}'::text[] END,
                CASE WHEN p_child ? 'preparation' THEN ARRAY(SELECT jsonb_array_elements_text(p_child->'preparation')) ELSE '{}'::text[] END
            )
            RETURNING * INTO course_row;
        ELSIF p_child <> '{}'::jsonb THEN
            UPDATE public.courses
            SET
                format = CASE WHEN p_child ? 'format' THEN (p_child->>'format')::public.course_format_enum ELSE format END,
                sessions = CASE WHEN p_child ? 'sessions' THEN (p_child->>'sessions')::integer ELSE sessions END,
                duration = CASE WHEN p_child ? 'duration' THEN p_child->>'duration' ELSE duration END,
                schedule = CASE WHEN p_child ? 'schedule' THEN p_child->>'schedule' ELSE schedule END,
                enrollment_status = CASE WHEN p_child ? 'enrollment_status' THEN (p_child->>'enrollment_status')::public.enrollment_status_enum ELSE enrollment_status END,
                mentor = CASE WHEN p_child ? 'mentor' THEN p_child->>'mentor' ELSE mentor END,
                tags = CASE WHEN p_child ? 'tags' THEN ARRAY(SELECT jsonb_array_elements_text(p_child->'tags')) ELSE tags END,
                curriculum = CASE WHEN p_child ? 'curriculum' THEN ARRAY(SELECT jsonb_array_elements_text(p_child->'curriculum')) ELSE curriculum END,
                suitable_for = CASE WHEN p_child ? 'suitable_for' THEN ARRAY(SELECT jsonb_array_elements_text(p_child->'suitable_for')) ELSE suitable_for END,
                preparation = CASE WHEN p_child ? 'preparation' THEN ARRAY(SELECT jsonb_array_elements_text(p_child->'preparation')) ELSE preparation END
            WHERE product_id = product_row.id
            RETURNING * INTO course_row;
        ELSE
            SELECT * INTO course_row FROM public.courses WHERE product_id = product_row.id;
        END IF;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'catalog child is missing' USING ERRCODE = '23503';
        END IF;
        RETURN jsonb_build_object('product', to_jsonb(product_row), 'child', to_jsonb(course_row));
    ELSE
        IF p_operation = 'create' THEN
            IF NOT (p_child ? 'name') OR NOT (p_child ? 'faculty') OR NOT (p_child ? 'format') OR NOT (p_child ? 'availability') OR NOT (p_child ? 'short_bio') THEN
                RAISE EXCEPTION 'invalid tutor payload' USING ERRCODE = '22023';
            END IF;
            INSERT INTO public.tutors (product_id, name, faculty, format, availability, short_bio, strengths, tags, suitable_for, support_methods)
            VALUES (
                product_row.id,
                p_child->>'name',
                p_child->>'faculty',
                p_child->>'format',
                p_child->>'availability',
                p_child->>'short_bio',
                CASE WHEN p_child ? 'strengths' THEN ARRAY(SELECT jsonb_array_elements_text(p_child->'strengths')) ELSE '{}'::text[] END,
                CASE WHEN p_child ? 'tags' THEN ARRAY(SELECT jsonb_array_elements_text(p_child->'tags')) ELSE '{}'::text[] END,
                CASE WHEN p_child ? 'suitable_for' THEN ARRAY(SELECT jsonb_array_elements_text(p_child->'suitable_for')) ELSE '{}'::text[] END,
                CASE WHEN p_child ? 'support_methods' THEN ARRAY(SELECT jsonb_array_elements_text(p_child->'support_methods')) ELSE '{}'::text[] END
            )
            RETURNING * INTO tutor_row;
        ELSIF p_child <> '{}'::jsonb THEN
            UPDATE public.tutors
            SET
                name = CASE WHEN p_child ? 'name' THEN p_child->>'name' ELSE name END,
                faculty = CASE WHEN p_child ? 'faculty' THEN p_child->>'faculty' ELSE faculty END,
                format = CASE WHEN p_child ? 'format' THEN p_child->>'format' ELSE format END,
                availability = CASE WHEN p_child ? 'availability' THEN p_child->>'availability' ELSE availability END,
                short_bio = CASE WHEN p_child ? 'short_bio' THEN p_child->>'short_bio' ELSE short_bio END,
                strengths = CASE WHEN p_child ? 'strengths' THEN ARRAY(SELECT jsonb_array_elements_text(p_child->'strengths')) ELSE strengths END,
                tags = CASE WHEN p_child ? 'tags' THEN ARRAY(SELECT jsonb_array_elements_text(p_child->'tags')) ELSE tags END,
                suitable_for = CASE WHEN p_child ? 'suitable_for' THEN ARRAY(SELECT jsonb_array_elements_text(p_child->'suitable_for')) ELSE suitable_for END,
                support_methods = CASE WHEN p_child ? 'support_methods' THEN ARRAY(SELECT jsonb_array_elements_text(p_child->'support_methods')) ELSE support_methods END
            WHERE product_id = product_row.id
            RETURNING * INTO tutor_row;
        ELSE
            SELECT * INTO tutor_row FROM public.tutors WHERE product_id = product_row.id;
        END IF;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'catalog child is missing' USING ERRCODE = '23503';
        END IF;
        RETURN jsonb_build_object('product', to_jsonb(product_row), 'child', to_jsonb(tutor_row));
    END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_catalog_mutate(TEXT, public.product_kind_enum, JSONB, JSONB, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_catalog_mutate(TEXT, public.product_kind_enum, JSONB, JSONB, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.validate_product_kind_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
    IF OLD.kind IS DISTINCT FROM NEW.kind THEN
        RAISE EXCEPTION 'product kind is immutable' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_validate_product_kind_immutable ON public.products;
CREATE TRIGGER trg_validate_product_kind_immutable
BEFORE UPDATE OF kind ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.validate_product_kind_immutable();

REVOKE UPDATE (kind) ON TABLE public.products FROM authenticated;
REVOKE ALL ON FUNCTION public.validate_product_kind_immutable() FROM PUBLIC;

DROP POLICY IF EXISTS "Allow public read access on published materials" ON public.materials;
CREATE POLICY "Allow public read access on published materials"
ON public.materials FOR SELECT TO anon, authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.products
        WHERE products.id = materials.product_id
          AND products.kind = 'material'
          AND products.publication_status = 'published'
    )
);

DROP POLICY IF EXISTS "Allow public read access on published courses" ON public.courses;
CREATE POLICY "Allow public read access on published courses"
ON public.courses FOR SELECT TO anon, authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.products
        WHERE products.id = courses.product_id
          AND products.kind = 'course'
          AND products.publication_status = 'published'
    )
);

DROP POLICY IF EXISTS "Allow public read access on published course lessons" ON public.course_lessons;
CREATE POLICY "Allow public read access on published course lessons"
ON public.course_lessons FOR SELECT TO anon, authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.courses
        JOIN public.products ON products.id = courses.product_id
        WHERE courses.product_id = course_lessons.course_id
          AND products.kind = 'course'
          AND products.publication_status = 'published'
    )
);

DROP POLICY IF EXISTS "Allow public read access on published tutors" ON public.tutors;
CREATE POLICY "Allow public read access on published tutors"
ON public.tutors FOR SELECT TO anon, authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.products
        WHERE products.id = tutors.product_id
          AND products.kind = 'tutor'
          AND products.publication_status = 'published'
    )
);

DROP POLICY IF EXISTS "Allow public read access on published tutor subjects" ON public.tutor_subjects;
CREATE POLICY "Allow public read access on published tutor subjects"
ON public.tutor_subjects FOR SELECT TO anon, authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.tutors
        JOIN public.products ON products.id = tutors.product_id
        WHERE tutors.product_id = tutor_subjects.tutor_product_id
          AND products.kind = 'tutor'
          AND products.publication_status = 'published'
    )
);
