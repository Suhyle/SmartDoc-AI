-- Exam notifications are entered in Supabase by project administrators.
-- Signed-in users can read active notices; writes remain limited to trusted
-- project administrators through the Supabase dashboard for now.

ALTER TABLE public.exam_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read active exam notifications"
  ON public.exam_notifications;

CREATE POLICY "Authenticated users can read active exam notifications"
  ON public.exam_notifications
  FOR SELECT
  TO authenticated
  USING (is_active IS TRUE);

-- Prevent an administrator from entering the same exam/category/deadline twice.
CREATE UNIQUE INDEX IF NOT EXISTS exam_notifications_admin_identity_key
  ON public.exam_notifications (lower(category), lower(exam_name), application_last_date)
  WHERE source = 'admin'
    AND category IS NOT NULL
    AND exam_name IS NOT NULL
    AND application_last_date IS NOT NULL;
