-- =========================================================
-- SmartDoc AI — Administration System Supabase Setup SQL (SAFE RE-RUNNABLE VERSION)
-- =========================================================

-- 1. ADD ROLE COLUMN TO USER_PROFILES
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS role text DEFAULT 'user';

CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles(role);


-- 2. CREATE FEEDBACK TABLE
CREATE TABLE IF NOT EXISTS public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name text,
  user_email text,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  experience text,
  feedback_type text NOT NULL,
  related_exams text[] DEFAULT '{}',
  other_exam text,
  description text NOT NULL,
  screenshot_url text,
  status text NOT NULL DEFAULT 'new',
  admin_note text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_status ON public.feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON public.feedback(created_at DESC);


-- 3. HELPER FUNCTION: CHECK IF USER IS ADMIN
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;


-- 4. ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_qualifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_recommendations ENABLE ROW LEVEL SECURITY;


-- 5. RLS POLICIES FOR USER_PROFILES
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
CREATE POLICY "Users can view own profile" ON public.user_profiles
  FOR SELECT USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
CREATE POLICY "Users can update own profile" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
CREATE POLICY "Users can insert own profile" ON public.user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id OR public.is_admin());


-- 6. RLS POLICIES FOR FEEDBACK
DROP POLICY IF EXISTS "Users can submit feedback" ON public.feedback;
CREATE POLICY "Users can submit feedback" ON public.feedback
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can view own feedback" ON public.feedback;
CREATE POLICY "Users can view own feedback" ON public.feedback
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Admins can update feedback" ON public.feedback;
CREATE POLICY "Admins can update feedback" ON public.feedback
  FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete feedback" ON public.feedback;
CREATE POLICY "Admins can delete feedback" ON public.feedback
  FOR DELETE USING (public.is_admin());


-- 7. RLS POLICIES FOR EXAM NOTIFICATIONS
DROP POLICY IF EXISTS "Anyone can view active notifications" ON public.exam_notifications;
CREATE POLICY "Anyone can view active notifications" ON public.exam_notifications
  FOR SELECT USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS "Admins can insert notifications" ON public.exam_notifications;
CREATE POLICY "Admins can insert notifications" ON public.exam_notifications
  FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update notifications" ON public.exam_notifications;
CREATE POLICY "Admins can update notifications" ON public.exam_notifications
  FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete notifications" ON public.exam_notifications;
CREATE POLICY "Admins can delete notifications" ON public.exam_notifications
  FOR DELETE USING (public.is_admin());


-- 8. RLS POLICIES FOR EXAM RECOMMENDATIONS
DROP POLICY IF EXISTS "Anyone can view active recommendations" ON public.exam_recommendations;
CREATE POLICY "Anyone can view active recommendations" ON public.exam_recommendations
  FOR SELECT USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS "Admins can insert recommendations" ON public.exam_recommendations;
CREATE POLICY "Admins can insert recommendations" ON public.exam_recommendations
  FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update recommendations" ON public.exam_recommendations;
CREATE POLICY "Admins can update recommendations" ON public.exam_recommendations
  FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete recommendations" ON public.exam_recommendations;
CREATE POLICY "Admins can delete recommendations" ON public.exam_recommendations
  FOR DELETE USING (public.is_admin());
