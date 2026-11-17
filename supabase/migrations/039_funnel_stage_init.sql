-- Initialize funnel_stage for existing prospects based on shortlist_status / sent_at
-- Only advances stage, never regresses (funnel_stage stays at 'prospectado' by default)

-- Contactado: prospect was sent (has sent_at or shortlist_status = 'Enviado')
UPDATE prospects
  SET funnel_stage = 'contactado'
  WHERE funnel_stage = 'prospectado'
    AND (sent_at IS NOT NULL OR shortlist_status = 'Enviado');

-- Interesado: had a non-SQL meeting (responded but didn't book yet)
UPDATE prospects
  SET funnel_stage = 'interesado'
  WHERE funnel_stage IN ('prospectado', 'contactado')
    AND shortlist_status = 'Reunión No SQL';

-- Agendado: meeting booked
UPDATE prospects
  SET funnel_stage = 'agendado'
  WHERE funnel_stage IN ('prospectado', 'contactado', 'interesado')
    AND shortlist_status = 'Reunión Agendada';
