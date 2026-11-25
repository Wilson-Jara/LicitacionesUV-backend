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

## Indicadores antes/después de `src/db/transaction.js` (C1)

Medición reproducible sobre el historial de Git, contando las sentencias de
control transaccional en `src/` (`git grep -nE "'(BEGIN|COMMIT|ROLLBACK)'"`).

- **Antes:** `02af875`, último commit de `develop` previo al merge del PR #13.
- **Después:** `eba71dc`, merge del PR #13 en `develop` (sin cambios posteriores
  en `src/db/transaction.js` hasta la fecha de esta medición).

| Indicador                                        | Antes | Después |  Variación |
| ------------------------------------------------ | ----: | ------: | ---------: |
| Repeticiones de `BEGIN` en `src/`                |     2 |       1 |         −1 |
| Repeticiones de `COMMIT` en `src/`               |     2 |       1 |         −1 |
| Repeticiones de `ROLLBACK` en `src/`             |     2 |       1 |         −1 |
| Total de sentencias de control transaccional     |     6 |       3 | −3 (−50 %) |
| Archivos con `BEGIN`/`COMMIT`/`ROLLBACK` propios |     2 |       1 | −1 (−50 %) |
| Archivos a editar para cambiar la regla común    |     2 |       1 | −1 (−50 %) |
| Llamadas a `runInTransaction` (migrator + seed)  |     0 |       2 |         +2 |

Detalle por archivo:

| Archivo                 | Antes (`BEGIN`/`COMMIT`/`ROLLBACK`) | Después                   |
| ----------------------- | ----------------------------------- | ------------------------- |
| `src/db/migrator.js`    | 1 / 1 / 1 (líneas 45, 49, 51)       | 0, usa `runInTransaction` |
| `src/db/seed.js`        | 1 / 1 / 1 (líneas 15, 44, 46)       | 0, usa `runInTransaction` |
| `src/db/transaction.js` | no existía                          | 1 / 1 / 1                 |

Lectura: antes, cambiar la regla de confirmación o reversión exigía editar dos
implementaciones equivalentes y mantenerlas sincronizadas. Después, la corrección
posterior que conserva el error original cuando también falla el `ROLLBACK`
(`16e8f1a`) cambió la regla solo en `src/db/transaction.js`; en `seed.js` ese
commit únicamente reubicó el `import`. Las pruebas de `tests/db.test.js` siguen
verificando que `ROLLBACK` sea la última sentencia emitida en los casos de fallo
de migración y de seed, y el doble de prueba ahora puede simular además un fallo
del propio `ROLLBACK`.
