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

`mapLicitacionRow` convierte columnas SQL al contrato de nueve campos de la API:
`id`, `title`, `amount`, `currency`, `institution`, `closingDate`, `type`, `region`
y `sourceUrl`. El monto pasa a número y la fecha sale como `YYYY-MM-DD`.

La API expone lectura de licitaciones y salud. Que existan tablas de usuarios,
favoritos y aprobaciones no significa que haya endpoints de escritura, sesiones,
perfiles, subrogancias o decisiones de aprobación implementados.

El seed carga `src/data/licitaciones.mock.json` mediante upsert por identificador;
el frontend conserva su propio catálogo y no es una dependencia de este repositorio.
