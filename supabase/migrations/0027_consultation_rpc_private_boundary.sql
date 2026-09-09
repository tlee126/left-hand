-- Phase 4 release boundary.
-- The HTTP route is the only public intake entry point. The RPC is callable
-- only by the server-only service_role client, so PostgREST callers cannot
-- bypass the route's IP rate limiter.

REVOKE EXECUTE ON FUNCTION public.submit_consultation_intake(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_consultation_intake(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)
  TO service_role;
