import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import type { MaterialItem } from "@/data/catalog";
import type { Category, ColorTheme } from "@/lib/domain/subjects";
import { formatVND } from "@/lib/domain/product-types";

export type ProductRow = Database["public"]["Tables"]["products"]["Row"];

interface MaterialJoinedRow extends ProductRow {
  materials: Database["public"]["Tables"]["materials"]["Row"] | null;
  subjects: Database["public"]["Tables"]["subjects"]["Row"] | null;
}

/**
 * Maps a raw joined database product + material + subject record to the frontend MaterialItem interface.
 */
export function mapRowToMaterialItem(row: MaterialJoinedRow): MaterialItem {
  const mat = row.materials;
  const subj = row.subjects;

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    subject: subj?.name ?? row.title,
    facultyGroup: subj?.faculty_group ?? "UFM",
    category: row.category as Category,
    type: "TÀI LIỆU",
    description: row.description,
    price: row.is_contact_for_price || row.price_vnd === null
      ? "Liên hệ"
      : formatVND(row.price_vnd),
    oldPrice: row.old_price_vnd ? formatVND(row.old_price_vnd) : undefined,
    pages: mat?.pages ?? 0,
    tags: mat?.tags ?? [],
    rating: Number(row.rating),
    isHot: row.is_hot,
    colorTheme: row.color_theme as ColorTheme,
    includes: mat?.includes ?? undefined,
    suitableFor: mat?.suitable_for ?? undefined
  };
}

/**
 * Lists all public published products from the products table,
 * ordered by created_at descending.
 */
export async function listPublishedProducts(): Promise<ProductRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("publication_status", "published")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to list published products: ${error.message}`);
  }

  return data ?? [];
}

/**
 * Retrieves a single published product by its slug.
 * Returns the product record or null if not found.
 */
export async function getPublishedProductBySlug(
  slug: string
): Promise<ProductRow | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("publication_status", "published")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to get published product by slug "${slug}": ${error.message}`
    );
  }

  return data;
}

/**
 * Lists all published materials joined with their material details and subject metadata.
 */
export async function listPublishedMaterials(): Promise<MaterialItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select("*, materials!inner(*), subjects(*)")
    .eq("publication_status", "published")
    .eq("kind", "material")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to list published materials: ${error.message}`);
  }

  return ((data as unknown as MaterialJoinedRow[]) ?? []).map(mapRowToMaterialItem);
}

/**
 * Retrieves a single published material by its slug.
 * Returns the mapped MaterialItem or null if not found.
 */
export async function getPublishedMaterialBySlug(
  slug: string
): Promise<MaterialItem | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select("*, materials!inner(*), subjects(*)")
    .eq("publication_status", "published")
    .eq("kind", "material")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to get published material by slug "${slug}": ${error.message}`
    );
  }

  if (!data) {
    return null;
  }

  return mapRowToMaterialItem(data as unknown as MaterialJoinedRow);
}
