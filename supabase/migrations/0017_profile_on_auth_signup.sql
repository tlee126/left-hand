-- 0017_profile_on_auth_signup.sql
-- Create a pending student profile whenever Supabase Auth creates a user.

CREATE OR REPLACE FUNCTION public.handle_auth_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    metadata_full_name TEXT;
    metadata_name TEXT;
    email_local_part TEXT;
    resolved_full_name TEXT;
BEGIN
    metadata_full_name := NULLIF(BTRIM(NEW.raw_user_meta_data ->> 'full_name'), '');
    metadata_name := NULLIF(BTRIM(NEW.raw_user_meta_data ->> 'name'), '');
    email_local_part := NULLIF(BTRIM(SPLIT_PART(COALESCE(NEW.email, ''), '@', 1)), '');

    resolved_full_name := LEFT(
        BTRIM(COALESCE(metadata_full_name, metadata_name, email_local_part, 'Học viên')),
        200
    );
    IF resolved_full_name = '' THEN
        resolved_full_name := 'Học viên';
    END IF;

    INSERT INTO public.profiles (id, email, full_name)
    VALUES (NEW.id, NEW.email, resolved_full_name)
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_auth_user_profile();

REVOKE ALL ON FUNCTION public.handle_auth_user_profile() FROM PUBLIC;
