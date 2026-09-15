CREATE OR REPLACE FUNCTION public.delete_expired_exam_notifications()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count integer;
BEGIN
    DELETE FROM public.exam_notifications
    WHERE application_last_date IS NOT NULL
      AND CAST(application_last_date AS date) < CURRENT_DATE;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION public.delete_expired_exam_notifications() IS
'Delete notifications whose verified application deadline has passed. This keeps future exam dates active until the deadline is reached.';
