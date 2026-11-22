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
  let result
  let operationError
  try {
    result = await operation()
    await client.query('COMMIT')
  } catch (error) {
    operationError = error
  }

  if (!operationError) return result

  try {
    await client.query('ROLLBACK')
  } catch (rollbackError) {
    throw new AggregateError(
      [operationError, rollbackError],
      `${errorPrefix}: ${operationError.message}; además falló el rollback`,
      { cause: rollbackError },
    )
  }
  throw new Error(`${errorPrefix}: ${operationError.message}`, { cause: operationError })
}
