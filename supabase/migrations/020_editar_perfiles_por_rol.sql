-- 020_editar_perfiles_por_rol.sql
-- Solo existía "cada uno edita su propio perfil": el admin no podía editar ni desactivar usuarios
-- (el cambio no afectaba ninguna fila y la pantalla mostraba "JSON object requested, multiple (or no) rows returned").

-- Rol del usuario actual. SECURITY DEFINER para poder leer perfiles desde una política de perfiles sin recursión.
CREATE OR REPLACE FUNCTION public.mi_rol()
RETURNS user_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT rol FROM perfiles WHERE id = auth.uid()
$$;

DROP POLICY IF EXISTS perfiles_update_gestion ON perfiles;
CREATE POLICY perfiles_update_gestion ON perfiles
  FOR UPDATE TO authenticated
  USING (mi_rol() = 'admin_mayorista' OR (mi_rol() = 'operador_admin' AND created_by = auth.uid()))
  WITH CHECK (mi_rol() = 'admin_mayorista' OR (mi_rol() = 'operador_admin' AND created_by = auth.uid()));
