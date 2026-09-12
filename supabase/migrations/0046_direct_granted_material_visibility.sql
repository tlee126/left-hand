-- Direct grants expose only unpublished material rows to their approved learner.
-- RLS filters rows, not columns; the existing catalog SELECT privileges remain unchanged.

CREATE OR REPLACE FUNCTION public.has_active_direct_granted_material_visibility(p_material_product_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.materials AS material
      JOIN public.material_direct_grants AS direct_grant
        ON direct_grant.material_id = material.product_id
      JOIN public.profiles AS learner
        ON learner.id = direct_grant.user_id
      WHERE material.product_id = p_material_product_id
        AND direct_grant.material_id = p_material_product_id
        AND direct_grant.user_id = auth.uid()
        AND direct_grant.can_view IS TRUE
        AND direct_grant.revoked_at IS NULL
        AND (direct_grant.expires_at IS NULL OR direct_grant.expires_at > now())
        AND learner.role = 'student'
        AND learner.account_status = 'approved'
    );
$function$;

REVOKE ALL ON FUNCTION public.has_active_direct_granted_material_visibility(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_active_direct_granted_material_visibility(uuid) TO authenticated;

CREATE POLICY direct_granted_unpublished_material_products
ON public.products
FOR SELECT
TO authenticated
USING (
  products.kind = 'material'
  AND products.publication_status IN ('draft', 'archived')
  AND public.has_active_direct_granted_material_visibility(products.id)
);

CREATE POLICY direct_granted_unpublished_material_rows
ON public.materials
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.products
    WHERE products.id = materials.product_id
      AND products.kind = 'material'
      AND products.publication_status IN ('draft', 'archived')
      AND public.has_active_direct_granted_material_visibility(materials.product_id)
  )
);
