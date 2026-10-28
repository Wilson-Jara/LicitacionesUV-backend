import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = dirname(fileURLToPath(import.meta.url))
/**
 * Ruta al catálogo de ejemplo propio del backend (REF-10). Mantiene el
 * contrato del frontend sin depender de archivos de otro repositorio.
 */
export const mockPath = resolve(currentDir, 'licitaciones.mock.json')

/**
 * Lee y devuelve las licitaciones del catálogo de ejemplo local.
 *
 * @returns {Array<object>} Licitaciones con el contrato de datos (REF-10).
 * @throws {Error} Si el archivo no se puede leer o no es JSON válido; el mensaje
 *   incluye la ruta y la causa original queda en `cause`.
 */
export function loadMockLicitaciones() {
  try {
    return JSON.parse(readFileSync(mockPath, 'utf8'))
  } catch (error) {
    throw new Error(`No se pudo cargar el mock de licitaciones (${mockPath}): ${error.message}`, {
      cause: error,
    })
  }
}
