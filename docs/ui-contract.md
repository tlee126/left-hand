# UI Contract & Design System — LEFT HAND

This document serves as the single source of truth for UI patterns, layout contracts, component behaviors, responsive rules, and UX state handling across the LEFT HAND Next.js application.

---

## 1. Page Shells and Containers

- **Name:** `SectionShell` & `ContainerShell` / `CatalogPageShell`
- **File Locations:**
  - `app/globals.css` (classes: `.container-shell`, `.section-shell`)
  - `components/catalog/catalog-page-shell.tsx`
- **Purpose:** Provide responsive max-width wrappers, paper grid backgrounds with ambient gradient lighting fields, and unified page boundaries.
- **Usage Rules:**
  - Standard landing sections must use `<div className="section-shell px-5 py-8 sm:px-8 sm:py-10 lg:px-10">` inside `<div className="container-shell">`.
  - Max container width is bounded at `min(97vw, 1640px)`.
  - Root background uses paper styling: `bg-[#f7f1e6]` with a 26px grid pattern and top ambient color glows (blue `#1765e9`, pink `#e957ff`, warm yellow `#f8b31d`).
- **Known Missing State:** Dedicated standard layout wrapper for student portal workspaces (currently handled via individual page layouts).

---

## 2. Header and Footer

- **Name:** `Header` & `Footer`
- **File Locations:**
  - `components/site/header.tsx`
  - `components/site/footer.tsx`
- **Purpose:** Floating sticky navigation bar with active section tracking, dynamic auth injection, mobile drawer, and standardized 4-column footer.
- **Usage Rules:**
  - Fixed header is paired with a top spacer `<div className="h-[98px] sm:h-[108px]" aria-hidden="true" />` to avoid content overlap.
  - Active section state is observed via `IntersectionObserver` with `rootMargin: "-25% 0px -55% 0px"` for anchor links (`#services`, `#resources`, `#contact`, `#ecosystem`).
  - When logged in, header displays student avatar initials and a direct link to the `/ca-nhan` dashboard.
- **Known Missing State:** Session expiration / token refresh indicators (authentication is currently handled client-side/mock).

---

## 3. Section Headings

- **Name:** `SectionHeading`
- **File Location:** `components/site/section-heading.tsx`
- **Purpose:** Typography lockup for section headers with gradient text highlights and lead descriptions.
- **Usage Rules:**
  - Supports `align="center"` (default) or `align="left"`.
  - Gradient highlights must use `bg-[linear-gradient(100deg,#1f6fff_0%,#7b3ff2_52%,#e957ff_100%)] bg-clip-text text-transparent`.
  - Main titles use responsive fluid sizing `text-[clamp(40px,3vw,56px)]` on desktop with tight letter spacing (`tracking-[-0.02em]`).
- **Known Missing State:** Dedicated kicker badge slot (presently coded inline where needed).

---

## 4. Cards and Catalog Cards

- **Name:** `MaterialCard`, `CourseCard`, `TutorCard`, `NotebookCard`, `SubjectFolderCard`
- **File Locations:**
  - `components/catalog/material-card.tsx`
  - `components/catalog/course-card.tsx`
  - `components/catalog/tutor-card.tsx`
  - `components/site/about-section.tsx`
  - `components/student/subject-folder-card.tsx`
- **Purpose:** Present items with subject color theming, price chips, rating badges, notebook folds, and action CTAs.
- **Usage Rules:**
  - Subject themes must be bound to `coverThemes` in `components/catalog/theme.ts` (accounting, economics, statistics, marketing, management, finance, law, mis, languages).
  - Hover states must apply elevation via `hover:-translate-y-1 hover:shadow-[0_20px_42px_rgba(19,37,79,0.14)]` or `.hover-lift`.
- **Known Missing State:** Skeleton loading card placeholders during data fetching or filter transitions.

---

## 5. Buttons and CTAs

- **Name:** `PrimaryButton`, `SecondaryButton`, `FloatingActions`
- **File Locations:**
  - `app/globals.css` (classes: `.primary-button`, `.secondary-button`)
  - `components/site/floating-actions.tsx`
- **Purpose:** Guide user conversion, consultation submissions, and quick navigation.
- **Usage Rules:**
  - **Primary CTA:** Uses brand gradient `linear-gradient(100deg, #2563eb 0%, #7c3aed 50%, #c026d3 100%)`, full pill radius (`rounded-full`), and blue shadow (`shadow-[0_12px_28px_rgba(37,99,235,0.25)]`).
  - **Secondary CTA:** Solid deep ink `#13245d` or subtle border with `hover:border-accent`.
  - All interactive buttons must support `active:scale-[0.98]` and `focus-visible:ring-2`.
- **Known Missing State:** Unified asynchronous spinner state across all catalog action buttons.

---

## 6. Filters and Tabs

