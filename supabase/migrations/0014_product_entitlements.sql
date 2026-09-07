-- Product entitlement source of truth for server-side learner access checks.

CREATE TABLE public.product_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active',
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NULL,
  revoked_at timestamptz NULL,
  granted_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_entitlements_status_check CHECK (status IN ('active', 'revoked', 'expired')),
  CONSTRAINT product_entitlements_expires_after_grant CHECK (expires_at IS NULL OR expires_at > granted_at),
  CONSTRAINT product_entitlements_active_not_revoked CHECK (status <> 'active' OR revoked_at IS NULL),
  CONSTRAINT product_entitlements_revoked_at_required CHECK (status <> 'revoked' OR revoked_at IS NOT NULL),
  CONSTRAINT product_entitlements_user_product_unique UNIQUE (user_id, product_id)
);

CREATE INDEX idx_product_entitlements_user_product_status
  ON public.product_entitlements (user_id, product_id, status);

ALTER TABLE public.product_entitlements ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.product_entitlements FROM anon, public, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.product_entitlements TO authenticated;

CREATE POLICY product_entitlements_select_own
ON public.product_entitlements
FOR SELECT
TO authenticated
USING (public.product_entitlements.user_id = auth.uid());

CREATE POLICY product_entitlements_select_admin
ON public.product_entitlements
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE public.profiles.id = auth.uid()
      AND public.profiles.role = 'admin'
      AND public.profiles.account_status = 'approved'
  )
);

CREATE POLICY product_entitlements_insert_admin
ON public.product_entitlements
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE public.profiles.id = auth.uid()
      AND public.profiles.role = 'admin'
      AND public.profiles.account_status = 'approved'
  )
);

CREATE POLICY product_entitlements_update_admin
ON public.product_entitlements
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE public.profiles.id = auth.uid()
      AND public.profiles.role = 'admin'
      AND public.profiles.account_status = 'approved'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE public.profiles.id = auth.uid()
      AND public.profiles.role = 'admin'
      AND public.profiles.account_status = 'approved'
  )
);

CREATE POLICY product_entitlements_delete_admin
ON public.product_entitlements
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE public.profiles.id = auth.uid()
      AND public.profiles.role = 'admin'
      AND public.profiles.account_status = 'approved'
  )
);
