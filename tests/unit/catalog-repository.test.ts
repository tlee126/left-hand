/**
 * Unit Tests for Server-side Catalog Repository (Task 2.5)
 */

import assert from "node:assert/strict";
import { test, describe } from "node:test";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
  listPublishedProducts,
  getPublishedProductBySlug,
  listPublishedMaterials,
  getPublishedMaterialBySlug,
  listPublishedCourses,
  getPublishedCourseBySlug,
  listPublishedTutors,
  getPublishedTutorBySlug,
  mapRowToMaterialItem,
  mapRowToCourseItem,
  mapRowToTutorItem,
  type ProductRow
} from "../../lib/repositories/catalog-repository";

describe("Catalog Repository Contract & Query Intent", () => {
  test("repository file exports required functions and types", () => {
    assert.strictEqual(typeof listPublishedProducts, "function");
    assert.strictEqual(typeof getPublishedProductBySlug, "function");
    assert.strictEqual(typeof listPublishedMaterials, "function");
    assert.strictEqual(typeof getPublishedMaterialBySlug, "function");
    assert.strictEqual(typeof listPublishedCourses, "function");
    assert.strictEqual(typeof getPublishedCourseBySlug, "function");
    assert.strictEqual(typeof listPublishedTutors, "function");
    assert.strictEqual(typeof getPublishedTutorBySlug, "function");
    assert.strictEqual(typeof mapRowToMaterialItem, "function");
    assert.strictEqual(typeof mapRowToCourseItem, "function");
    assert.strictEqual(typeof mapRowToTutorItem, "function");
  });

  test("mapRowToMaterialItem correctly maps database row to MaterialItem UI shape", () => {
    const sampleJoinedRow = {
      id: "prod-123",
      slug: "ke-toan-tai-chinh-1",
      kind: "material" as const,
      title: "Tóm tắt & Bài giải Kế toán tài chính 1",
      description: "Tóm tắt lý thuyết chi tiết",
      subject_id: "subj-123",
      category: "Kế toán" as const,
      delivery_kind: "digital_download" as const,
      publication_status: "published" as const,
      price_vnd: 29000,
      old_price_vnd: 59000,
      is_contact_for_price: false,
      rating: 4.9,
      is_hot: true,
      color_theme: "accounting" as const,
      created_at: "2026-08-25T00:00:00Z",
      updated_at: "2026-08-25T00:00:00Z",
      materials: {
        product_id: "prod-123",
        pages: 48,
        tags: ["Lý thuyết", "Bài tập"],
        includes: ["48 trang PDF"],
        suitable_for: ["Sinh viên UFM"],
        created_at: "2026-08-25T00:00:00Z",
        updated_at: "2026-08-25T00:00:00Z"
      },
      subjects: {
        id: "subj-123",
        slug: "ke-toan-tai-chinh-1",
        name: "Kế toán tài chính 1",
        category: "Kế toán" as const,
        faculty_group: "Kế toán - Kiểm toán",
        color_theme: "accounting" as const,
        created_at: "2026-08-25T00:00:00Z",
        updated_at: "2026-08-25T00:00:00Z"
      }
    };

    const mapped = mapRowToMaterialItem(sampleJoinedRow);

    assert.strictEqual(mapped.id, "prod-123");
    assert.strictEqual(mapped.slug, "ke-toan-tai-chinh-1");
    assert.strictEqual(mapped.title, "Tóm tắt & Bài giải Kế toán tài chính 1");
    assert.strictEqual(mapped.subject, "Kế toán tài chính 1");
    assert.strictEqual(mapped.facultyGroup, "Kế toán - Kiểm toán");
    assert.strictEqual(mapped.category, "Kế toán");
    assert.strictEqual(mapped.type, "TÀI LIỆU");
    assert.strictEqual(mapped.description, "Tóm tắt lý thuyết chi tiết");
    assert.strictEqual(mapped.price, "29.000đ");
    assert.strictEqual(mapped.oldPrice, "59.000đ");
    assert.strictEqual(mapped.pages, 48);
    assert.deepStrictEqual(mapped.tags, ["Lý thuyết", "Bài tập"]);
    assert.strictEqual(mapped.rating, 4.9);
    assert.strictEqual(mapped.isHot, true);
    assert.strictEqual(mapped.colorTheme, "accounting");
    assert.deepStrictEqual(mapped.includes, ["48 trang PDF"]);
    assert.deepStrictEqual(mapped.suitableFor, ["Sinh viên UFM"]);
  });

  test("mapRowToMaterialItem handles contact-for-price and null values correctly", () => {
    const contactRow = {
      id: "prod-456",
      slug: "tai-lieu-dac-biet",
      kind: "material" as const,
      title: "Tài liệu đặc biệt",
      description: "Mô tả",
      subject_id: "subj-456",
      category: "Kinh tế" as const,
      delivery_kind: "digital_download" as const,
      publication_status: "published" as const,
      price_vnd: null,
      old_price_vnd: null,
      is_contact_for_price: true,
      rating: 5.0,
      is_hot: false,
      color_theme: "economics" as const,
      created_at: "2026-08-25T00:00:00Z",
      updated_at: "2026-08-25T00:00:00Z",
      materials: null,
      subjects: null
    };

    const mapped = mapRowToMaterialItem(contactRow);

    assert.strictEqual(mapped.price, "Liên hệ");
    assert.strictEqual(mapped.oldPrice, undefined);
    assert.strictEqual(mapped.pages, 0);
    assert.deepStrictEqual(mapped.tags, []);
    assert.strictEqual(mapped.subject, "Tài liệu đặc biệt");
    assert.strictEqual(mapped.facultyGroup, "UFM");
  });

  test("mapRowToCourseItem correctly maps database row to CourseItem UI shape", () => {
    const sampleJoinedRow = {
      id: "crs-123",
      slug: "lop-on-thi-cuoi-ky-marketing",
      kind: "course" as const,
      title: "Lớp ôn thi cuối kỳ Marketing căn bản UFM",
      description: "Hệ thống hóa lý thuyết cốt lõi",
      subject_id: "subj-mkt",
      category: "Marketing" as const,
      delivery_kind: "live_session" as const,
      publication_status: "published" as const,
      price_vnd: 129000,
      old_price_vnd: 250000,
      is_contact_for_price: false,
      rating: 4.9,
      is_hot: false,
      color_theme: "marketing" as const,
      created_at: "2026-08-25T00:00:00Z",
      updated_at: "2026-08-25T00:00:00Z",
      courses: {
        product_id: "crs-123",
        format: "zoom" as const,
        sessions: 4,
        duration: "8 giờ học + tài liệu ôn tập",
        schedule: "Tối Thứ 4 & Thứ 6 (19:30 - 21:30)",
        enrollment_status: "open" as const,
        mentor: "Chị Minh Thư (Cựu SV Marketing xuất sắc UFM)",
        tags: ["Cam kết qua môn", "Live Zoom tương tác"],
        curriculum: ["Buổi 1: Hệ thống lý thuyết cốt lõi"],
        suitable_for: ["Sinh viên UFM chuẩn bị thi"],
        preparation: ["Xem trước đề cương"],
        created_at: "2026-08-25T00:00:00Z",
        updated_at: "2026-08-25T00:00:00Z"
      },
      subjects: {
        id: "subj-mkt",
        slug: "marketing-can-ban",
        name: "Marketing căn bản",
        category: "Marketing" as const,
        faculty_group: "Marketing - Quản trị",
        color_theme: "marketing" as const,
        created_at: "2026-08-25T00:00:00Z",
        updated_at: "2026-08-25T00:00:00Z"
      }
    };

    const mapped = mapRowToCourseItem(sampleJoinedRow);

    assert.strictEqual(mapped.id, "crs-123");
    assert.strictEqual(mapped.slug, "lop-on-thi-cuoi-ky-marketing");
    assert.strictEqual(mapped.title, "Lớp ôn thi cuối kỳ Marketing căn bản UFM");
    assert.strictEqual(mapped.subject, "Marketing căn bản");
    assert.strictEqual(mapped.category, "Marketing");
    assert.strictEqual(mapped.format, "zoom");
    assert.strictEqual(mapped.sessions, 4);
    assert.strictEqual(mapped.duration, "8 giờ học + tài liệu ôn tập");
    assert.strictEqual(mapped.schedule, "Tối Thứ 4 & Thứ 6 (19:30 - 21:30)");
    assert.strictEqual(mapped.description, "Hệ thống hóa lý thuyết cốt lõi");
    assert.strictEqual(mapped.price, "129.000đ");
    assert.strictEqual(mapped.oldPrice, "250.000đ");
    assert.strictEqual(mapped.status, "open");
    assert.strictEqual(mapped.mentor, "Chị Minh Thư (Cựu SV Marketing xuất sắc UFM)");
    assert.deepStrictEqual(mapped.tags, ["Cam kết qua môn", "Live Zoom tương tác"]);
    assert.strictEqual(mapped.rating, 4.9);
    assert.strictEqual(mapped.colorTheme, "marketing");
    assert.deepStrictEqual(mapped.curriculum, ["Buổi 1: Hệ thống lý thuyết cốt lõi"]);
    assert.deepStrictEqual(mapped.suitableFor, ["Sinh viên UFM chuẩn bị thi"]);
    assert.deepStrictEqual(mapped.preparation, ["Xem trước đề cương"]);
  });

  test("mapRowToCourseItem handles contact-for-price and null values correctly", () => {
    const contactRow = {
      id: "crs-456",
      slug: "khoa-hoc-dac-biet",
      kind: "course" as const,
      title: "Khóa học đặc biệt",
      description: "Mô tả",
      subject_id: "subj-456",
      category: "Kinh tế" as const,
      delivery_kind: "live_session" as const,
      publication_status: "published" as const,
      price_vnd: null,
      old_price_vnd: null,
      is_contact_for_price: true,
      rating: 5.0,
      is_hot: false,
      color_theme: "economics" as const,
      created_at: "2026-08-25T00:00:00Z",
      updated_at: "2026-08-25T00:00:00Z",
      courses: null,
      subjects: null
    };

    const mapped = mapRowToCourseItem(contactRow);

    assert.strictEqual(mapped.price, "Liên hệ");
    assert.strictEqual(mapped.oldPrice, undefined);
    assert.strictEqual(mapped.sessions, 0);
    assert.strictEqual(mapped.format, "online");
    assert.strictEqual(mapped.status, "open");
    assert.strictEqual(mapped.mentor, "");
    assert.strictEqual(mapped.duration, "");
    assert.strictEqual(mapped.schedule, "");
    assert.deepStrictEqual(mapped.tags, []);
    assert.strictEqual(mapped.subject, "Khóa học đặc biệt");
  });

  test("mapRowToTutorItem correctly maps database row with multiple subjects to TutorItem UI shape", () => {
    const sampleJoinedRow = {
      id: "tut-123",
      slug: "tutor-ke-toan-tai-chinh-1",
      kind: "tutor" as const,
      title: "Tutor Kế toán tài chính 1",
      description: "Dạy kèm định khoản kế toán",
      subject_id: "subj-kttc1",
      category: "Kế toán" as const,
      delivery_kind: "one_on_one_tutoring" as const,
      publication_status: "published" as const,
      price_vnd: 120000,
      old_price_vnd: null,
      is_contact_for_price: false,
      rating: 4.9,
      is_hot: false,
      color_theme: "accounting" as const,
      created_at: "2026-08-25T00:00:00Z",
      updated_at: "2026-08-25T00:00:00Z",
      tutors: {
        product_id: "tut-123",
        name: "Tutor Minh Thư",
        faculty: "Kế toán - Kiểm toán",
        format: "1:1 & Nhóm nhỏ (Online/Offline)",
        availability: "Còn 2 slot tối Thứ 3, 5",
        short_bio: "Sinh viên năm cuối ngành Kế toán doanh nghiệp UFM. GPA môn Kế toán tài chính 1 đạt 9.2/10.",
        strengths: ["Giải thích định khoản dễ hiểu", "Kiên nhẫn hỗ trợ người mất gốc"],
        tags: ["Điểm môn 9.2", "Kinh nghiệm 1 năm"],
        suitable_for: ["Học viên bị mất gốc định khoản"],
        support_methods: ["Dạy kèm online qua Zoom"],
        created_at: "2026-08-25T00:00:00Z",
        updated_at: "2026-08-25T00:00:00Z"
      },
      subjects: {
        id: "subj-kttc1",
        slug: "ke-toan-tai-chinh-1",
        name: "Kế toán tài chính 1",
        category: "Kế toán" as const,
        faculty_group: "Kế toán - Kiểm toán",
        color_theme: "accounting" as const,
        created_at: "2026-08-25T00:00:00Z",
        updated_at: "2026-08-25T00:00:00Z"
      },
      tutor_subjects: [
        {
          is_primary: true,
          subjects: {
            id: "subj-kttc1",
            slug: "ke-toan-tai-chinh-1",
            name: "Kế toán tài chính 1",
            category: "Kế toán" as const,
            faculty_group: "Kế toán - Kiểm toán",
            color_theme: "accounting" as const,
            created_at: "2026-08-25T00:00:00Z",
            updated_at: "2026-08-25T00:00:00Z"
          }
        },
        {
          is_primary: false,
          subjects: {
            id: "subj-nlkt",
            slug: "nguyen-ly-ke-toan",
            name: "Nguyên lý kế toán",
            category: "Kế toán" as const,
            faculty_group: "Kế toán - Kiểm toán",
            color_theme: "accounting" as const,
            created_at: "2026-08-25T00:00:00Z",
            updated_at: "2026-08-25T00:00:00Z"
          }
        }
      ]
    };

    const mapped = mapRowToTutorItem(sampleJoinedRow);

    assert.strictEqual(mapped.id, "tut-123");
    assert.strictEqual(mapped.slug, "tutor-ke-toan-tai-chinh-1");
    assert.strictEqual(mapped.name, "Tutor Minh Thư");
    assert.deepStrictEqual(mapped.subjects, ["Kế toán tài chính 1", "Nguyên lý kế toán"]);
    assert.strictEqual(mapped.faculty, "Kế toán - Kiểm toán");
    assert.deepStrictEqual(mapped.strengths, ["Giải thích định khoản dễ hiểu", "Kiên nhẫn hỗ trợ người mất gốc"]);
    assert.strictEqual(mapped.format, "1:1 & Nhóm nhỏ (Online/Offline)");
    assert.strictEqual(mapped.price, "120.000đ / giờ");
    assert.strictEqual(mapped.availability, "Còn 2 slot tối Thứ 3, 5");
    assert.strictEqual(mapped.rating, 4.9);
    assert.strictEqual(mapped.shortBio, "Sinh viên năm cuối ngành Kế toán doanh nghiệp UFM. GPA môn Kế toán tài chính 1 đạt 9.2/10.");
    assert.deepStrictEqual(mapped.tags, ["Điểm môn 9.2", "Kinh nghiệm 1 năm"]);
    assert.strictEqual(mapped.colorTheme, "accounting");
    assert.deepStrictEqual(mapped.suitableFor, ["Học viên bị mất gốc định khoản"]);
    assert.deepStrictEqual(mapped.supportMethods, ["Dạy kèm online qua Zoom"]);
  });

  test("mapRowToTutorItem handles contact-for-price and null values correctly", () => {
    const contactRow = {
      id: "tut-456",
      slug: "tutor-dac-biet",
      kind: "tutor" as const,
      title: "Tutor đặc biệt",
      description: "Mô tả",
      subject_id: "subj-456",
      category: "Kinh tế" as const,
      delivery_kind: "one_on_one_tutoring" as const,
      publication_status: "published" as const,
      price_vnd: null,
      old_price_vnd: null,
      is_contact_for_price: true,
      rating: 5.0,
      is_hot: false,
      color_theme: "economics" as const,
      created_at: "2026-08-25T00:00:00Z",
      updated_at: "2026-08-25T00:00:00Z",
      tutors: null,
      subjects: {
        id: "subj-456",
        slug: "kinh-te-vi-mo",
        name: "Kinh tế vĩ mô",
        category: "Kinh tế" as const,
        faculty_group: "Khoa Kinh tế",
        color_theme: "economics" as const,
        created_at: "2026-08-25T00:00:00Z",
        updated_at: "2026-08-25T00:00:00Z"
      },
      tutor_subjects: []
    };

    const mapped = mapRowToTutorItem(contactRow);

    assert.strictEqual(mapped.price, "Liên hệ");
    assert.strictEqual(mapped.name, "Tutor đặc biệt");
    assert.deepStrictEqual(mapped.subjects, ["Kinh tế vĩ mô"]);
    assert.strictEqual(mapped.faculty, "Khoa Kinh tế");
    assert.strictEqual(mapped.format, "1:1 & Online");
    assert.strictEqual(mapped.availability, "");
    assert.deepStrictEqual(mapped.tags, []);
  });

  test("repository inspects missing environment variables and throws clear error on missing config", async () => {
    const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    try {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      await assert.rejects(
        async () => {
          await listPublishedProducts();
        },
        {
          name: "Error",
          message: /Missing Supabase environment variables/i
        }
      );

      await assert.rejects(
        async () => {
          await getPublishedProductBySlug("sample-slug");
        },
        {
          name: "Error",
          message: /Missing Supabase environment variables/i
        }
      );

      await assert.rejects(
        async () => {
          await listPublishedMaterials();
        },
        {
          name: "Error",
          message: /Missing Supabase environment variables/i
        }
      );

      await assert.rejects(
        async () => {
          await getPublishedMaterialBySlug("sample-slug");
        },
        {
          name: "Error",
          message: /Missing Supabase environment variables/i
        }
      );

      await assert.rejects(
        async () => {
          await listPublishedCourses();
        },
        {
          name: "Error",
          message: /Missing Supabase environment variables/i
        }
      );

      await assert.rejects(
        async () => {
          await getPublishedCourseBySlug("sample-slug");
        },
        {
          name: "Error",
          message: /Missing Supabase environment variables/i
        }
      );

      await assert.rejects(
        async () => {
          await listPublishedTutors();
        },
        {
          name: "Error",
          message: /Missing Supabase environment variables/i
        }
      );

      await assert.rejects(
        async () => {
          await getPublishedTutorBySlug("sample-slug");
        },
        {
          name: "Error",
          message: /Missing Supabase environment variables/i
        }
      );
    } finally {
      if (originalUrl) process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
      if (originalKey) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey;
    }
  });

  test("repository code structure conforms to query requirements", async () => {
    const repoFilePath = path.resolve(
      process.cwd(),
      "lib/repositories/catalog-repository.ts"
    );
    const code = await fs.readFile(repoFilePath, "utf-8");

    // Must query from products table
    assert.ok(code.includes('.from("products")'), "Must query the products table");

    // Must select all fields
    assert.ok(code.includes('.select("*")'), 'Must query with .select("*")');

    // Must filter publication_status = 'published'
    assert.ok(
      code.includes('.eq("publication_status", "published")'),
      "Must filter publication_status = published"
    );

    // listPublishedProducts must order by created_at descending
    assert.ok(
      code.includes('.order("created_at", { ascending: false })'),
      "Must order list query by created_at descending"
    );

    // getPublishedProductBySlug must filter by slug and use maybeSingle()
    assert.ok(
      code.includes('.eq("slug", slug)'),
      "Must filter slug for single product query"
    );
    assert.ok(
      code.includes(".maybeSingle()"),
      "Must use .maybeSingle() to return one record or null"
    );

    // Materials queries must filter kind = 'material' and join materials and subjects
    assert.ok(
      code.includes('.eq("kind", "material")'),
      "Must filter kind = material for materials repository queries"
    );
    assert.ok(
      code.includes('materials!inner(*)'),
      "Must join materials relation with materials!inner(*)"
    );

    // Courses queries must filter kind = 'course' and join courses and subjects
    assert.ok(
      code.includes('.eq("kind", "course")'),
      "Must filter kind = course for courses repository queries"
    );
    assert.ok(
      code.includes('courses!inner(*)'),
      "Must join courses relation with courses!inner(*)"
    );

    // Tutors queries must filter kind = 'tutor' and join tutors, tutor_subjects, and subjects
    assert.ok(
      code.includes('.eq("kind", "tutor")'),
      "Must filter kind = tutor for tutors repository queries"
    );
    assert.ok(
      code.includes('tutors!inner(*)'),
      "Must join tutors relation with tutors!inner(*)"
    );
    assert.ok(
      code.includes('tutor_subjects('),
      "Must join tutor_subjects relation with tutor_subjects(...)"
    );

    assert.ok(
      code.includes('subjects(*)'),
      "Must join subjects relation with subjects(*)"
    );

    // Surfaces errors with clear prefix
    assert.ok(
      code.includes("Failed to list published products:"),
      "Must include descriptive error for list failures"
    );
    assert.ok(
      code.includes("Failed to get published product by slug"),
      "Must include descriptive error for slug lookup failures"
    );
    assert.ok(
      code.includes("Failed to list published materials:"),
      "Must include descriptive error for list published materials failures"
    );
    assert.ok(
      code.includes("Failed to get published material by slug"),
      "Must include descriptive error for get published material by slug failures"
    );
    assert.ok(
      code.includes("Failed to list published courses:"),
      "Must include descriptive error for list published courses failures"
    );
    assert.ok(
      code.includes("Failed to get published course by slug"),
      "Must include descriptive error for get published course by slug failures"
    );
    assert.ok(
      code.includes("Failed to list published tutors:"),
      "Must include descriptive error for list published tutors failures"
    );
    assert.ok(
      code.includes("Failed to get published tutor by slug"),
      "Must include descriptive error for get published tutor by slug failures"
    );
  });

  test("app/tai-lieu/page.tsx is a Server Component fetching live materials and does not import static materials", async () => {
    const pagePath = path.resolve(process.cwd(), "app/tai-lieu/page.tsx");
    const pageCode = await fs.readFile(pagePath, "utf-8");

    // Must not be a client component
    assert.ok(!pageCode.includes('"use client"'), "app/tai-lieu/page.tsx must be a Server Component");

    // Must call listPublishedMaterials
    assert.ok(
      pageCode.includes("listPublishedMaterials"),
      "app/tai-lieu/page.tsx must call listPublishedMaterials from repository"
    );

    // Must not import static materials from @/data/catalog
    assert.ok(
      !/import\s*\{[^}]*\bmaterials\b[^}]*\}\s*from\s*["']@\/data\/catalog["']/.test(pageCode),
      "app/tai-lieu/page.tsx must not import static materials from @/data/catalog"
    );

    // Must render MaterialsCatalogClient
    assert.ok(
      pageCode.includes("<MaterialsCatalogClient"),
      "app/tai-lieu/page.tsx must render MaterialsCatalogClient"
    );
  });
});
