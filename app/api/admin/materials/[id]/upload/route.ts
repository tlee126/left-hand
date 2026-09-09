/**
 * The legacy upload URL is retained as a small JSON-only compatibility
 * endpoint. Binary uploads are handled by /prepare, Supabase Storage, and
 * /finalize; this route never parses a request body as multipart data.
 */
export { POST } from "./prepare/route";
