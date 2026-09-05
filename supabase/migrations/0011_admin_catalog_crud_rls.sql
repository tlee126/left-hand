-- Admin catalog CRUD RLS for subjects and the three product extensions.
-- Public SELECT policies and grants remain owned by migrations 0002-0003.

-- Keep catalog mutation privileges unavailable to anon/public and grant only
-- the explicit columns required by the admin catalog repository.
REVOKE INSERT, UPDATE, DELETE ON TABLE subjects FROM anon, public, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE products FROM anon, public, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE materials FROM anon, public, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE courses FROM anon, public, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE tutors FROM anon, public, authenticated;

GRANT INSERT (slug, name, category, faculty_group, color_theme) ON TABLE subjects TO authenticated;
GRANT UPDATE (slug, name, category, faculty_group, color_theme) ON TABLE subjects TO authenticated;
GRANT DELETE ON TABLE subjects TO authenticated;

GRANT INSERT (slug, kind, title, description, subject_id, category, delivery_kind, publication_status, price_vnd, old_price_vnd, is_contact_for_price, rating, is_hot, color_theme) ON TABLE products TO authenticated;
GRANT UPDATE (slug, kind, title, description, subject_id, category, delivery_kind, publication_status, price_vnd, old_price_vnd, is_contact_for_price, rating, is_hot, color_theme) ON TABLE products TO authenticated;
GRANT DELETE ON TABLE products TO authenticated;

GRANT INSERT (product_id, pages, tags, includes, suitable_for) ON TABLE materials TO authenticated;
GRANT UPDATE (pages, tags, includes, suitable_for) ON TABLE materials TO authenticated;
GRANT DELETE ON TABLE materials TO authenticated;

GRANT INSERT (product_id, format, sessions, duration, schedule, enrollment_status, mentor, tags, curriculum, suitable_for, preparation) ON TABLE courses TO authenticated;
GRANT UPDATE (format, sessions, duration, schedule, enrollment_status, mentor, tags, curriculum, suitable_for, preparation) ON TABLE courses TO authenticated;
GRANT DELETE ON TABLE courses TO authenticated;

GRANT INSERT (product_id, name, faculty, format, availability, short_bio, strengths, tags, suitable_for, support_methods) ON TABLE tutors TO authenticated;
GRANT UPDATE (name, faculty, format, availability, short_bio, strengths, tags, suitable_for, support_methods) ON TABLE tutors TO authenticated;
GRANT DELETE ON TABLE tutors TO authenticated;

CREATE POLICY "subjects_admin_insert"
ON subjects
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.account_status = 'approved'
  )
);

CREATE POLICY "subjects_admin_update"
ON subjects
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.account_status = 'approved'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.account_status = 'approved'
  )
);

CREATE POLICY "subjects_admin_delete"
ON subjects
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.account_status = 'approved'
  )
);

CREATE POLICY "products_admin_insert"
ON products
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.account_status = 'approved'
  )
);

CREATE POLICY "products_admin_update"
ON products
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.account_status = 'approved'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.account_status = 'approved'
  )
);

CREATE POLICY "products_admin_delete"
ON products
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.account_status = 'approved'
  )
);

CREATE POLICY "materials_admin_insert"
ON materials
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.account_status = 'approved'
  )
);

CREATE POLICY "materials_admin_update"
ON materials
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.account_status = 'approved'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.account_status = 'approved'
  )
);

CREATE POLICY "materials_admin_delete"
ON materials
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.account_status = 'approved'
  )
);

CREATE POLICY "courses_admin_insert"
ON courses
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.account_status = 'approved'
  )
);

CREATE POLICY "courses_admin_update"
ON courses
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.account_status = 'approved'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.account_status = 'approved'
  )
);

CREATE POLICY "courses_admin_delete"
ON courses
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.account_status = 'approved'
  )
);

CREATE POLICY "tutors_admin_insert"
ON tutors
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.account_status = 'approved'
  )
);

CREATE POLICY "tutors_admin_update"
ON tutors
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.account_status = 'approved'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.account_status = 'approved'
  )
);

CREATE POLICY "tutors_admin_delete"
ON tutors
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.account_status = 'approved'
  )
);
