-- 0003_public_catalog_table_grants.sql
-- Grant schema usage and table-level SELECT permissions on public catalog tables to anon and authenticated roles

-- 1. Grant USAGE on public schema
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- 2. Grant SELECT privileges only on public catalog tables
GRANT SELECT ON TABLE subjects TO anon, authenticated;
GRANT SELECT ON TABLE products TO anon, authenticated;
GRANT SELECT ON TABLE materials TO anon, authenticated;
GRANT SELECT ON TABLE courses TO anon, authenticated;
GRANT SELECT ON TABLE course_lessons TO anon, authenticated;
GRANT SELECT ON TABLE tutors TO anon, authenticated;
GRANT SELECT ON TABLE tutor_subjects TO anon, authenticated;
