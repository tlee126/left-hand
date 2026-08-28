-- 0005_account_approval_gate.sql
-- Account Approval Gate schema additions, status constraints, and strict permissions
-- Compatibility policy: Existing profiles created prior to this migration are backfilled to 'approved'
-- so active users remain functional. All new user profiles default to 'pending'.

-- 1. Add approval gate columns to profiles table if not present
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'pending' 
    CHECK (account_status IN ('pending', 'approved', 'rejected', 'suspended')),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS approved_by UUID NULL REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS rejection_reason TEXT NULL;

-- 2. Prevent self-approval via check constraint (approved_by cannot equal profile id)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_profiles_no_self_approval'
    ) THEN
        ALTER TABLE profiles
        ADD CONSTRAINT chk_profiles_no_self_approval 
        CHECK (approved_by IS NULL OR approved_by <> id);
    END IF;
END $$;

-- 3. Backfill existing profiles created prior to this migration as 'approved'
-- Compatibility & backfill policy:
-- All profiles existing when this migration runs are intentionally marked approved so active users remain functional.
-- New profiles created afterward use the default pending value and require administrative approval.
UPDATE profiles 
SET account_status = 'approved' 
WHERE account_status = 'pending' AND created_at < timezone('utc'::text, now());

-- 4. Useful performance indexes for status lookups and approval auditing
CREATE INDEX IF NOT EXISTS idx_profiles_account_status ON profiles(account_status);
CREATE INDEX IF NOT EXISTS idx_profiles_approved_by ON profiles(approved_by);

-- 5. Row Level Security & Column Grants
-- Note: Migration 0004 already defines the base profile grants and RLS policies.
-- Migration 0005 repeats the REVOKE/GRANT statements intentionally for idempotent final-state safety.
-- Approval columns (account_status, approved_at, approved_by, rejection_reason) and privileged fields (role, email, etc.)
-- are strictly excluded from client INSERT/UPDATE grants.
-- Approval changes and status transitions are reserved for future server/admin workflow.
-- Ensure RLS is enabled on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Revoke broad table-level write permissions from authenticated users
REVOKE INSERT, UPDATE ON TABLE profiles FROM authenticated;

-- Allow authenticated users to read only their own profile
GRANT SELECT ON TABLE profiles TO authenticated;

-- Grant INSERT only on allowed non-privileged columns (account_status defaults to 'pending')
-- Client cannot supply account_status, approved_at, approved_by, rejection_reason, or role
GRANT INSERT (id, full_name, faculty, major, gpa_goal) ON TABLE profiles TO authenticated;

-- Grant UPDATE only on user-editable non-privileged columns
-- Client is strictly forbidden from modifying account_status, approved_at, approved_by, rejection_reason, role, etc.
GRANT UPDATE (full_name, faculty, major, gpa_goal) ON TABLE profiles TO authenticated;

