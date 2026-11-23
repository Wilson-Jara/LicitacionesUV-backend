import { randomUUID } from 'node:crypto'
import { createPool } from '../../src/db/pool.js'

export const connectionString = process.env.DATABASE_URL_TEST

export function motivoParaOmitir() {
  if (!connectionString) return 'DATABASE_URL_TEST no definida'
  try {
    const url = new URL(connectionString)
    if (!['postgres:', 'postgresql:'].includes(url.protocol))
      return 'Se requiere PostgreSQL de prueba'
    if (!decodeURIComponent(url.pathname).endsWith('_test')) return 'La base debe terminar en _test'
  } catch {
    return 'DATABASE_URL_TEST no es una URL válida'
  }
  return false
}

// Cada suite usa su propio esquema: nunca se borra el esquema public.
export async function crearBaseDePrueba() {
  const schema = `uv_test_${randomUUID().replaceAll('-', '')}`
  const admin = createPool(connectionString)
  let pool
  try {
    await admin.query(`CREATE SCHEMA "${schema}"`)
    const url = new URL(connectionString)
    url.searchParams.set('options', `-c search_path=${schema}`)
    pool = createPool(url.toString())
    return {
      pool,
      url: url.toString(),
      async close() {
        await pool.end()
        try {
          await admin.query(`DROP SCHEMA "${schema}" CASCADE`)
        } finally {
          await admin.end()
        }
      },
    }
  } catch (error) {
    await pool?.end()
    await admin.end()
    throw error
  }
}
