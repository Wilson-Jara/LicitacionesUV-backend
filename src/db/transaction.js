/**
 * Ejecuta una operación dentro de una transacción PostgreSQL.
 *
 * Centraliza la regla compartida por migraciones y seed: confirma solo cuando
 * toda la operación termina y revierte ante cualquier error. El prefijo conserva
 * el contexto de la operación fallida y la excepción original queda en `cause`.
 *
 * @template T
 * @param {{query: Function}} client - Cliente PostgreSQL con una sesión dedicada.
 * @param {() => Promise<T>} operation - Operación que se ejecutará en la transacción.
 * @param {string} errorPrefix - Texto que identifica la operación en el error.
 * @returns {Promise<T>} Resultado de la operación confirmada.
 * @throws {Error} Error contextual con la excepción original en `cause`.
 */
export async function runInTransaction(client, operation, errorPrefix) {
  await client.query('BEGIN')
  try {
    const result = await operation()
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw new Error(`${errorPrefix}: ${error.message}`, { cause: error })
  }
}
