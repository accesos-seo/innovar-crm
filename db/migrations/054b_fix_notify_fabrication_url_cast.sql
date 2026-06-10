-- =====================================================
-- 054b — Hotfix: notify_fabrication_started rompía toda transición
--        a en_produccion (bug preexistente, destapado en QA de 054)
-- =====================================================
-- Proyecto: Innovar CRM (xdzbjptozeqcbnaqhtye)
-- Fecha: 2026-06-10
--
-- Bug doble (la función nunca funcionó desde su creación):
--   1) `(SELECT value FROM system_settings ...) || '/coordinador-produccion'`
--      concatena JSONB || texto → 22P02 ("Token '/' is invalid").
--   2) `body := jsonb_build_object(...)::TEXT` → 42883: net.http_post no
--      tiene overload con body text; espera JSONB.
-- Como el trigger es BEFORE UPDATE, el error abortaba el UPDATE completo:
-- NINGÚN proyecto podía pasar a en_produccion (ni desde Projects ni desde
-- el Kanban de planta).
-- Fix: `value #>> '{}'` para la URL + body JSONB sin castear.
-- =====================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.notify_fabrication_started()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'en_produccion' AND (OLD.status IS DISTINCT FROM 'en_produccion') THEN
    -- Marcar fecha de inicio
    NEW.fabrication_started_at := NOW();

    -- Calcular fecha estimada de entrega si no está ya fijada
    IF NEW.delivery_date IS NULL THEN
      NEW.delivery_date := (CURRENT_DATE + COALESCE(NEW.estimated_fabrication_days, 25))::DATE;
    END IF;

    -- Llamar EF coordinador-produccion (verify_jwt=false, sin auth header)
    -- URL se lee desde system_settings para no hardcodear el project ID.
    -- `#>> '{}'` extrae el string del JSONB (sin esto el || revienta).
    PERFORM net.http_post(
      url     := (SELECT value #>> '{}' FROM public.system_settings WHERE key = 'supabase_functions_base_url') || '/coordinador-produccion',
      headers := '{"Content-Type": "application/json"}'::JSONB,
      body    := jsonb_build_object(
        'project_id',   NEW.id::TEXT,
        'triggered_at', NOW()::TEXT
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

COMMIT;

-- =============================================================================
-- Verificación: en transacción con ROLLBACK, un UPDATE a en_produccion debe
-- pasar sin error 22P02 y registrar la fila en project_status_history.
-- =============================================================================

-- =============================================================================
-- ROLLBACK (restaura la versión rota — solo documentado por convención):
-- volver a CREATE OR REPLACE con `(SELECT value FROM ...)` sin `#>> '{}'`.
-- =============================================================================
