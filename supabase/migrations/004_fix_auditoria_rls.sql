-- 004_fix_auditoria_rls.sql
-- Políticas RLS para auditoria_pasajes (faltaban completamente)

ALTER TABLE auditoria_pasajes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auditoria_select_autenticados" ON auditoria_pasajes;
DROP POLICY IF EXISTS "auditoria_insert_autenticados" ON auditoria_pasajes;

CREATE POLICY "auditoria_select_autenticados" ON auditoria_pasajes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "auditoria_insert_autenticados" ON auditoria_pasajes
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = vendedor_id
  );
