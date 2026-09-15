-- Aggregate prospect funnel metrics by ISO week, server-side.
-- Avoids the PostgREST 1000-row default limit.
CREATE OR REPLACE FUNCTION get_prospect_scorecard()
RETURNS TABLE(
  iso_week   text,
  shortlisted bigint,
  enriched    bigint,
  enviados    bigint,
  reuniones   bigint
) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    to_char(date_trunc('week', created_at AT TIME ZONE 'UTC'), 'IYYY"-W"IW') AS iso_week,
    COUNT(*) FILTER (WHERE shortlisted = true)                               AS shortlisted,
    COUNT(*) FILTER (WHERE email IS NOT NULL AND email <> '')                AS enriched,
    COUNT(*) FILTER (WHERE shortlist_status = 'Enviado')                    AS enviados,
    COUNT(*) FILTER (WHERE shortlist_status = 'Reunión Agendada')           AS reuniones
  FROM prospects
  GROUP BY 1
  ORDER BY 1 DESC;
$$;
