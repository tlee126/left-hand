-- Phase 4 workflow hotfix.
--
-- Migrations 0008 and 0009 installed legacy BEFORE UPDATE triggers for
-- consultations.updated_at and consultations.updated_by. Migration 0024
-- owns those fields for the workflow so it can make same-state retries true
-- no-ops and bind real transitions to auth.uid(). PostgreSQL runs same-timing
-- triggers alphabetically; removing the legacy triggers prevents them from
-- overwriting the 0024 workflow decision after it has run.
DROP TRIGGER IF EXISTS trg_consultations_updated_at ON public.consultations;
DROP TRIGGER IF EXISTS trg_consultations_updated_by ON public.consultations;
