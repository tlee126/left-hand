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

/**
 * Publication lifecycle status of a product in the system
 */
export const PUBLICATION_STATUSES = [
  "draft",
  "published",
  "archived"
] as const;
export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number];

/**
 * Capacity / enrollment availability status (specifically used for courses and tutoring slots)
 * Maps to data/catalog.ts course status: "open", "coming-soon", "full"
 */
export const ENROLLMENT_STATUSES = [
  "open",
  "coming-soon",
  "full"
] as const;
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];

/**
 * Currency amount in integer VND (Vietnamese Dong).
 * Always non-negative integer representing the exact monetary amount (VND has no fractional cents).
 */
export type MoneyVND = number;

export interface ProductPricing {
  /**
   * Exact price in VND. Null when the item requires contacting LEFT HAND for price/availability.
   */
  readonly amountVND: MoneyVND | null;
  readonly originalAmountVND?: MoneyVND | null;
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
  readonly publicationStatus: PublicationStatus;
  readonly enrollmentStatus?: EnrollmentStatus;
  readonly pricing: ProductPricing;
  readonly rating: number;
  readonly isHot?: boolean;
  readonly colorTheme: ColorTheme;
}

/**
 * Parses a string representation or number into a valid non-negative integer VND amount.
 *
 * Contract:
 * - Empty string, null, undefined, "liên hệ", "lien he", "contact" -> returns null.
 * - Valid numeric string / number -> returns non-negative safe integer VND.
 * - Negative values, fractional/decimal amounts, NaN, Infinity, values > Number.MAX_SAFE_INTEGER,
 *   or invalid malformed characters -> throws Error.
 */
export function parseVND(input: string | number | null | undefined): MoneyVND | null {
  if (input === null || input === undefined) {
    return null;
  }

  if (typeof input === "number") {
    if (!Number.isFinite(input) || isNaN(input)) {
      throw new Error(`Invalid VND amount: numeric value is not finite: ${input}`);
    }
    if (input < 0) {
      throw new Error(`Invalid VND amount: cannot be negative, got ${input}`);
    }
    if (!Number.isInteger(input)) {
      throw new Error(`Invalid VND amount: VND does not have decimal cents, got ${input}`);
    }
    if (!Number.isSafeInteger(input)) {
      throw new Error(`Invalid VND amount: exceeds safe integer limit: ${input}`);
    }
    return input;
  }

  if (typeof input !== "string") {
    throw new Error(`Invalid VND amount: expected string or number, got ${typeof input}`);
  }

  const trimmed = input.trim();
  if (trimmed === "") {
    return null;
  }

  // Check for contact for price strings (accented or unaccented)
  const normalizedForCheck = trimmed
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (normalizedForCheck === "lien he" || normalizedForCheck === "contact") {
    return null;
  }

  // Reject decimals/floating point notations like "29.5đ", "29,5"
  if (/[.,]\d{1,2}(?:đ|₫)?$/i.test(trimmed) && !/[.,]\d{3}/.test(trimmed)) {
    throw new Error(`Invalid VND amount: decimals are not allowed in VND: "${input}"`);
  }

  // Remove currency symbol, whitespace, dots and commas used as thousand separators
  const sanitized = trimmed
    .replace(/[₫đĐ]/g, "")
    .replace(/\s+/g, "")
    .replace(/[.,]/g, "");

  if (!/^\d+$/.test(sanitized)) {
    throw new Error(`Cannot parse VND amount from string: "${input}"`);
  }

  const parsed = Number(sanitized);
  if (!Number.isFinite(parsed) || !Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`Parsed VND amount is out of bounds or negative: ${sanitized}`);
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

  if (
    typeof amountVND !== "number" ||
    !Number.isFinite(amountVND) ||
    isNaN(amountVND) ||
    amountVND < 0 ||
    !Number.isInteger(amountVND) ||
    !Number.isSafeInteger(amountVND)
  ) {
    throw new Error(`Invalid amount to format: must be a non-negative safe integer, got ${amountVND}`);
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

