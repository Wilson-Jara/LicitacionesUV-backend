import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const projectRoot = fileURLToPath(new URL('../../', import.meta.url))

/** Abre una base propia del backend; las rutas relativas parten de su raíz. */
export function openDatabase(filename) {
  if (typeof filename !== 'string' || !filename.trim()) {
    throw new Error('Falta DATABASE_PATH: indica una ruta SQLite o :memory:')
  }
  const path = filename === ':memory:' ? filename : resolve(projectRoot, filename)
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
  const db = new DatabaseSync(path)
  db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL;')
  // SQLite lower()/NOCASE solo cubren ASCII. Conservar el contrato Unicode de la API.
  db.function('lower_unicode', { deterministic: true }, (value) => String(value).toLowerCase())
  return db
}

/** Ejecuta un comando de base de datos y cierra la conexión incluso si falla. */
export async function withDatabase(filename, task) {
  const db = openDatabase(filename)
  try {
    return await task(db)
  } finally {
    db.close()
  }
}
