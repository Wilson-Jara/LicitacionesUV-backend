import { createHmac, timingSafeEqual } from 'node:crypto'

/** Nombre de la cookie de sesión. */
export const COOKIE_SESION = 'licitacionesuv_sesion'

/** Duración de la sesión: 8 horas. */
export const DURACION_SESION_S = 8 * 60 * 60

function firmar(carga, secreto) {
  return createHmac('sha256', secreto).update(carga).digest('base64url')
}

/**
 * Crea el valor de la cookie de sesión: los datos del usuario y su vencimiento,
 * firmados con HMAC-SHA256. No se guarda nada en el servidor; la firma impide
 * que el navegador modifique el contenido.
 *
 * @param {{id: string, email: string, nombre: string}} usuario - Usuario autenticado.
 * @param {string} secreto - `JWT_SECRET`.
 * @param {number} [ahora=Date.now()] - Hora actual en milisegundos.
 * @returns {string} Token `carga.firma` en base64url.
 */
export function crearTokenSesion(usuario, secreto, ahora = Date.now()) {
  const carga = Buffer.from(
    JSON.stringify({
      sub: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      exp: Math.floor(ahora / 1000) + DURACION_SESION_S,
    }),
  ).toString('base64url')
  return `${carga}.${firmar(carga, secreto)}`
}

/**
 * Lee y valida el token de sesión.
 *
 * @param {string | undefined} token - Valor de la cookie.
 * @param {string} secreto - `JWT_SECRET`.
 * @param {number} [ahora=Date.now()] - Hora actual en milisegundos.
 * @returns {{sub: string, email: string, nombre: string, exp: number} | null} La sesión,
 *   o `null` si falta, está alterada, vencida o mal formada.
 */
export function leerTokenSesion(token, secreto, ahora = Date.now()) {
  if (typeof token !== 'string') return null
  const [carga, firma, sobra] = token.split('.')
  if (!carga || !firma || sobra !== undefined) return null
  const esperada = Buffer.from(firmar(carga, secreto))
  const recibida = Buffer.from(firma)
  if (esperada.length !== recibida.length || !timingSafeEqual(esperada, recibida)) return null
  try {
    const sesion = JSON.parse(Buffer.from(carga, 'base64url').toString('utf8'))
    return typeof sesion.exp === 'number' && sesion.exp > ahora / 1000 ? sesion : null
  } catch {
    return null
  }
}

/**
 * Lee las cookies de una solicitud.
 *
 * @param {string | undefined} cabecera - Cabecera `Cookie`.
 * @returns {Record<string, string>} Nombre → valor.
 */
export function leerCookies(cabecera) {
  const cookies = {}
  for (const parte of (cabecera || '').split(';')) {
    const separador = parte.indexOf('=')
    if (separador === -1) continue
    const nombre = parte.slice(0, separador).trim()
    if (nombre) cookies[nombre] = parte.slice(separador + 1).trim()
  }
  return cookies
}

/**
 * Arma la cabecera `Set-Cookie` de la sesión. `HttpOnly` impide leerla desde
 * JavaScript; `Secure` y `SameSite=None` permiten enviarla desde el frontend en
 * Vercel a la API en Render (dominios distintos) solo por HTTPS.
 *
 * @param {string} valor - Token de sesión, o cadena vacía para borrarla.
 * @param {number} maxAge - Segundos de vida; 0 la elimina.
 * @returns {string} Valor de `Set-Cookie`.
 */
export function cookieSesion(valor, maxAge) {
  return `${COOKIE_SESION}=${valor}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=${maxAge}`
}
