import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { runInTransaction } from './transaction.js'

const MIGRATION_FILE = /^\d{3}_[a-z0-9_]+\.sql$/
const MIGRATION_LOCK_NAME = 'licitacionesuv:schema_migrations'

const LOCK_SQL = `
  SELECT pg_advisory_lock(
    hashtextextended(current_database() || ':' || $1, 0)
  )`
const UNLOCK_SQL = `
  SELECT pg_advisory_unlock(
    hashtextextended(current_database() || ':' || $1, 0)
  ) AS released`

async function runWithMigrationLock(client, operation) {
  await client.query(LOCK_SQL, [MIGRATION_LOCK_NAME])

  let result
  let operationError
  try {
    result = await operation()
  } catch (error) {
    operationError = error
  }

  let releaseError
  try {
    const { rows } = await client.query(UNLOCK_SQL, [MIGRATION_LOCK_NAME])
    if (rows[0]?.released !== true) {
      throw new Error('PostgreSQL informó que el advisory lock no pertenecía a esta sesión')
    }
  } catch (error) {
    releaseError = error
  }

  if (operationError && releaseError) {
    throw new AggregateError(
      [operationError, releaseError],
      `${operationError.message}; además falló la liberación del bloqueo de migraciones`,
    )
  }
  if (operationError) throw operationError
  if (releaseError) {
    throw new Error(`No se pudo liberar el bloqueo de migraciones: ${releaseError.message}`, {
      cause: releaseError,
    })
  }
  return result
}

/**
 * Lista las migraciones de una carpeta en el orden en que deben aplicarse.
 * Solo considera archivos con el formato `NNN_nombre.sql` (por ejemplo
 * `001_esquema_inicial.sql`); el orden lo da el número inicial.
 *
 * @param {string} dir - Carpeta de migraciones.
 * @returns {Promise<Array<string>>} Nombres de archivo ordenados.
 */
export async function listMigrationFiles(dir) {
  const files = await readdir(dir)
  return files.filter((file) => MIGRATION_FILE.test(file)).sort()
}

/**
 * Aplica en orden las migraciones pendientes y registra cada una en la tabla
 * `schema_migrations` (que crea si no existe). Una migración ya registrada no
 * se vuelve a ejecutar, así que llamarla dos veces es seguro.
 *
 * Cada migración corre en su propia transacción: si falla, se revierte solo esa
 * y no se aplican las siguientes.
 *
 * @param {{query: Function}} client - Cliente de PostgreSQL (o un doble en las pruebas).
 * @param {string} dir - Carpeta de migraciones.
 * @returns {Promise<Array<string>>} Nombres de las migraciones aplicadas en esta llamada.
 * @throws {Error} Si una migración falla; el mensaje nombra el archivo y la causa queda en `cause`.
 */
export async function runMigrations(client, dir) {
  return runWithMigrationLock(client, async () => {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        nombre TEXT PRIMARY KEY,
        aplicada_en TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
    const { rows } = await client.query('SELECT nombre FROM schema_migrations')
    const aplicadas = new Set(rows.map((row) => row.nombre))
    const pendientes = (await listMigrationFiles(dir)).filter((file) => !aplicadas.has(file))

    for (const file of pendientes) {
      const sql = await readFile(join(dir, file), 'utf8')
      await runInTransaction(
        client,
        async () => {
          await client.query(sql)
          await client.query('INSERT INTO schema_migrations (nombre) VALUES ($1)', [file])
        },
        `Falló la migración ${file}`,
      )
    }
    return pendientes
  })
}