- **Name:** Catalog Filter Bar & Student Tab Nav
- **File Locations:**
  - `app/tai-lieu/page.tsx`
  - `app/khoa-hoc/page.tsx`
  - `app/tutor/page.tsx`
  - `app/ca-nhan/mon/[slug]/workspace-client.tsx`
- **Purpose:** Instant subject category filtering, keyword searching, sorting selectors, and workspace tab switches.
- **Usage Rules:**
  - Active filter chip must use high-contrast styling: `bg-[#13245d] text-white` or `bg-[#f5edd6] text-accent border border-ink/5`.
  - Search fields must pair with instant clear buttons when input has content.
- **Known Missing State:** Filter count badge counter when multiple combined filters are active.

---

## 7. Motion & Reveal Patterns

- **Name:** `MotionReveal`
- **File Location:** `components/site/motion-reveal.tsx`
- **Purpose:** Standardized viewport-triggered entrance animation powered by Framer Motion.
- **Usage Rules:**
  - Must strictly honor `useReducedMotion()` (render immediate `opacity: 1, y: 0` when motion reduction is requested).
  - Default easing curve: `ease: [0.22, 1, 0.36, 1]` with `viewport={{ once: true, amount: 0.25 }}`.
- **Known Missing State:** Page/route transition animation between catalog index and detail views.

---

## 8. UX States: Loading, Empty, Error, Success, Disabled, and Unauthorized

- **Name:** `EmptyState`, Consultation Status Feedback, Auth Protection
- **File Locations:**
  - `components/catalog/empty-state.tsx`
  - `components/site/consultation-form.tsx`
  - `hooks/use-demo-auth.ts`
  - `app/dang-nhap/page.tsx`
- **Purpose:** Provide immediate, clear feedback across all async flows, validation checks, and route protection.
- **Usage Rules:**
  - **Loading:** Submitting state must disable inputs/buttons and display `<LoaderCircle className="animate-spin" />` with descriptive text (e.g., *"Đang gửi nhu cầu..."*).
  - **Empty:** Filter/search results returning 0 items must render `EmptyState` with a clear message and an `onReset` button.
  - **Error / Validation:** Form errors highlight affected fields with `aria-invalid="true"` and surface polite inline feedback.
  - **Success:** Form submissions trigger a polite confirmation message (*"Đã nhận nhu cầu của bạn. LEFT HAND sẽ liên hệ lại với gợi ý phù hợp."*) and reset input fields.
  - **Unauthorized:** Direct navigation to protected areas (`/ca-nhan`) without auth renders the login portal (`/dang-nhap`) with guided demo credentials.
- **Known Missing State:** Global floating toast notification system for non-inline user feedback.

---

## 9. Responsive Breakpoints and Spacing

- **File Locations:** `app/globals.css`, `tailwind.config.ts`
- **Breakpoint Rules:**
  - **Mobile:** `< 640px` (single column layout, mobile drawer navigation).
  - **Tablet:** `640px - 1023px` (2-column grids for cards and features).
  - **Desktop:** `>= 1024px` (3-column catalog grids, full horizontal navbar).
- **Spacing Guidelines:**
  - **Section padding:** `px-4 sm:px-6 lg:px-8` (catalog views) / `px-5 sm:px-8 lg:px-10` (landing card shells).
  - **Section vertical rhythm:** `py-8 sm:py-10 lg:py-16`.

---

## 10. Vietnamese Copy and Tone Rules

- **Brand Voice:** Friendly, peer-to-peer student companion (*"Ôn thi đi thoi - Học tới gần điểm tối đa"*, *"đồng hành"*, *"gỡ kẹt kiến thức"*).
- **Standardized Copy Tokens:**
  - **Search Empty:** *"Chưa tìm thấy kết quả phù hợp. Thử đổi từ khóa tìm kiếm hoặc bỏ các bộ lọc hiện tại xem sao nhé."*
  - **Form Error:** *"Vui lòng kiểm tra lại các trường bắt buộc."* / *"Số điện thoại chưa hợp lệ."*
  - **Form Success:** *"Đã nhận nhu cầu của bạn. LEFT HAND sẽ liên hệ lại với gợi ý phù hợp."*
  - **Auth / Dashboard:** *"Chào mừng trở lại, [Tên] — Hôm nay mình học gì để tiến gần hơn mục tiêu GPA [X]?"*

---

## Rules for Future Work

1. **Reuse Existing Patterns First:** Always look for and use existing components (`SectionHeading`, `MotionReveal`, `MaterialCard`, `EmptyState`, `CatalogPageShell`) before introducing new primitives.
2. **Preserve Design Tokens:** Do not alter core CSS color variables, spacing constants, or typography presets in `app/globals.css` without cross-repo alignment.
3. **Handle All UX States:** Every asynchronous flow or dynamic data view must explicitly define **Loading**, **Success**, **Error**, **Empty**, **Disabled**, and **Unauthorized** states.
4. **No Mock Links in Production:** Do not use placeholder hash links (`#`) or dummy success alerts in production-ready features. Connect real routes, handlers, and validated logic.

