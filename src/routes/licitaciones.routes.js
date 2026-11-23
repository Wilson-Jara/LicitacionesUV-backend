import assert from 'node:assert/strict'
import { HttpError, sendJson } from '../lib/http.js'
import { normalizarFiltrosListado } from '../lib/filtrosListado.js'

/**
 * Registra las rutas de licitaciones:
 * - `GET /api/licitaciones`: listado con filtros opcionales `keyword`, `region` y
 *   `tipo` (HU #43). Los filtros se normalizan con la misma regla del explorador
 *   (`normalizarFiltrosListado`, #5): palabra clave recortada, región y tipo sin tildes
 *   ni mayúsculas, último valor válido si se repiten e inválidos ignorados.
 *   Sin coincidencias responde 200 con `[]`.
 * - `GET /api/licitaciones/:id`: detalle de una licitación (HU #44); 404 si no existe.
 *
 * El repositorio se recibe por parámetro para poder usar PostgreSQL en
 * producción y uno en memoria en las pruebas.
 *
 * @param {{get: Function}} router - Enrutador creado con `createRouter()`.
 * @param {{list: Function, findById: Function}} repository - Fuente de datos de licitaciones.
 * @returns {void}
 */
export function registerLicitacionesRoutes(router, repository) {
  router.get('/api/licitaciones', async (req, res) => {
    const filtros = normalizarFiltrosListado(req.searchParams ?? new URLSearchParams())
    sendJson(res, 200, await repository.list(filtros))
  })

  router.get('/api/licitaciones/:id', async (req, res) => {
    const licitacion = await repository.findById(req.params.id)
    if (!licitacion) throw new HttpError(404, 'Licitación no encontrada')
    // Invariante: el repositorio devuelve la licitación solicitada.
    assert.equal(
      licitacion.id,
      req.params.id,
      'Invariante: el repositorio devolvió una licitación con un id distinto al solicitado',
    )
    sendJson(res, 200, licitacion)
  })
}
