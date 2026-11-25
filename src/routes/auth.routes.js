import { HttpError, sendJson } from '../lib/http.js'
import { TokenGoogleInvalidoError } from '../auth/googleIdToken.js'
import {
  COOKIE_SESION,
  DURACION_SESION_S,
  cookieSesion,
  crearTokenSesion,
  leerCookies,
  leerTokenSesion,
} from '../auth/sesion.js'

/**
 * Registra el inicio de sesión con Google:
 * - `POST /api/auth/google` `{ credential }`: verifica el ID token, registra o actualiza
 *   el usuario y deja la sesión en una cookie HttpOnly. Responde `200 { usuario }`.
 * - `GET /api/auth/me`: devuelve el usuario de la sesión o `401`.
 * - `POST /api/auth/logout`: borra la cookie y responde `204`.
 *
 * Si falta `GOOGLE_CLIENT_ID` o `JWT_SECRET`, el login responde `503`: el resto de la
 * API sigue funcionando.
 *
 * Protección contra solicitudes falsificadas entre sitios (CSRF): la cookie usa
 * `SameSite=None`, así que el navegador la enviaría también desde otra página. Por eso
 * las rutas que cambian la sesión exigen:
 * - un encabezado `Origin`, si viene, igual a `CORS_ORIGIN` (si no, `403`);
 * - en el login, `Content-Type: application/json` (si no, `415`). Un formulario HTML de
 *   otro sitio no puede enviar ese tipo sin una consulta previa (preflight) que CORS rechaza.
 *
 * @param {{register: Function, get: Function}} router - Enrutador de `createRouter()`.
 * @param {object} deps
 * @param {{verificar: Function} | null} deps.verificadorGoogle - Verificador de ID tokens, o `null` si no está configurado.
 * @param {{registrarGoogle: Function, findById: Function}} deps.usuariosRepository - Repositorio de usuarios.
 * @param {string} deps.secretoSesion - Secreto con que se firma la cookie (`JWT_SECRET`).
 * @param {string} deps.origenPermitido - Único origen aceptado (`CORS_ORIGIN`).
 * @returns {void}
 */
export function registerAuthRoutes(
  router,
  { verificadorGoogle, usuariosRepository, secretoSesion, origenPermitido },
) {
  function exigirOrigenPermitido(req) {
    const origen = req.headers.origin
    if (origen !== undefined && origen !== origenPermitido) {
      throw new HttpError(403, 'Origen no permitido')
    }
  }

  function exigirJson(req) {
    const tipo = (req.headers['content-type'] || '').split(';')[0].trim().toLowerCase()
    if (tipo !== 'application/json') {
      throw new HttpError(415, 'El inicio de sesión exige Content-Type: application/json')
    }
  }

  function exigirConfiguracion() {
    if (!verificadorGoogle || !secretoSesion) {
      throw new HttpError(503, 'El inicio de sesión con Google no está configurado')
    }
  }

  router.register('POST', '/api/auth/google', async (req, res) => {
    exigirConfiguracion()
    exigirOrigenPermitido(req)
    exigirJson(req)
    const credential = req.body?.credential
    if (typeof credential !== 'string' || !credential) {
      throw new HttpError(400, 'Falta el campo credential con el ID token de Google')
    }
    let datos
    try {
      datos = await verificadorGoogle.verificar(credential)
    } catch (error) {
      if (error instanceof TokenGoogleInvalidoError) {
        throw new HttpError(401, 'No se pudo verificar la cuenta de Google')
      }
      throw error
    }
    const usuario = await usuariosRepository.registrarGoogle(datos)
    res.setHeader(
      'Set-Cookie',
      cookieSesion(crearTokenSesion(usuario, secretoSesion), DURACION_SESION_S),
    )
    sendJson(res, 200, { usuario })
  })

  router.get('/api/auth/me', async (req, res) => {
    exigirConfiguracion()
    const sesion = leerTokenSesion(leerCookies(req.headers.cookie)[COOKIE_SESION], secretoSesion)
    const usuario = sesion && (await usuariosRepository.findById(sesion.sub))
    if (!usuario) throw new HttpError(401, 'No hay una sesión activa')
    sendJson(res, 200, { usuario })
  })

  router.register('POST', '/api/auth/logout', async (req, res) => {
    exigirOrigenPermitido(req)
    res.setHeader('Set-Cookie', cookieSesion('', 0))
    res.writeHead(204)
    res.end()
  })
}
