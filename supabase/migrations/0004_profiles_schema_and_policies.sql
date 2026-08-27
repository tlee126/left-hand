-- 0004_profiles_schema_and_policies.sql
-- Add missing profile columns and security policies for protected student profiles

-- 1. Add gpa_goal and role columns to profiles table if not present
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS gpa_goal NUMERIC(3, 2) CHECK (gpa_goal >= 0.0 AND gpa_goal <= 4.0),
ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'tutor', 'admin'));

-- 2. Performance index on profile lookup
CREATE INDEX IF NOT EXISTS idx_profiles_id ON profiles(id);

-- 3. Row Level Security Policies for profiles

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

-- 4. Grant table privileges on profiles
GRANT SELECT, INSERT, UPDATE ON TABLE profiles TO authenticated;
