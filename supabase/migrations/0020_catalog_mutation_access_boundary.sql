-- Close direct catalog table mutations; approved admins must use the atomic RPC.

CREATE OR REPLACE FUNCTION public.admin_catalog_mutate_atomic(
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

    RETURN public.admin_catalog_mutate(
        p_operation,
        p_kind,
        p_product,
        p_child,
        p_product_id
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_catalog_mutate(TEXT, public.product_kind_enum, JSONB, JSONB, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_catalog_mutate_atomic(TEXT, public.product_kind_enum, JSONB, JSONB, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_catalog_mutate_atomic(TEXT, public.product_kind_enum, JSONB, JSONB, UUID) TO authenticated;

REVOKE ALL PRIVILEGES ON TABLE public.products FROM authenticated;
GRANT SELECT ON TABLE public.products TO authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.materials FROM authenticated;
GRANT SELECT ON TABLE public.materials TO authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.courses FROM authenticated;
GRANT SELECT ON TABLE public.courses TO authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.tutors FROM authenticated;
GRANT SELECT ON TABLE public.tutors TO authenticated;

DROP POLICY IF EXISTS "products_admin_insert" ON public.products;
DROP POLICY IF EXISTS "products_admin_update" ON public.products;
DROP POLICY IF EXISTS "products_admin_delete" ON public.products;
DROP POLICY IF EXISTS "materials_admin_insert" ON public.materials;
DROP POLICY IF EXISTS "materials_admin_update" ON public.materials;
DROP POLICY IF EXISTS "materials_admin_delete" ON public.materials;
DROP POLICY IF EXISTS "courses_admin_insert" ON public.courses;
DROP POLICY IF EXISTS "courses_admin_update" ON public.courses;
DROP POLICY IF EXISTS "courses_admin_delete" ON public.courses;
DROP POLICY IF EXISTS "tutors_admin_insert" ON public.tutors;
DROP POLICY IF EXISTS "tutors_admin_update" ON public.tutors;
DROP POLICY IF EXISTS "tutors_admin_delete" ON public.tutors;
