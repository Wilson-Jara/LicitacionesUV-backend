import { HttpError, sendJson } from '../lib/http.js'
import { firmarSesion, verificarSesion } from '../lib/sesion.js'

/** Largo mínimo de `JWT_SECRET`; uno más corto se trata como no configurado. */
export const LARGO_MINIMO_SECRETO = 32

/**
 * Indica si el login con Google tiene lo necesario para funcionar.
 *
 * @param {{googleClientId: string, jwtSecret: string}} config - Configuración de la API.
 * @returns {boolean} `true` si hay Client ID y un `JWT_SECRET` de al menos 32 caracteres.
 */
export function loginConfigurado(config) {
  return Boolean(config.googleClientId) && (config.jwtSecret || '').length >= LARGO_MINIMO_SECRETO
}

function leerBearer(req) {
  const [esquema, token, sobra] = (req.headers.authorization || '').split(' ')
  return esquema === 'Bearer' && token && sobra === undefined ? token : null
}

/**
 * Registra el inicio de sesión con Google (contrato acordado con el frontend):
 * - `POST /api/auth/google` `{ credential }` → `200 { token, expiresAt, user }`.
 * - `GET /api/auth/me` con `Authorization: Bearer <token>` → `200 { user }`.
 * - `POST /api/auth/logout` → `204` siempre.
 *
 * La sesión no se guarda en el servidor: el token firmado es la sesión y el frontend lo
 * borra al cerrar sesión. Si falta `GOOGLE_CLIENT_ID` o `JWT_SECRET`, `google` y `me`
 * responden `503` y el resto de la API sigue funcionando. Los tokens nunca se registran
 * en la consola: cualquier rechazo del verificador se responde como `401` sin detalle.
 *
 * @param {{register: Function, get: Function}} router - Enrutador de `createRouter()`.
 * @param {object} deps
 * @param {{verificar: (idToken: string) => Promise<object>} | null} deps.googleVerifier -
 *   Verificador de ID tokens de Google, o `null` si no está configurado.
 * @param {{googleClientId: string, jwtSecret: string, authTokenTtlHoras: number}} deps.config -
 *   Configuración de la API.
 * @param {() => number} [deps.ahora=Date.now] - Reloj inyectable (milisegundos).
 * @returns {void}
 */
export function registerAuthRoutes(router, { googleVerifier, config, ahora = Date.now }) {
  function exigirConfiguracion() {
    if (!googleVerifier || !loginConfigurado(config)) {
      throw new HttpError(503, 'Login con Google no configurado')
    }
  }

  router.register('POST', '/api/auth/google', async (req, res) => {
    exigirConfiguracion()
    const credential = req.body?.credential
    if (typeof credential !== 'string' || !credential.trim()) {
      throw new HttpError(400, 'Falta la credencial de Google')
    }
    let datos
    try {
      datos = await googleVerifier.verificar(credential)
    } catch {
      // No se propaga ni se registra el error: puede incluir partes del token
      throw new HttpError(401, 'Credencial de Google inválida')
    }
    if (datos?.email_verified !== true || !datos.sub || !datos.email) {
      throw new HttpError(401, 'Credencial de Google inválida')
    }
    const user = {
      id: `google:${datos.sub}`,
      name: datos.name || datos.email,
      email: datos.email,
      picture: datos.picture || null,
    }
    const { token, expiresAt } = firmarSesion(user, {
      secreto: config.jwtSecret,
      ttlHoras: config.authTokenTtlHoras,
      ahora: ahora(),
    })
    sendJson(res, 200, { token, expiresAt, user })
  })

  router.get('/api/auth/me', async (req, res) => {
    exigirConfiguracion()
    const user = verificarSesion(leerBearer(req), { secreto: config.jwtSecret, ahora: ahora() })
    if (!user) throw new HttpError(401, 'Sesión inválida o expirada')
    sendJson(res, 200, { user })
  })

  router.register('POST', '/api/auth/logout', async (req, res) => {
    res.writeHead(204)
    res.end()
  })
}
