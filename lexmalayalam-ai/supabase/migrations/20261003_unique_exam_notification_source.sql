-- Keep the identity used by the notification refresh upsert unique. This makes
-- repeated refreshes update the existing row instead of inserting another one.
WITH ranked_notifications AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY source, source_notification_id
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS duplicate_rank
  FROM public.exam_notifications
  WHERE source IS NOT NULL
    AND source_notification_id IS NOT NULL
)
DELETE FROM public.exam_notifications AS notification
USING ranked_notifications AS ranked
WHERE notification.id = ranked.id
  AND ranked.duplicate_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS exam_notifications_source_source_notification_id_key
  ON public.exam_notifications (source, source_notification_id);
