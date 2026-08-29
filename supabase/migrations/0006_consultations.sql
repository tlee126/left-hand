-- Phase 4.1-A: Consultation Lead Database Schema
-- Migration: 0006_consultations.sql

CREATE TABLE IF NOT EXISTS consultations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  request_id TEXT NOT NULL UNIQUE,

  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  faculty TEXT NOT NULL,
  interest TEXT NOT NULL,
  need TEXT NOT NULL,

  major TEXT,
  note TEXT,
  source_path TEXT,
  selected_product_slug TEXT,
  selected_subject_slug TEXT,

  status TEXT NOT NULL DEFAULT 'new',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_consultations_request_id_length
    CHECK (char_length(request_id) BETWEEN 1 AND 100),

  CONSTRAINT chk_consultations_full_name_length
    CHECK (char_length(full_name) BETWEEN 2 AND 150),

  CONSTRAINT chk_consultations_phone_length
    CHECK (char_length(phone) BETWEEN 7 AND 30),

  CONSTRAINT chk_consultations_faculty_length
    CHECK (char_length(faculty) BETWEEN 1 AND 150),

  CONSTRAINT chk_consultations_interest_length
    CHECK (char_length(interest) BETWEEN 1 AND 200),

  CONSTRAINT chk_consultations_need_length
    CHECK (char_length(need) BETWEEN 1 AND 2000),

  CONSTRAINT chk_consultations_major_length
    CHECK (major IS NULL OR char_length(major) <= 150),

  CONSTRAINT chk_consultations_note_length
    CHECK (note IS NULL OR char_length(note) <= 5000),

  CONSTRAINT chk_consultations_source_path_length
    CHECK (source_path IS NULL OR char_length(source_path) <= 500),

  CONSTRAINT chk_consultations_product_slug_length
    CHECK (
      selected_product_slug IS NULL
      OR char_length(selected_product_slug) <= 150
    ),

  CONSTRAINT chk_consultations_subject_slug_length
    CHECK (
      selected_subject_slug IS NULL
      OR char_length(selected_subject_slug) <= 150
    ),

  CONSTRAINT chk_consultations_status
    CHECK (status IN ('new', 'contacted', 'qualified', 'closed'))
);

CREATE INDEX IF NOT EXISTS idx_consultations_status_created_at
  ON consultations (status, created_at DESC);

ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;

-- Remove default table privileges.
REVOKE ALL ON TABLE consultations FROM anon, authenticated;

-- Allow schema access for RLS-controlled operations.
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Allow only explicitly approved insert columns.
-- Database-managed fields (id, status, created_at, updated_at)
-- cannot be supplied by clients and will use defaults.
GRANT INSERT (
  request_id,
  full_name,
  phone,
  faculty,
  interest,
  need,
  major,
  note,
  source_path,
  selected_product_slug,
  selected_subject_slug
) ON TABLE consultations TO anon, authenticated;

CREATE POLICY "consultations_allow_insert_anon_authenticated"
ON consultations
FOR INSERT
TO anon, authenticated
WITH CHECK (true);