-- Esquema inicial SQLite: ocho entidades del dominio (docs/ModeloDatos.md).
-- Las tablas de CR-302 (aprobaciones, delegaciones, umbrales) se crean sin
-- endpoints; su lógica se implementa en US-09, US-10 y US-11.

CREATE TABLE regiones (
  id TEXT PRIMARY KEY NOT NULL,
  nombre TEXT NOT NULL
) STRICT;

CREATE TABLE unidades (
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  nombre TEXT NOT NULL UNIQUE,
  tipo TEXT NOT NULL CHECK (tipo IN ('facultad', 'direccion', 'rectoria'))
) STRICT;

CREATE TABLE usuarios (
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  nombre TEXT NOT NULL,
  email TEXT NOT NULL,
  proveedor_auth TEXT NOT NULL DEFAULT 'local'
    CHECK (proveedor_auth IN ('local', 'google', 'github')),
  creado_en TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE UNIQUE INDEX usuarios_email_unico ON usuarios (lower_unicode(email));

CREATE TABLE licitaciones (
  id TEXT PRIMARY KEY NOT NULL,
  titulo TEXT NOT NULL,
  institucion TEXT NOT NULL,
  monto INTEGER NOT NULL CHECK (monto >= 0),
  moneda TEXT NOT NULL DEFAULT 'CLP' CHECK (length(moneda) = 3),
  fecha_cierre TEXT NOT NULL CHECK (length(fecha_cierre) = 10 AND date(fecha_cierre, '+0 days') IS NOT NULL AND date(fecha_cierre, '+0 days') = fecha_cierre),
  tipo TEXT NOT NULL CHECK (tipo IN ('publica', 'privada')),
  region_id TEXT NOT NULL REFERENCES regiones (id),
  unidad_id TEXT REFERENCES unidades (id),
  url_fuente TEXT NOT NULL
) STRICT;

CREATE INDEX licitaciones_region_idx ON licitaciones (region_id);
CREATE INDEX licitaciones_unidad_idx ON licitaciones (unidad_id);

CREATE TABLE favoritos (
  usuario_id TEXT NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  licitacion_id TEXT NOT NULL REFERENCES licitaciones (id) ON DELETE CASCADE,
  fecha_guardado TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (usuario_id, licitacion_id)
) STRICT;

CREATE TABLE umbrales_aprobacion (
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  unidad_id TEXT NOT NULL REFERENCES unidades (id) ON DELETE CASCADE,
  -- monto_minimo es inclusivo y monto_maximo exclusivo; NULL = sin tope
  monto_minimo INTEGER NOT NULL CHECK (monto_minimo >= 0),
  monto_maximo INTEGER CHECK (monto_maximo IS NULL OR monto_maximo > monto_minimo),
  nivel_aprobador INTEGER NOT NULL CHECK (nivel_aprobador > 0)
) STRICT;

CREATE INDEX umbrales_unidad_idx ON umbrales_aprobacion (unidad_id);

CREATE TABLE delegaciones (
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  titular_id TEXT NOT NULL REFERENCES usuarios (id),
  subrogante_id TEXT NOT NULL REFERENCES usuarios (id),
  fecha_inicio TEXT NOT NULL CHECK (length(fecha_inicio) = 10 AND date(fecha_inicio, '+0 days') IS NOT NULL AND date(fecha_inicio, '+0 days') = fecha_inicio),
  fecha_termino TEXT NOT NULL CHECK (length(fecha_termino) = 10 AND date(fecha_termino, '+0 days') IS NOT NULL AND date(fecha_termino, '+0 days') = fecha_termino),
  CHECK (titular_id <> subrogante_id),
  CHECK (fecha_termino >= fecha_inicio)
) STRICT;

CREATE INDEX delegaciones_titular_idx ON delegaciones (titular_id);

CREATE TABLE aprobaciones (
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  licitacion_id TEXT NOT NULL REFERENCES licitaciones (id) ON DELETE CASCADE,
  aprobador_efectivo_id TEXT NOT NULL REFERENCES usuarios (id),
  nivel INTEGER NOT NULL CHECK (nivel > 0),
  decision TEXT NOT NULL CHECK (decision IN ('aprobada', 'rechazada')),
  comentario TEXT,
  fecha TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE INDEX aprobaciones_licitacion_idx ON aprobaciones (licitacion_id);
