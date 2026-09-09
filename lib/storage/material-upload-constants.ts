export const MATERIALS_BUCKET = "materials";
export const MATERIAL_SIGNED_URL_EXPIRES_IN_SECONDS = 300;
export const MATERIAL_UPLOAD_EXPIRES_IN_SECONDS = 2 * 60 * 60;
export const MAX_PDF_BYTES = 20 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 500 * 1024 * 1024;
export const SUPPORTED_MATERIAL_MIME_TYPES = [
  "application/pdf",
  "video/mp4",
  "video/webm",
  "video/quicktime"
] as const;
