# QA de contratos y PostgreSQL — Issue #9

Verificación independiente de la API tras integrar filtros repetidos (#5, PR #15), migraciones concurrentes (#6, PR #13), sector y etiquetas (PR #14) y precisión de montos (#7, PR #16).

**Resultado:** sin defectos. CI en verde sobre `develop @ cc2832b` (con PostgreSQL 16) y suite local 69/70 (1 omitida por falta de PostgreSQL local, motivo registrado abajo).

## Entorno

| Campo           | Valor                                                                                         |
| --------------- | --------------------------------------------------------------------------------------------- |
| Fecha           | 2026-11-22                                                                                    |
| Responsable     | Mauricio Henríquez (`@StelleC`), QA                                                           |
| Versión probada | `develop @ cc2832b` (merge de #16)                                                            |
| Rama            | `chore/9-qa-contratos-postgresql`                                                             |
| Local           | Windows x64, Node.js ≥ 22.22.0, `npm start` sin `DATABASE_URL` (catálogo ficticio en memoria) |
| CI              | Workflow `verify` en Ubuntu 24.04 con PostgreSQL 16 y base de pruebas desechable              |
| Datos           | Solo el catálogo ficticio de seis licitaciones y esquemas temporales de prueba.               |

## Ejecución de CI

| Commit    | Cambio                       | Workflow | Resultado        | Ejecución                                                                                         |
| --------- | ---------------------------- | -------- | ---------------- | ------------------------------------------------------------------------------------------------- |
| `cc2832b` | Merge #16 (montos, #7)       | `verify` | ✅ Success, 37 s | [run 45101375723](https://github.com/Wilson-Jara/LicitacionesUV-backend/actions/runs/45101375723) |
| —         | Merge #15 (filtros, #5)      | `verify` | ✅               | [run 45101265540](https://github.com/Wilson-Jara/LicitacionesUV-backend/actions/runs/45101265540) |
| —         | Merge #14 (sector/etiquetas) | `verify` | ✅               | [run 45101159171](https://github.com/Wilson-Jara/LicitacionesUV-backend/actions/runs/45101159171) |
| —         | Merge #13 (migraciones, #6)  | `verify` | ✅               | [run 45097815939](https://github.com/Wilson-Jara/LicitacionesUV-backend/actions/runs/45097815939) |

El workflow instala PostgreSQL 16 y ejecuta la suite completa, incluidas las pruebas de comandos (`cli.test.js`), servidor e integración (`db.integration.test.js`) con migraciones concurrentes y reintentos.

## Suite local

| Comando                 | Resultado                                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `npm run test:coverage` | ✅ 70 pruebas, 26 suites: 69 pasan, 0 fallan, 1 omitida. Cobertura 94,88 % líneas, 88,61 % ramas, 100 % funciones. |
| `npm run lint`          | ✅                                                                                                                 |
| `npm run format:check`  | ⚠️ Solo en local: 17 archivos con CRLF (copia anterior a `.gitattributes` con `eol=lf`). En CI pasa.               |

**Prueba omitida:** `PostgreSQL real (integración)`, motivo «DATABASE_URL_TEST no definida»: el equipo de QA no tiene PostgreSQL 16 local. Queda cubierta por CI.

> [!NOTE]
> El primer intento local falló en `cli.test.js` y `db.integration.test.js` porque el `node_modules` local no tenía `pg`. Tras `npm install` pasaron (o se omitieron) como corresponde.

## Casos de contrato (API local)

| ID     | Petición                               | Esperado                                  | Obtenido                          | Estado |
| ------ | -------------------------------------- | ----------------------------------------- | --------------------------------- | :----: |
| API-01 | `GET /api/health`                      | 200 `status: ok`                          | 200 `ok`                          |   ✅   |
| API-02 | `GET /api/licitaciones`                | 6 elementos con 11 campos                 | 6; incluye `sector` y `etiquetas` |   ✅   |
| FIL-01 | `?region=atacama`                      | Inválido ignorado: 6 (como el explorador) | 6                                 |   ✅   |
| FIL-02 | `?region=valparaiso`                   | 2 (`001`, `005`)                          | 2 (`001`, `005`)                  |   ✅   |
| FIL-03 | `?region=valparaiso&region=atacama`    | Último válido: 2                          | 2                                 |   ✅   |
| FIL-04 | `?region=atacama&region=valparaiso`    | Último válido: 2                          | 2                                 |   ✅   |
| FIL-05 | `?tipo=publica&tipo=xx`                | Pública: 3                                | 3 (`001`, `003`, `005`)           |   ✅   |
| FIL-06 | `?region=VALPARAÍSO`                   | Sin tildes ni mayúsculas: 2               | 2                                 |   ✅   |
| FIL-07 | `?keyword=%20de%20`                    | Se recorta a «de»: 5                      | 5                                 |   ✅   |
| FIL-08 | `?keyword=software&keyword=`           | Última vacía: sin filtro, 6               | 6                                 |   ✅   |
| DET-01 | `GET /api/licitaciones/licitacion-004` | 200 con el detalle                        | 200                               |   ✅   |
| DET-02 | `GET /api/licitaciones/no-existe`      | 404                                       | 404 `Licitación no encontrada`    |   ✅   |
| MON-01 | Montos del catálogo                    | Todos ≤ 9.007.199.254.740.991             | Máximo 15.000.000                 |   ✅   |

Los límites de montos (2^53−1 intacto; 2^53, 2^53+1, máximo BIGINT, −1, 10,5, texto y vacío rechazados con 500 genérico) están cubiertos por `tests/montos.test.js`, que pasa en local y en CI.

## Paridad de filtros con el explorador

Con la misma regla (`sanitizeFilterParams` del frontend): región inválida ⇒ catálogo completo; valor repetido ⇒ último válido; sin tildes ni mayúsculas. FIL-01 a FIL-06 coinciden con el comportamiento observado en el explorador durante la QA de LicitacionesUV#128.
