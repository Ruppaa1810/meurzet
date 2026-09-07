-- 009_email_en_perfiles.sql
-- Agrega columna email a la tabla perfiles para notificaciones

ALTER TABLE perfiles
ADD COLUMN IF NOT EXISTS email text;

-- Copiar emails existentes desde auth.users (via function SECURITY DEFINER)
CREATE OR REPLACE FUNCTION sync_email_from_auth()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE perfiles p
  SET email = u.email
  FROM auth.users u
  WHERE p.id = u.id
    AND p.email IS NULL
    AND u.email IS NOT NULL;
END;
$$;

SELECT sync_email_from_auth();
DROP FUNCTION sync_email_from_auth();
