# Evidencia — migraciones PostgreSQL concurrentes (#6)

## Medición estructural de transacciones

### Antes del refactor

- Sitios que implementaban directamente `BEGIN`, `COMMIT` y `ROLLBACK`: **2**.
- Archivos que debían cambiar para modificar esa regla: **2**,
  `src/db/migrator.js` y `src/db/seed.js`.
- Casos base automatizados: migración exitosa, rollback de una migración, seed
  exitoso y rollback del seed en `tests/db.test.js`.

### Después del refactor

- Sitios que implementan directamente el control completo: **1**,
  `src/db/transaction.js`.
- Archivos que deben cambiar para modificar la regla común: **1**.
- `migrator.js` conserva una transacción por archivo y el error identifica la
  migración; `seed.js` conserva una transacción para todo el catálogo y su error
  identifica la carga.

> La ejecución inicial solicitada a otro integrante en la intervención ISF224
> debe registrarse en la revisión del PR; esta evidencia no atribuye una
> ejecución humana que aún no consta en el issue.

## Corrección de concurrencia

- Coordinación: advisory lock de **sesión**, con una clave derivada del nombre de
  la base y `licitacionesuv:schema_migrations`.
- Granularidad: una ejecución completa de `runMigrations`; la segunda sesión
  espera y vuelve a consultar `schema_migrations` cuando obtiene el bloqueo.
- Alcance: la clave es por base y serializa también esquemas distintos de esa
  base de forma intencional.
- Liberación: se intenta siempre después del éxito o fallo. Si el proceso pierde
  la conexión, PostgreSQL libera automáticamente los advisory locks de sesión.
- Atomicidad: cada archivo y su `INSERT` de registro conservan una transacción
  propia mediante `runInTransaction`.

## Casos PostgreSQL 16

`tests/db.integration.test.js` usa la base `*_test` y un esquema temporal activo:

1. Dos clientes ejecutan simultáneamente una migración con `pg_sleep(0.2)`; uno
   aplica el archivo y el otro devuelve cero pendientes. El registro agrupado
   contiene exactamente una fila.
2. Una corrida aplica `001` y falla en `002`; solo `001` queda registrada. Tras
   corregir `002`, un cliente nuevo obtiene el bloqueo, aplica únicamente ese
   archivo y deja ambos registros consistentes.

Estas pruebas se omiten explícitamente sin `DATABASE_URL_TEST`. El resultado con
PostgreSQL 16 debe registrarse desde CI o desde una base local aislada, nunca desde
la base de desarrollo.

## Resultado remoto

- GitHub Actions `verify` con PostgreSQL 16: **correcto**.
- Ejecución: https://github.com/Wilson-Jara/LicitacionesUV-backend/actions/runs/45064741286
- La ejecución usa `licitaciones_test`, crea esquemas temporales y ejecuta
  `npm run verify` y `npm run test:coverage` sin omitir la integración.
