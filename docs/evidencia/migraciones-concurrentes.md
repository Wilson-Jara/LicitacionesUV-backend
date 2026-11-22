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
