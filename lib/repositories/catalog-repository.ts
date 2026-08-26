import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

export type ProductRow = Database["public"]["Tables"]["products"]["Row"];

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
