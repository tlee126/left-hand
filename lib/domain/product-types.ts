/**
 * Canonical Learning Domain - Product Types, Delivery, Status & Pricing
 */

import { Category, ColorTheme } from "./subjects";

export const PRODUCT_KINDS = ["material", "course", "tutor"] as const;
export type ProductKind = (typeof PRODUCT_KINDS)[number];

export const DELIVERY_KINDS = [
  "digital_download",
  "live_session",
  "recorded_video",
  "one_on_one_tutoring"
] as const;
export type DeliveryKind = (typeof DELIVERY_KINDS)[number];

export const PUBLICATION_STATUSES = [
  "draft",
  "published",
  "archived",
  "coming_soon",
  "full"
] as const;
export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number];

/**
 * Currency amount in integer VND (Vietnamese Dong).
 * Always non-negative integer representing the exact monetary amount (VND has no fractional cents).
 */
export type MoneyVND = number;

export interface ProductPricing {
  readonly amountVND: MoneyVND;
  readonly originalAmountVND?: MoneyVND;
  readonly isContactForPrice?: boolean;
}

export interface BaseProduct {
  readonly id: string;
  readonly slug: string;
  readonly kind: ProductKind;
  readonly title: string;
  readonly subjectSlug: string;
  readonly category: Category;
  readonly deliveryKind: DeliveryKind;
  readonly status: PublicationStatus;
  readonly pricing: ProductPricing;
  readonly rating: number;
  readonly isHot?: boolean;
  readonly colorTheme: ColorTheme;
}

/**
 * Parses a string representation or number into a valid non-negative integer VND amount.
 * Examples:
 *   "29.000đ" -> 29000
 *   "29000"   -> 29000
 *   "29.000"  -> 29000
 *   29000     -> 29000
 *   "Liên hệ" -> null
 *
 * @throws Error if input is a negative value or invalid numeric format.
 */
export function parseVND(input: string | number | null | undefined): MoneyVND | null {
  if (input === null || input === undefined) {
    return null;
  }

  if (typeof input === "number") {
    if (!Number.isFinite(input) || input < 0 || !Number.isInteger(input)) {
      throw new Error(`Invalid VND amount: must be a non-negative integer, got ${input}`);
    }
    return input;
  }

  const trimmed = input.trim();
  if (trimmed === "" || /^(liên hệ|contact)$/i.test(trimmed)) {
    return null;
  }

  // Remove currency symbol, whitespace, dots and commas used as thousand separators
  const sanitized = trimmed
    .replace(/[₫đĐ]/g, "")
    .replace(/\s+/g, "")
    .replace(/[.,]/g, "");

  if (!/^\d+$/.test(sanitized)) {
    throw new Error(`Cannot parse VND amount from string: "${input}"`);
  }

  const parsed = parseInt(sanitized, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`Parsed VND amount is out of bounds or negative: ${parsed}`);
  }

  return parsed;
}

/**
 * Formats an integer VND amount into standard Vietnamese UI currency string (e.g. 29000 -> "29.000đ").
 * Returns "Liên hệ" if amount is null or undefined.
 */
export function formatVND(amountVND: MoneyVND | null | undefined): string {
  if (amountVND === null || amountVND === undefined) {
    return "Liên hệ";
  }

  if (!Number.isFinite(amountVND) || amountVND < 0 || !Number.isInteger(amountVND)) {
    throw new Error(`Invalid amount to format: must be a non-negative integer, got ${amountVND}`);
  }

  // Format with thousand separator dot
  const formattedNumber = amountVND.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${formattedNumber}đ`;
}

/**
 * Validates whether an amount is a valid non-negative safe integer VND.
 */
export function isValidVND(amount: unknown): amount is MoneyVND {
  return (
    typeof amount === "number" &&
    Number.isSafeInteger(amount) &&
    amount >= 0
  );
}

