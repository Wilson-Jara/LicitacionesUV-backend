import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const migrationsDir = fileURLToPath(new URL('../../migrations/sqlite/', import.meta.url))
const MIGRATION_FILE = /^\d{3}_[a-z0-9_]+\.sql$/

export async function listMigrationFiles(dir) {
  return (await readdir(dir)).filter((file) => MIGRATION_FILE.test(file)).sort()
}

/** Aplica solo la línea SQLite. Cada archivo y su registro comparten transacción. */
export async function runMigrations(db, dir = migrationsDir) {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    nombre TEXT PRIMARY KEY NOT NULL,
    aplicada_en TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ) STRICT`)
  const aplicadas = []
  for (const file of await listMigrationFiles(dir)) {
    const sql = await readFile(join(dir, file), 'utf8')
    db.exec('BEGIN IMMEDIATE')
    try {
      if (!db.prepare('SELECT nombre FROM schema_migrations WHERE nombre = ?').get(file)) {
        db.exec(sql)
        db.prepare('INSERT INTO schema_migrations (nombre) VALUES (?)').run(file)
        aplicadas.push(file)
      }
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw new Error(`Falló la migración ${file}: ${error.message}`, { cause: error })
    }
  }
  return aplicadas
}
