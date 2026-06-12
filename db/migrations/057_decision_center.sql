-- 057: Centro de Decisiones (grill-me dentro del CRM).
--
-- El cliente responde cuestionarios de decisión directamente en el software
-- (ruta /decisiones, solo admin/super_admin). Las respuestas quedan en la DB
-- para que el equipo técnico las lea y construya los PRDs sobre ellas
-- (carta cliente 2026-06-11: ciclo de diseño y cierres contables).
--
-- Idempotente: CREATE TABLE IF NOT EXISTS + seeds con ON CONFLICT DO NOTHING.
-- ROLLBACK: DROP TABLE public.decision_questions, public.decision_questionnaires;

CREATE TABLE IF NOT EXISTS public.decision_questionnaires (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         text UNIQUE NOT NULL,
  title        text NOT NULL,
  context      text,
  status       text NOT NULL DEFAULT 'pendiente'
               CHECK (status IN ('pendiente', 'en_progreso', 'completado')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.decision_questions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  questionnaire_id uuid NOT NULL REFERENCES public.decision_questionnaires(id) ON DELETE CASCADE,
  position         int NOT NULL,
  question         text NOT NULL,
  why_matters      text,
  answer           text,
  answered_at      timestamptz,
  answered_by      uuid REFERENCES public.profiles(id),
  UNIQUE (questionnaire_id, position)
);

ALTER TABLE public.decision_questionnaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decision_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "decisiones_admin_all" ON public.decision_questionnaires;
CREATE POLICY "decisiones_admin_all" ON public.decision_questionnaires
  FOR ALL TO public
  USING (public.get_my_role() IN ('admin'::user_role, 'super_admin'::user_role))
  WITH CHECK (public.get_my_role() IN ('admin'::user_role, 'super_admin'::user_role));

DROP POLICY IF EXISTS "decision_questions_admin_all" ON public.decision_questions;
CREATE POLICY "decision_questions_admin_all" ON public.decision_questions
  FOR ALL TO public
  USING (public.get_my_role() IN ('admin'::user_role, 'super_admin'::user_role))
  WITH CHECK (public.get_my_role() IN ('admin'::user_role, 'super_admin'::user_role));

-- Estado del cuestionario derivado de sus respuestas (0 → pendiente,
-- parcial → en_progreso, todas → completado + completed_at).
CREATE OR REPLACE FUNCTION public.fn_decision_questionnaire_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_qid      uuid;
  v_total    int;
  v_answered int;
BEGIN
  v_qid := COALESCE(NEW.questionnaire_id, OLD.questionnaire_id);

  SELECT count(*),
         count(*) FILTER (WHERE answer IS NOT NULL AND btrim(answer) <> '')
  INTO v_total, v_answered
  FROM public.decision_questions
  WHERE questionnaire_id = v_qid;

  UPDATE public.decision_questionnaires
  SET status = CASE
                 WHEN v_answered = 0 THEN 'pendiente'
                 WHEN v_answered < v_total THEN 'en_progreso'
                 ELSE 'completado'
               END,
      completed_at = CASE
                       WHEN v_total > 0 AND v_answered = v_total THEN COALESCE(completed_at, now())
                       ELSE NULL
                     END
  WHERE id = v_qid;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_decision_questionnaire_status ON public.decision_questions;
CREATE TRIGGER trg_decision_questionnaire_status
  AFTER INSERT OR UPDATE OF answer OR DELETE ON public.decision_questions
  FOR EACH ROW EXECUTE FUNCTION public.fn_decision_questionnaire_status();

-- ── Seeds ─────────────────────────────────────────────────────────────────────

INSERT INTO public.decision_questionnaires (slug, title, context)
VALUES
  ('ciclo-diseno-aprobaciones',
   'Ciclo de Diseño y Aprobaciones',
   'Estas respuestas definen cómo construiremos el flujo completo: modelado 3D → su aprobación → render → su aprobación → producción, incluyendo aprobaciones desde el link del proyecto y aprobaciones delegadas por WhatsApp para clientes mayores. Responda con el detalle que usa en el día a día — no hay respuestas incorrectas.'),
  ('cierres-gastos-empresa',
   'Cierres Contables y Gastos de Empresa',
   'Estas respuestas definen cómo el cierre de cada proyecto debe tratar los gastos que no pertenecen a un proyecto específico (nómina, dietas, arriendo, bodega) y qué reporte espera ver al cerrar un proyecto.')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.decision_questions (questionnaire_id, position, question, why_matters)
SELECT q.id, v.position, v.question, v.why_matters
FROM public.decision_questionnaires q
JOIN (VALUES
  (1, '¿Cuántas rondas de cambios incluye cada etapa de diseño (modelado y render)? ¿Son ilimitadas o hay un tope antes de cobrar ajustes adicionales?',
      'Define cuándo el sistema permite devolver un diseño a "en ajustes" y si debe avisar cuando se supere el tope.'),
  (2, 'Cuando el cliente pide cambios al modelado o al render, ¿quién recibe y registra hoy esos comentarios? (el diseñador, el comercial, gerencia)',
      'Determina a quién le llega la notificación de "cambios solicitados" y quién puede editar el diseño.'),
  (3, '¿La aprobación del modelado debe hacerla el cliente final desde su link del proyecto, o también vale que un miembro del equipo la registre en su nombre después de una llamada?',
      'Define los botones del portal público y el registro interno de aprobaciones.'),
  (4, 'Para clientes mayores que delegan en un familiar: ¿qué evidencia es suficiente para registrar la aprobación? (captura del chat de WhatsApp, nota de voz, correo)',
      'La evidencia queda guardada junto a la aprobación para evitar disputas de "yo nunca aprobé eso".'),
  (5, '¿Qué datos del familiar que aprueba debemos guardar? (nombre, parentesco, teléfono)',
      'Queda en el historial del proyecto junto a la evidencia de la aprobación.'),
  (6, 'Si el cliente no aprueba en varios días, ¿a los cuántos días enviamos recordatorio y cuántos recordatorios máximo?',
      'Configura los recordatorios automáticos por WhatsApp.'),
  (7, '¿La producción debe quedar BLOQUEADA hasta que el render esté aprobado, o hay excepciones donde se arranca sin esa aprobación?',
      'Define si el sistema impide mover el proyecto a producción sin aprobación registrada.'),
  (8, '¿En qué formato se entregan el modelado y el render al cliente? (imágenes, PDF, video) ¿Tamaño máximo aproximado de los archivos?',
      'Configura qué tipos de archivo acepta el sistema y cómo se muestran en el portal del cliente.'),
  (9, 'El aviso al diseñador para iniciar el diseño: ¿debe salir cuando el cliente aprueba la cotización o cuando se verifica el pago del anticipo (60%)?',
      'Hoy sale al verificar el pago; usted pidió que fuera con la aprobación. Confírmenos la regla final.'),
  (10, 'Las fotos y medidas que se toman en la visita técnica: ¿quién las toma y deben aparecerle al diseñador en la ficha del proyecto automáticamente?',
      'Conecta la visita técnica con el diseño sin pasos manuales.'),
  (11, '¿El cliente final debe ver el historial de versiones del diseño (V1, V2, V3) en su portal, o solo la última versión vigente?',
      'Define la galería de diseño del portal del cliente.'),
  (12, 'Cuando el render queda aprobado, ¿quién más debe enterarse además del diseñador? (producción, gerencia, comercial)',
      'Configura la cadena de avisos del hito más importante del ciclo.')
) AS v(position, question, why_matters) ON true
WHERE q.slug = 'ciclo-diseno-aprobaciones'
ON CONFLICT (questionnaire_id, position) DO NOTHING;

INSERT INTO public.decision_questions (questionnaire_id, position, question, why_matters)
SELECT q.id, v.position, v.question, v.why_matters
FROM public.decision_questionnaires q
JOIN (VALUES
  (1, 'Los gastos de empresa/bodega (nómina, dietas, arriendo, servicios): ¿deben repartirse entre los proyectos activos del período o quedarse como gasto general sin tocar los proyectos?',
      'Es la decisión central: cambia el cálculo de utilidad de cada cierre de proyecto.'),
  (2, 'Si se reparten: ¿por partes iguales entre los proyectos activos, o proporcional al valor de cada proyecto?',
      'Define la fórmula exacta del prorrateo.'),
  (3, '¿Qué período cubre un proyecto para efectos del cierre: desde la fecha del anticipo hasta la entrega, u otra regla?',
      'Determina qué gastos de empresa "caen" dentro de cada proyecto.'),
  (4, '¿Un cierre debe poder reabrirse si llega un gasto tardío (una factura que llega después)? ¿Quién autoriza la reapertura?',
      'Define permisos y auditoría del módulo de cierres.'),
  (5, 'Las dietas y extras de los empleados: ¿se registran por empleado y por día, o como un monto global por semana/quincena?',
      'Define el nivel de detalle del formulario de gastos.'),
  (6, 'Al cerrar un proyecto, ¿qué espera ver en el reporte? (utilidad neta, margen %, comparativo cotizado vs. real, lista de gastos)',
      'Define el contenido del cierre y de su versión imprimible.'),
  (7, '¿Quién puede hacer cierres además de gerencia? (¿el contador tendrá su propio usuario?)',
      'Define roles y permisos del módulo de cierres.')
) AS v(position, question, why_matters) ON true
WHERE q.slug = 'cierres-gastos-empresa'
ON CONFLICT (questionnaire_id, position) DO NOTHING;
