-- Student-owned learning progress for entitled workspace items.

CREATE TABLE public.learning_progress (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  item_type text NOT NULL,
  item_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'not_started',
  watched_percent numeric(5, 2) NOT NULL DEFAULT 0,
  started_at timestamptz NULL,
  completed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT learning_progress_item_type_check CHECK (item_type IN ('material', 'lesson')),
  CONSTRAINT learning_progress_status_check CHECK (status IN ('not_started', 'in_progress', 'completed')),
  CONSTRAINT learning_progress_watched_percent_check CHECK (watched_percent >= 0 AND watched_percent <= 100),
  CONSTRAINT learning_progress_user_product_item_unique UNIQUE (user_id, product_id, item_type, item_id)
);

CREATE INDEX idx_learning_progress_user_product_updated_at
  ON public.learning_progress (user_id, product_id, updated_at DESC);

CREATE INDEX idx_learning_progress_product_user
  ON public.learning_progress (product_id, user_id);

ALTER TABLE public.learning_progress ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.learning_progress FROM anon, public, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.learning_progress TO authenticated;

DROP TRIGGER IF EXISTS trg_learning_progress_updated_at ON public.learning_progress;
CREATE TRIGGER trg_learning_progress_updated_at
  BEFORE UPDATE ON public.learning_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE POLICY learning_progress_select_own
ON public.learning_progress
FOR SELECT
TO authenticated
USING (public.learning_progress.user_id = auth.uid());

CREATE POLICY learning_progress_insert_own
ON public.learning_progress
FOR INSERT
TO authenticated
WITH CHECK (public.learning_progress.user_id = auth.uid());

CREATE POLICY learning_progress_update_own
ON public.learning_progress
FOR UPDATE
TO authenticated
USING (public.learning_progress.user_id = auth.uid())
WITH CHECK (public.learning_progress.user_id = auth.uid());
