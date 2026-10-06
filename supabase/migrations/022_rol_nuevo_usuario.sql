-- 022_rol_nuevo_usuario.sql
-- Una cuenta nueva ya no puede elegir su rol: tomaba el rol de los datos que manda quien se registra,
-- así que cualquiera podía crearse un admin. Siempre arranca como vendedor; el rol real lo pone
-- la función admin-create-user (la que usan el admin y el operador) al crear el perfil.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  INSERT INTO public.perfiles (id, nombre, agencia_nombre, rol)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'nombre', NEW.email),
    NEW.raw_user_meta_data ->> 'agencia_nombre',
    'vendedor_minorista'::public.user_role
  );
  RETURN NEW;
END;
$$;
