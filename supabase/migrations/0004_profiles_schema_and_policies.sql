-- 0004_profiles_schema_and_policies.sql
-- Add missing profile columns and strict column-level security policies for protected student profiles

-- 1. Add gpa_goal and role columns to profiles table if not present
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS gpa_goal NUMERIC(3, 2) CHECK (gpa_goal >= 0.0 AND gpa_goal <= 4.0),
ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'tutor', 'admin'));

-- 2. Performance index on profile lookup
CREATE INDEX IF NOT EXISTS idx_profiles_id ON profiles(id);

-- 3. Automatic updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON profiles;
CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 4. Row Level Security Policies for profiles

-- Drop old policies if any exist
DROP POLICY IF EXISTS "Allow individual read access on own profile" ON profiles;
DROP POLICY IF EXISTS "Allow individual insert access on own profile" ON profiles;
DROP POLICY IF EXISTS "Allow individual update access on own profile" ON profiles;

-- Authenticated users can SELECT only their own profile
CREATE POLICY "Allow individual read access on own profile"
ON profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Authenticated users can INSERT their own profile
CREATE POLICY "Allow individual insert access on own profile"
ON profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Authenticated users can UPDATE only their own profile
CREATE POLICY "Allow individual update access on own profile"
ON profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 5. Strict Column-Level Permissions for authenticated users
-- Revoke broad table-level write permissions first
REVOKE INSERT, UPDATE ON TABLE profiles FROM authenticated;

-- Grant SELECT on all columns of own profile
GRANT SELECT ON TABLE profiles TO authenticated;

-- Grant INSERT only on allowed non-privileged columns (role/email/phone/updated_at are forbidden)
GRANT INSERT (id, full_name, faculty, major, gpa_goal) ON TABLE profiles TO authenticated;

-- Grant UPDATE only on user-editable non-privileged columns (id/role/email/phone/updated_at are forbidden)
GRANT UPDATE (full_name, faculty, major, gpa_goal) ON TABLE profiles TO authenticated;
