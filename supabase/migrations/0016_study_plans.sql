-- Student-owned daily study plans and study diary entries.

CREATE TABLE public.study_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_date date NOT NULL,
  title text NOT NULL,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
  duration_minutes integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  completed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT study_plans_task_date_check CHECK (task_date >= DATE '2000-01-01' AND task_date <= DATE '2100-12-31'),
  CONSTRAINT study_plans_title_check CHECK (title = btrim(title) AND char_length(title) BETWEEN 1 AND 200),
  CONSTRAINT study_plans_duration_minutes_check CHECK (duration_minutes BETWEEN 1 AND 1440),
  CONSTRAINT study_plans_status_check CHECK (status IN ('pending', 'in_progress', 'completed')),
  CONSTRAINT study_plans_completed_at_check CHECK (
    (status = 'completed' AND completed_at IS NOT NULL)
    OR (status <> 'completed' AND completed_at IS NULL)
  )
);

CREATE INDEX idx_study_plans_user_task_date
  ON public.study_plans (user_id, task_date, created_at, id);

CREATE INDEX idx_study_plans_status_date
  ON public.study_plans (status, task_date, user_id);

ALTER TABLE public.study_plans ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.study_plans FROM anon, public, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.study_plans TO authenticated;

DROP TRIGGER IF EXISTS trg_study_plans_updated_at ON public.study_plans;
CREATE TRIGGER trg_study_plans_updated_at
  BEFORE UPDATE ON public.study_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE POLICY study_plans_select_own
ON public.study_plans
FOR SELECT
TO authenticated
USING (public.study_plans.user_id = auth.uid());

CREATE POLICY study_plans_insert_own
ON public.study_plans
FOR INSERT
TO authenticated
WITH CHECK (public.study_plans.user_id = auth.uid());

CREATE POLICY study_plans_update_own
ON public.study_plans
FOR UPDATE
TO authenticated
USING (public.study_plans.user_id = auth.uid())
WITH CHECK (public.study_plans.user_id = auth.uid());

CREATE POLICY study_plans_delete_own
ON public.study_plans
FOR DELETE
TO authenticated
USING (public.study_plans.user_id = auth.uid());
