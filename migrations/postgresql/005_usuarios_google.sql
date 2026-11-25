-- Inicio de sesión con Google: cada usuario de Google se identifica por su `sub`
-- (identificador estable de la cuenta), no por el correo, que puede cambiar.
-- La tabla usuarios ya existe (001) con nombre, email, proveedor_auth y creado_en.

ALTER TABLE usuarios ADD COLUMN google_sub TEXT;

CREATE UNIQUE INDEX usuarios_google_sub_unico ON usuarios (google_sub)
  WHERE google_sub IS NOT NULL;

-- Una cuenta marcada como de Google debe tener su identificador.
ALTER TABLE usuarios
  ADD CONSTRAINT usuarios_google_con_sub
  CHECK (proveedor_auth <> 'google' OR google_sub IS NOT NULL);
