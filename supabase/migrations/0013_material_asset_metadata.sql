-- Immutable metadata for private material-file versions. Object storage remains owned by 0012.

CREATE TABLE public.material_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  storage_path text NOT NULL UNIQUE,
  original_name text NOT NULL,
  mime_type text NOT NULL,
  byte_size bigint NOT NULL,
  version integer NOT NULL,
  visibility text NOT NULL DEFAULT 'private',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT material_assets_byte_size_positive CHECK (byte_size > 0),
  CONSTRAINT material_assets_version_positive CHECK (version >= 1),
  CONSTRAINT material_assets_visibility_private CHECK (visibility = 'private'),
  CONSTRAINT material_assets_storage_path_materials CHECK (
    storage_path ~ '^materials/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/v[1-9][0-9]*/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[a-z0-9][a-z0-9._-]*$'
  ),
  CONSTRAINT material_assets_product_version_unique UNIQUE (product_id, version),
  CONSTRAINT material_assets_product_material_fkey
    FOREIGN KEY (product_id) REFERENCES public.materials(product_id) ON DELETE CASCADE
);

ALTER TABLE public.material_assets ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.material_assets FROM anon, public, authenticated;
GRANT SELECT, INSERT ON TABLE public.material_assets TO authenticated;

CREATE POLICY "material_assets_approved_admin_select"
ON public.material_assets
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

CREATE POLICY "material_assets_approved_admin_insert"
ON public.material_assets
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
