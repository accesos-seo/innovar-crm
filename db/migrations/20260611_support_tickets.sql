-- Support Tickets System
-- Aplicar vía Management API: POST /v1/projects/xdzbjptozeqcbnaqhtye/database/query

CREATE SEQUENCE IF NOT EXISTS support_ticket_seq START 1;

CREATE TABLE IF NOT EXISTS support_tickets (
  id               BIGSERIAL PRIMARY KEY,
  ticket_id        TEXT         NOT NULL UNIQUE,
  subject          TEXT         NOT NULL,
  description      TEXT,
  priority         TEXT         NOT NULL DEFAULT 'media'
                     CHECK (priority IN ('baja','media','alta','urgente')),
  category         TEXT         NOT NULL DEFAULT 'consulta-general'
                     CHECK (category IN ('soporte-tecnico','consulta-general',
                                         'reportar-problema','solicitud-mejora','otro')),
  status           TEXT         NOT NULL DEFAULT 'Abierto'
                     CHECK (status IN ('Abierto','En Progreso','Cerrado')),
  created_by       UUID         NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  assigned_to      UUID                  REFERENCES profiles(id) ON DELETE SET NULL,
  file_urls        JSONB        NOT NULL DEFAULT '[]'::JSONB,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  closed_at        TIMESTAMPTZ,
  first_response_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS ticket_messages (
  id          BIGSERIAL    PRIMARY KEY,
  ticket_id   BIGINT       NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_id   UUID         NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  content     TEXT         NOT NULL,
  is_internal BOOLEAN      NOT NULL DEFAULT FALSE,
  file_urls   JSONB        NOT NULL DEFAULT '[]'::JSONB,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_by ON support_tickets(created_by);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status     ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket_id  ON ticket_messages(ticket_id);

-- Auto-generate ticket_id
CREATE OR REPLACE FUNCTION fn_generate_ticket_id()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.ticket_id := 'TKT-' || LPAD(nextval('support_ticket_seq')::TEXT, 5, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_ticket_id ON support_tickets;
CREATE TRIGGER trg_generate_ticket_id
  BEFORE INSERT ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION fn_generate_ticket_id();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION fn_support_ticket_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_support_ticket_updated_at ON support_tickets;
CREATE TRIGGER trg_support_ticket_updated_at
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION fn_support_ticket_updated_at();

-- RLS
ALTER TABLE support_tickets  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_messages  ENABLE ROW LEVEL SECURITY;

-- support_tickets: admin ve todo, creator ve el suyo
DROP POLICY IF EXISTS "st_select" ON support_tickets;
CREATE POLICY "st_select" ON support_tickets FOR SELECT TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin','super_admin')
    OR created_by = auth.uid()
  );

DROP POLICY IF EXISTS "st_insert" ON support_tickets;
CREATE POLICY "st_insert" ON support_tickets FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "st_update" ON support_tickets;
CREATE POLICY "st_update" ON support_tickets FOR UPDATE TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin','super_admin')
  );

DROP POLICY IF EXISTS "st_delete" ON support_tickets;
CREATE POLICY "st_delete" ON support_tickets FOR DELETE TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin','super_admin')
  );

-- ticket_messages: admin + ticket creator/assignee
DROP POLICY IF EXISTS "tm_select" ON ticket_messages;
CREATE POLICY "tm_select" ON ticket_messages FOR SELECT TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin','super_admin')
    OR EXISTS (
      SELECT 1 FROM support_tickets st
      WHERE st.id = ticket_id
        AND (st.created_by = auth.uid() OR st.assigned_to = auth.uid())
    )
  );

DROP POLICY IF EXISTS "tm_insert" ON ticket_messages;
CREATE POLICY "tm_insert" ON ticket_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM support_tickets st
      WHERE st.id = ticket_id
        AND (
          (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin','super_admin')
          OR st.created_by = auth.uid()
          OR st.assigned_to = auth.uid()
        )
    )
  );
