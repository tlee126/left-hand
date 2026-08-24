# Canonical Learning Domain Model — LEFT HAND

This document outlines the core learning domain model for LEFT HAND, establishing strongly-typed entities, category taxonomies, delivery kinds, publication statuses, integer VND pricing, and slug normalization helpers.

---

## 1. Domain Entities & Taxonomies

### Categories (`Category`)
Derived from existing catalog and website categories:
- `Kế toán` (Accounting)
- `Kinh tế` (Economics)
- `Thống kê` (Statistics & Quantitative)
- `Marketing`
- `Quản trị` (Management)
- `Tài chính` (Finance & Banking)
- `MIS` (Management Information Systems)
- `Luật` (Law)
- `Ngoại ngữ` (Business English & Languages)

### Product Kinds (`ProductKind`)
- `material` — Curated study guides, formula sheets, PDF practice exams (`TÀI LIỆU`)
- `course` — Interactive review classes, exam workshops, structured courses (`KHÓA HỌC / LỚP ÔN`)
- `tutor` — 1-on-1 and small group peer tutoring with qualified seniors (`PEER TUTOR`)

### Delivery Kinds (`DeliveryKind`)
- `digital_download` — Instant downloadable materials (PDF, slide decks, exercise solutions)
- `live_session` — Scheduled live online workshops / classroom review sessions
- `recorded_video` — Self-paced video lectures and recorded walkthroughs
- `one_on_one_tutoring` — Personalized mentoring and tutoring meetings

### Publication Statuses (`PublicationStatus`)
- `draft` — In-progress draft not visible to public
- `published` — Active and bookable/downloadable
- `archived` — Historical resource retired from current catalog
- `coming_soon` — Announced upcoming course or material
- `full` — Class or tutor capacity reached

---

## 2. Subject Model

```typescript
export interface Subject {
  readonly id: string;
  readonly code?: string;
  readonly slug: string;
  readonly name: string;
  readonly category: Category;
  readonly facultyGroup: string;
  readonly colorTheme: ColorTheme;
}
```

Canonical subjects include:
- `Kế toán tài chính 1` (`ke-toan-tai-chinh-1`)
- `Nguyên lý kế toán` (`nguyen-ly-ke-toan`)
- `Kế toán quản trị` (`ke-toan-quan-tri`)
- `Kinh tế vi mô` (`kinh-te-vi-mo`)
- `Xác suất thống kê` (`xac-suat-thong-ke`)
- `Marketing căn bản` (`marketing-can-ban`)
- `Quản trị học` (`quan-tri-hoc`)
- `Tài chính doanh nghiệp` (`tai-chinh-doanh-nghiep`)
- `Hệ thống thông tin quản lý` (`he-thong-thong-tin-quan-ly`)
- `Luật kinh tế` (`luat-kinh-te`)
- *(and full UFM subject catalog mapped in `lib/domain/subjects.ts`)*

---

## 3. Pricing Representation (Integer VND)

### Principle
- Pricing is strictly modeled as **non-negative safe integers in VND minor units** (e.g. `29000`, `199000`).
- VND does not utilize decimal subunits/cents. Modeling amounts as integer values avoids floating-point rounding errors and database precision mismatches.
- Flexible pricing (e.g., custom tutor rates or "Liên hệ") is represented as `null` amount with `isContactForPrice: true`.

```typescript
export type MoneyVND = number;

export interface ProductPricing {
  readonly amountVND: MoneyVND;
  readonly originalAmountVND?: MoneyVND;
  readonly isContactForPrice?: boolean;
}
```

### Price Conversion Helpers
- `parseVND("29.000đ")` $\rightarrow$ `29000`
- `parseVND("Liên hệ")` $\rightarrow$ `null`
- `formatVND(29000)` $\rightarrow$ `"29.000đ"`
- `formatVND(null)` $\rightarrow$ `"Liên hệ"`
- `isValidVND(amount)` $\rightarrow$ checks whether `amount` is a non-negative safe integer.

---

## 4. Slug Normalization & Validation

- `normalizeSlug("Kế toán tài chính 1")` $\rightarrow$ `"ke-toan-tai-chinh-1"`
  - Automatically strips Vietnamese diacritics (`đ` $\rightarrow$ `d`, tone marks), lowercases, and converts spaces/special characters to hyphens.
- `isValidSlug("ke-toan-tai-chinh-1")` $\rightarrow$ `true` (enforces lowercase alphanumeric kebab-case).

---

## 5. Architectural Non-Breaking Integration

- Current UI views and mock datasets (`data/catalog.ts`, `data/site.ts`) remain unchanged and fully functional.
- The new domain definitions in `lib/domain/` establish the contract for future database schemas, server actions, and API endpoints without introducing breaking changes to existing components.

