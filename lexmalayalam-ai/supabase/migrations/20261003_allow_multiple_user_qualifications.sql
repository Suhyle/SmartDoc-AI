-- Login replaces a user's qualification rows before inserting all of their
-- saved qualifications. A user_id-only unique constraint prevents that.
ALTER TABLE public.user_qualifications
  DROP CONSTRAINT IF EXISTS user_qualifications_user_id_unique;

-- Allow the signed-in user to replace only their own qualification rows.
DROP POLICY IF EXISTS "Users can delete own qualifications"
  ON public.user_qualifications;

CREATE POLICY "Users can delete own qualifications"
  ON public.user_qualifications
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
