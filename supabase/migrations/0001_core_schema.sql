-- 0001_core_schema.sql
-- LEFT HAND Learning Ecosystem - Core Catalog & Learning Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enum Types
DO $$ BEGIN
    CREATE TYPE category_enum AS ENUM (
        'Kế toán',
        'Kinh tế',
        'Thống kê',
        'Marketing',
        'Quản trị',
        'Tài chính',
        'MIS',
        'Luật',
        'Ngoại ngữ'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE color_theme_enum AS ENUM (
        'accounting',
        'economics',
        'statistics',
        'marketing',
        'management',
        'finance',
        'law',
        'mis',
        'languages'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE product_kind_enum AS ENUM (
        'material',
        'course',
        'tutor'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE delivery_kind_enum AS ENUM (
        'digital_download',
        'live_session',
        'recorded_video',
        'one_on_one_tutoring'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE publication_status_enum AS ENUM (
        'draft',
        'published',
        'archived'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enrollment_status_enum AS ENUM (
        'open',
        'coming-soon',
        'full'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE course_format_enum AS ENUM (
        'online',
        'offline',
        'video',
        'zoom'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 1. Profiles Table (Anchored to Supabase Auth auth.users)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE,
    phone TEXT,
    faculty TEXT,
    major TEXT,
    student_code TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Subjects Table
CREATE TABLE IF NOT EXISTS subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL UNIQUE,
    category category_enum NOT NULL,
    faculty_group TEXT NOT NULL,
    color_theme color_theme_enum NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT chk_subject_slug_kebab CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

-- 3. Products Table (Base catalog entity)
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL,
    kind product_kind_enum NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
    category category_enum NOT NULL,
    delivery_kind delivery_kind_enum NOT NULL,
    publication_status publication_status_enum NOT NULL DEFAULT 'published',
    price_vnd INTEGER CHECK (price_vnd IS NULL OR price_vnd >= 0),
    old_price_vnd INTEGER CHECK (old_price_vnd IS NULL OR old_price_vnd >= 0),
    is_contact_for_price BOOLEAN NOT NULL DEFAULT false,
    rating NUMERIC(3, 2) NOT NULL DEFAULT 5.00 CHECK (rating >= 1.00 AND rating <= 5.00),
    is_hot BOOLEAN NOT NULL DEFAULT false,
    color_theme color_theme_enum NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_product_kind_slug UNIQUE (kind, slug),
    CONSTRAINT chk_product_slug_kebab CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
    CONSTRAINT chk_pricing_consistency CHECK (
        (is_contact_for_price = true AND price_vnd IS NULL) OR
        (is_contact_for_price = false AND price_vnd IS NOT NULL)
    )
);

-- 4. Materials Table (1-to-1 extension of products where kind = 'material')
CREATE TABLE IF NOT EXISTS materials (
    product_id UUID PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
    pages INTEGER NOT NULL CHECK (pages > 0),
    tags TEXT[] NOT NULL DEFAULT '{}',
    includes TEXT[] NOT NULL DEFAULT '{}',
    suitable_for TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. Courses Table (1-to-1 extension of products where kind = 'course')
CREATE TABLE IF NOT EXISTS courses (
    product_id UUID PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
    format course_format_enum NOT NULL,
    sessions INTEGER NOT NULL CHECK (sessions > 0),
    duration TEXT NOT NULL,
    schedule TEXT NOT NULL,
    enrollment_status enrollment_status_enum NOT NULL DEFAULT 'open',
    mentor TEXT NOT NULL,
    tags TEXT[] NOT NULL DEFAULT '{}',
    curriculum TEXT[] NOT NULL DEFAULT '{}',
    suitable_for TEXT[] NOT NULL DEFAULT '{}',
    preparation TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. Course Lessons Table (Granular syllabus & study items)
CREATE TABLE IF NOT EXISTS course_lessons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES courses(product_id) ON DELETE CASCADE,
    order_index INTEGER NOT NULL CHECK (order_index >= 1),
    title TEXT NOT NULL,
    description TEXT,
    duration_minutes INTEGER CHECK (duration_minutes IS NULL OR duration_minutes > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_course_lesson_order UNIQUE (course_id, order_index)
);

-- 7. Tutors Table (1-to-1 extension of products where kind = 'tutor')
CREATE TABLE IF NOT EXISTS tutors (
    product_id UUID PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    faculty TEXT NOT NULL,
    format TEXT NOT NULL,
    availability TEXT NOT NULL,
    short_bio TEXT NOT NULL,
    strengths TEXT[] NOT NULL DEFAULT '{}',
    tags TEXT[] NOT NULL DEFAULT '{}',
    suitable_for TEXT[] NOT NULL DEFAULT '{}',
    support_methods TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 8. Tutor Subjects Table (M-to-N join between tutors and subjects taught)
CREATE TABLE IF NOT EXISTS tutor_subjects (
    tutor_product_id UUID NOT NULL REFERENCES tutors(product_id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    PRIMARY KEY (tutor_product_id, subject_id)
);

-- Performance & Lookup Indexes
CREATE INDEX IF NOT EXISTS idx_subjects_category ON subjects(category);
CREATE INDEX IF NOT EXISTS idx_subjects_slug ON subjects(slug);

CREATE INDEX IF NOT EXISTS idx_products_kind ON products(kind);
CREATE INDEX IF NOT EXISTS idx_products_subject_id ON products(subject_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_publication_status ON products(publication_status);
CREATE INDEX IF NOT EXISTS idx_products_rating ON products(rating DESC);
CREATE INDEX IF NOT EXISTS idx_products_price_vnd ON products(price_vnd);

CREATE INDEX IF NOT EXISTS idx_courses_enrollment_status ON courses(enrollment_status);
CREATE INDEX IF NOT EXISTS idx_courses_format ON courses(format);

CREATE INDEX IF NOT EXISTS idx_course_lessons_course_id ON course_lessons(course_id);

CREATE INDEX IF NOT EXISTS idx_tutor_subjects_subject_id ON tutor_subjects(subject_id);

-- Enable Row Level Security (RLS) on all application tables
-- Note: Explicit read/write security policies will be added during auth/catalog integration
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE tutors ENABLE ROW LEVEL SECURITY;
ALTER TABLE tutor_subjects ENABLE ROW LEVEL SECURITY;

