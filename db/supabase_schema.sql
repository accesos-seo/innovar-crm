-- =====================================================
-- INNOVAR CRM - Schema Completo de Base de Datos
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- Proyecto: xdzbjptozeqcbnaqhtye
-- =====================================================

-- Extensión UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- FUNCIÓN: auto-actualizar updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCIÓN: get_my_role() para RLS
-- =====================================================
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- =====================================================
-- TABLA: profiles (extiende auth.users)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name   TEXT,
  email       TEXT,
  avatar_url  TEXT,
  role        TEXT DEFAULT 'comercial',
  phone       TEXT,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-crear perfil al registrarse un usuario
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    'admin'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- TABLA: clients (también usada para leads/solicitudes)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.clients (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name            TEXT NOT NULL,
  email           TEXT,
  whatsapp_phone  TEXT,
  address         TEXT,
  notes           TEXT,
  data_origin     TEXT DEFAULT 'manual',
  created_by      UUID REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

CREATE OR REPLACE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- TABLA: projects
-- =====================================================
CREATE TABLE IF NOT EXISTS public.projects (
  id                         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tracking_token             TEXT UNIQUE DEFAULT gen_random_uuid()::text,
  client_id                  UUID REFERENCES public.clients(id),
  approved_quotation_id      UUID,
  designer_id                UUID REFERENCES public.profiles(id),
  created_by                 UUID REFERENCES public.profiles(id),
  accounting_closure_id      UUID,
  name                       TEXT NOT NULL,
  work_type                  TEXT NOT NULL,
  status                     TEXT DEFAULT 'contacto',
  notes                      TEXT,
  total_amount               NUMERIC(14,2),
  advance_amount             NUMERIC(14,2),
  client_approved_at         TIMESTAMPTZ,
  client_approval_notes      TEXT,
  design_deadline            DATE,
  design_delivered_at        TIMESTAMPTZ,
  initial_measurements       JSONB,
  design_3d_files            JSONB DEFAULT '[]',
  despiece_files             JSONB DEFAULT '[]',
  modelado_approved_at       TIMESTAMPTZ,
  renders_approved_at        TIMESTAMPTZ,
  modelado_revision_number   INTEGER DEFAULT 0,
  render_revision_number     INTEGER DEFAULT 0,
  estimated_install_date     DATE,
  scheduled_install_date     DATE,
  install_duration_days      INTEGER,
  delivered_at               TIMESTAMPTZ,
  quotation_pdf_url          TEXT,
  is_archived                BOOLEAN DEFAULT false,
  skip_design_process        BOOLEAN DEFAULT false,
  data_origin                TEXT DEFAULT 'system',
  created_at                 TIMESTAMPTZ DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ DEFAULT NOW(),
  deleted_at                 TIMESTAMPTZ
);

CREATE OR REPLACE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- TABLA: quotations
-- =====================================================
CREATE TABLE IF NOT EXISTS public.quotations (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id            UUID REFERENCES public.clients(id),
  project_id           UUID REFERENCES public.projects(id),
  status               TEXT DEFAULT 'draft',
  total_amount         NUMERIC(14,2) DEFAULT 0,
  subtotal             NUMERIC(14,2),
  discount_type        TEXT DEFAULT 'none',
  discount_value       NUMERIC(14,2) DEFAULT 0,
  transport_cost       NUMERIC(14,2) DEFAULT 0,
  notes                TEXT,
  is_locked            BOOLEAN DEFAULT false,
  version_number       INTEGER DEFAULT 1,
  parent_quotation_id  UUID REFERENCES public.quotations(id),
  is_historical_copy   BOOLEAN DEFAULT false,
  valid_until          DATE,
  created_by           UUID REFERENCES public.profiles(id),
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW(),
  deleted_at           TIMESTAMPTZ
);

CREATE OR REPLACE TRIGGER update_quotations_updated_at
  BEFORE UPDATE ON public.quotations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- TABLA: quotation_items
-- =====================================================
CREATE TABLE IF NOT EXISTS public.quotation_items (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quotation_id     UUID NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  description      TEXT NOT NULL,
  quantity         NUMERIC(10,2) DEFAULT 1,
  unit_price       NUMERIC(14,2) DEFAULT 0,
  calculated_total NUMERIC(14,2),
  product_category TEXT,
  base_catalog_id  UUID,
  configuration    JSONB,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER update_quotation_items_updated_at
  BEFORE UPDATE ON public.quotation_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- TABLA: payments
-- =====================================================
CREATE TABLE IF NOT EXISTS public.payments (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id      UUID REFERENCES public.projects(id),
  client_id       UUID NOT NULL REFERENCES public.clients(id),
  amount          NUMERIC(14,2) NOT NULL,
  payment_method  TEXT NOT NULL,
  payment_type    TEXT NOT NULL,
  received_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  receipt_url     TEXT,
  registered_by   UUID REFERENCES public.profiles(id),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLA: expenses
-- =====================================================
CREATE TABLE IF NOT EXISTS public.expenses (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id       UUID REFERENCES public.projects(id),
  client_id        UUID REFERENCES public.clients(id),
  category         TEXT NOT NULL,
  amount           NUMERIC(14,2) NOT NULL,
  expense_date     DATE NOT NULL,
  receipt_url      TEXT,
  description      TEXT NOT NULL,
  registered_by    UUID REFERENCES public.profiles(id),
  approved_by      UUID REFERENCES public.profiles(id),
  approval_status  TEXT DEFAULT 'pendiente',
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- TABLA: accounting_closures (cierres contables)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.accounting_closures (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id      UUID NOT NULL REFERENCES public.projects(id),
  closed_by       UUID REFERENCES public.profiles(id),
  closure_date    DATE NOT NULL,
  total_income    NUMERIC(14,2) DEFAULT 0,
  total_expenses  NUMERIC(14,2) DEFAULT 0,
  net_profit      NUMERIC(14,2) DEFAULT 0,
  profit_margin   NUMERIC(5,2) DEFAULT 0,
  notes           TEXT,
  status          TEXT DEFAULT 'draft',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER update_accounting_closures_updated_at
  BEFORE UPDATE ON public.accounting_closures
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- TABLA: notifications
-- =====================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id            UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title              TEXT NOT NULL,
  body               TEXT,
  is_read            BOOLEAN DEFAULT false,
  related_table      TEXT,
  related_id         UUID,
  notification_type  TEXT NOT NULL,
  priority           INTEGER DEFAULT 0,
  action_url         TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLA: tasks (también usada para la agenda/citas)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.tasks (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id       UUID REFERENCES public.projects(id),
  client_id        UUID REFERENCES public.clients(id),
  assigned_to      UUID REFERENCES public.profiles(id),
  created_by       UUID REFERENCES public.profiles(id),
  title            TEXT NOT NULL,
  description      TEXT,
  status           TEXT DEFAULT 'pendiente',
  priority         INTEGER DEFAULT 0,
  due_date         DATE,
  time_slot        TEXT,
  appointment_type TEXT,
  task_category    TEXT,
  kanban_order     INTEGER DEFAULT 0,
  tags             TEXT[],
  estimated_hours  NUMERIC(5,2),
  actual_hours     NUMERIC(5,2),
  completed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- TABLA: task_comments
-- =====================================================
CREATE TABLE IF NOT EXISTS public.task_comments (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id    UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  author_id  UUID REFERENCES public.profiles(id),
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER update_task_comments_updated_at
  BEFORE UPDATE ON public.task_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- TABLA: task_attachments
-- =====================================================
CREATE TABLE IF NOT EXISTS public.task_attachments (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id     UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES public.profiles(id),
  file_name   TEXT NOT NULL,
  file_url    TEXT NOT NULL,
  file_size   INTEGER,
  mime_type   TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLA: system_dictionary
-- =====================================================
CREATE TABLE IF NOT EXISTS public.system_dictionary (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category       TEXT NOT NULL,
  name           TEXT NOT NULL,
  description    TEXT,
  trigger_event  TEXT,
  status         TEXT DEFAULT 'active',
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER update_system_dictionary_updated_at
  BEFORE UPDATE ON public.system_dictionary
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- TABLA: materials (inventario / catálogo de materiales)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.materials (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category    TEXT NOT NULL,
  name        TEXT NOT NULL,
  description TEXT,
  "photoUrl"  TEXT,
  price       NUMERIC(14,2) DEFAULT 0,
  unit        TEXT DEFAULT 'unidad',
  active      BOOLEAN DEFAULT true,
  "sortOrder" INTEGER DEFAULT 0,
  brand       TEXT,
  stock       INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER update_materials_updated_at
  BEFORE UPDATE ON public.materials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- TABLA: pricing_catalog (tarifario)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.pricing_catalog (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category        TEXT NOT NULL,
  code            TEXT,
  name            TEXT NOT NULL,
  description     TEXT,
  value           NUMERIC(14,2) DEFAULT 0,
  unit            TEXT DEFAULT 'ml',
  "previousValue" NUMERIC(14,2),
  "lastUpdated"   DATE DEFAULT CURRENT_DATE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER update_pricing_catalog_updated_at
  BEFORE UPDATE ON public.pricing_catalog
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- TABLA: holidays (días festivos)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.holidays (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date       DATE NOT NULL,
  name       TEXT NOT NULL,
  year       INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLA: notification_queue (cola de mensajes WhatsApp)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.notification_queue (
  id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type              TEXT NOT NULL,
  recipient_name          TEXT,
  recipient_phone         TEXT NOT NULL,
  template_name           TEXT,
  template_language       TEXT DEFAULT 'es',
  template_parameters     JSONB,
  status                  TEXT DEFAULT 'pending',
  delivery_status         TEXT,
  provider_message_id     TEXT,
  error_message           TEXT,
  failed_reason           TEXT,
  attempt_count           INTEGER DEFAULT 0,
  processing_at           TIMESTAMPTZ,
  sent_at                 TIMESTAMPTZ,
  failed_at               TIMESTAMPTZ,
  delivered_at            TIMESTAMPTZ,
  read_at                 TIMESTAMPTZ,
  last_delivery_status_at TIMESTAMPTZ,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER update_notification_queue_updated_at
  BEFORE UPDATE ON public.notification_queue
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- TABLA: meta_whatsapp_status_events
-- =====================================================
CREATE TABLE IF NOT EXISTS public.meta_whatsapp_status_events (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_message_id TEXT NOT NULL,
  recipient_id        TEXT,
  status              TEXT,
  status_timestamp    TIMESTAMPTZ,
  raw_payload         JSONB,
  errors              JSONB,
  conversation        JSONB,
  pricing             JSONB,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_dictionary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_whatsapp_status_events ENABLE ROW LEVEL SECURITY;

-- Profiles: todos los autenticados pueden ver, solo admin o uno mismo puede editar
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR get_my_role() = 'admin');
CREATE POLICY "profiles_delete" ON public.profiles FOR DELETE TO authenticated USING (get_my_role() = 'admin');

-- Resto de tablas: acceso completo para usuarios autenticados
CREATE POLICY "clients_all"               ON public.clients               FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "projects_all"              ON public.projects               FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "quotations_all"            ON public.quotations             FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "quotation_items_all"       ON public.quotation_items        FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "payments_all"              ON public.payments               FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "expenses_all"              ON public.expenses               FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "accounting_closures_all"   ON public.accounting_closures    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "tasks_all"                 ON public.tasks                  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "task_comments_all"         ON public.task_comments          FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "task_attachments_all"      ON public.task_attachments       FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "system_dictionary_all"     ON public.system_dictionary      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "materials_all"             ON public.materials              FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "pricing_catalog_all"       ON public.pricing_catalog        FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "holidays_all"              ON public.holidays               FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "notification_queue_all"    ON public.notification_queue     FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "whatsapp_events_all"       ON public.meta_whatsapp_status_events FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Notifications: cada usuario solo ve las suyas
CREATE POLICY "notifications_select"  ON public.notifications FOR SELECT  TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notifications_insert"  ON public.notifications FOR INSERT  TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "notifications_update"  ON public.notifications FOR UPDATE  TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notifications_delete"  ON public.notifications FOR DELETE  TO authenticated USING (user_id = auth.uid());

-- =====================================================
-- FIN DEL SCHEMA
-- 18 tablas creadas con RLS y triggers
-- =====================================================
