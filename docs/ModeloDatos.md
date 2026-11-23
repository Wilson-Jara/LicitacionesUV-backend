# Modelo de datos del backend

Motor: PostgreSQL 16. Fuente: `migrations/postgresql/001_esquema_inicial.sql` y `002_catalogo_regiones.sql`.
Estas migraciones son la definición ejecutable; el esquema se aplica con
`npm run db:migrate` y se registra en `schema_migrations`.

| Tabla                 | Responsabilidad y relaciones                                                                                                      |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `regiones`            | Catálogo referenciado por las licitaciones.                                                                                       |
| `unidades`            | Facultades, direcciones o rectoría; agrupa licitaciones y umbrales.                                                               |
| `usuarios`            | Nombre, correo único sin distinguir mayúsculas y proveedor de autenticación. No almacena contraseñas ni sesiones en este esquema. |
| `licitaciones`        | Identificador, título, institución, monto, moneda, cierre, tipo, región, unidad opcional y fuente.                                |
| `favoritos`           | Relación única usuario–licitación y fecha de guardado.                                                                            |
| `umbrales_aprobacion` | Rangos de monto y nivel por unidad; mínimo inclusivo, máximo exclusivo o nulo.                                                    |
| `delegaciones`        | Titular, subrogante y período de vigencia.                                                                                        |
| `aprobaciones`        | Licitación, aprobador efectivo, nivel, decisión, comentario y fecha.                                                              |

Los identificadores generados de usuarios, unidades y otras entidades son UUID;
los montos son BIGINT, los niveles SMALLINT, las fechas de dominio DATE y las
marcas automáticas TIMESTAMPTZ. El esquema limita montos negativos, rangos invertidos, correos duplicados,
autodelegaciones y fechas de delegación invertidas. Las claves foráneas verifican
referencias. No valida solapamientos entre umbrales ni resuelve automáticamente
quién debe aprobar: esas reglas no están implementadas en esta API.

## Contrato HTTP

`mapLicitacionRow` convierte columnas SQL al contrato de once campos de la API:
`id`, `title`, `amount`, `currency`, `institution`, `closingDate`, `type`, `region`,
`sector`, `etiquetas` y `sourceUrl`. `sector` es opcional (`null`) y `etiquetas` es
una lista que puede venir vacía; ambos usan las claves normalizadas del frontend y
la migración `003_sector_etiquetas.sql` restringe sus valores. El monto pasa a número y la fecha sale como `YYYY-MM-DD`.

**Dominio de los montos (#7).** Un `BIGINT` admite valores que un número JSON no
representa con exactitud: por encima de `Number.MAX_SAFE_INTEGER`
(9.007.199.254.740.991), `Number('9007199254740993')` devuelve 9007199254740992 y el
monto cambiaría sin aviso. Por eso el contrato acepta enteros entre 0 y ese límite:

- La migración `004_montos_enteros_seguros.sql` agrega un `CHECK` con ese tope a
  `licitaciones.monto` y a los montos de `umbrales_aprobacion`. Antes de aplicarla en
  una base con datos, ejecutar las consultas de comprobación que trae el archivo.
- Al leer, `montoDelContrato` (`src/lib/montos.js`) vuelve a validar el valor. Un monto
  fuera de rango lanza `MontoFueraDeRangoError`: la API responde `500` genérico y
  registra el detalle, en vez de entregar un monto alterado.
- Es la misma regla de enteros seguros del importador del frontend
  (Wilson-Jara/LicitacionesUV#121), así que no se duplica allí.

La API expone lectura de licitaciones y salud. Que existan tablas de usuarios,
favoritos y aprobaciones no significa que haya endpoints de escritura, sesiones,
perfiles, subrogancias o decisiones de aprobación implementados.

El seed carga `src/data/licitaciones.mock.json` mediante upsert por identificador;
el frontend conserva su propio catálogo y no es una dependencia de este repositorio.
