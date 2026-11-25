import { config } from './config/env.js'
import { HttpError, readJsonBody, sendJson } from './lib/http.js'
import { createRouter } from './lib/router.js'
import { registerHealthRoutes } from './routes/health.routes.js'
import { registerLicitacionesRoutes } from './routes/licitaciones.routes.js'
import { registerAuthRoutes } from './routes/auth.routes.js'
import { createGoogleVerifier } from './auth/googleVerifier.js'
import { createMemoryLicitacionesRepository } from './data/licitaciones.repository.js'
import { loadMockLicitaciones } from './data/mockLicitaciones.js'

// Contrato con el frontend: en el login, un cuerpo que no es JSON válido se informa
// igual que una credencial ausente.
async function leerCuerpo(req) {
  try {
    return await readJsonBody(req)
  } catch (error) {
    const esLogin = new URL(req.url, 'http://localhost').pathname === '/api/auth/google'
    if (esLogin && error instanceof HttpError && error.status === 400) {
      throw new HttpError(400, 'Falta la credencial de Google')
    }
    throw error
  }
}

function applyCors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', config.corsOrigin)
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return true
  }
  return false
}

/**
 * Arma la aplicación HTTP de la API: aplica CORS, responde el preflight `OPTIONS`,
 * lee el cuerpo JSON en `POST`/`PUT`/`PATCH`, despacha al enrutador y traduce
 * los errores a respuestas `{ error: mensaje }`.
 *
 * Decisiones no evidentes:
 * - Un `HttpError` se responde con su código y su mensaje; cualquier otro error
 *   responde 500 con un mensaje genérico, para no exponer detalles internos
 *   (el detalle solo se registra con `console.error`).
 * - El repositorio se recibe por parámetro: sin él se usan los datos de ejemplo
 *   en memoria, lo que permite probar y desarrollar sin base de datos.
 *
 * @param {object} [options]
 * @param {{list: Function, findById: Function}} [options.licitacionesRepository] -
 *   Fuente de datos de licitaciones; por defecto, el catálogo de ejemplo local en memoria.
 * @param {{verificar: (idToken: string) => Promise<object>} | null} [options.googleVerifier] -
 *   Verificador de ID tokens de Google; por defecto usa `google-auth-library` con
 *   `GOOGLE_CLIENT_ID`, o `null` si no está definido. En las pruebas se pasa uno falso.
 * @param {{googleClientId: string, jwtSecret: string, authTokenTtlHoras: number}} [options.authConfig] -
 *   Configuración del login; por defecto, la de `src/config/env.js`.
 * @param {() => number} [options.ahora] - Reloj inyectable para el vencimiento de la sesión.
 * @returns {(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => Promise<void>}
 *   Manejador para `http.createServer`.
 */
export function createApp({
  licitacionesRepository = createMemoryLicitacionesRepository(loadMockLicitaciones()),
  authConfig = config,
  googleVerifier = authConfig.googleClientId
    ? createGoogleVerifier({ clientId: authConfig.googleClientId })
    : null,
  ahora = Date.now,
} = {}) {
  const router = createRouter()
  registerHealthRoutes(router)
  registerLicitacionesRoutes(router, licitacionesRepository)
  registerAuthRoutes(router, { googleVerifier, config: authConfig, ahora })

  return async (req, res) => {
    try {
      if (applyCors(req, res)) return
      req.query = {}
      req.params = {}
      req.body = undefined
      if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
        req.body = await leerCuerpo(req)
      }
      const handled = await router.handle(req, res)
      if (!handled) sendJson(res, 404, { error: 'Ruta no encontrada' })
    } catch (error) {
      // Un HttpError es un error controlado: se responde con su código y su mensaje,
      // también los 5xx como el 503 del login sin configurar. Cualquier otro error es
      // inesperado: se registra y se responde 500 genérico.
      if (error instanceof HttpError) {
        sendJson(res, error.status, { error: error.message })
        return
      }
      console.error(error)
      sendJson(res, 500, { error: 'Error interno del servidor' })
    }
  }
}
