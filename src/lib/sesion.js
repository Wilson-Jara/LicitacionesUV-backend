import { createHmac, timingSafeEqual } from 'node:crypto'

const CABECERA = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')

function firma(contenido, secreto) {
  return createHmac('sha256', secreto).update(contenido).digest('base64url')
}

/**
 * Firma un token de sesión JWT (HS256) con los datos del usuario, usando solo `node:crypto`.
 * La sesión no se guarda en el servidor: el token es la sesión y vence a las `ttlHoras`.
 *
 * Función pura: recibe el reloj (`ahora`) en vez de leerlo, para poder probar el vencimiento.
 *
 * @param {{id: string, name: string, email: string, picture: string | null}} usuario -
 *   Usuario con la forma del contrato (`id` = `google:<sub>`).
 * @param {object} options
 * @param {string} options.secreto - `JWT_SECRET`.
 * @param {number} options.ttlHoras - Duración de la sesión en horas.
 * @param {number} options.ahora - Hora actual en milisegundos.
 * @returns {{token: string, expiresAt: string}} Token firmado y su vencimiento en ISO 8601.
 */
export function firmarSesion(usuario, { secreto, ttlHoras, ahora }) {
  const iat = Math.floor(ahora / 1000)
  const exp = iat + Math.round(ttlHoras * 3600)
  const carga = Buffer.from(
    JSON.stringify({
      sub: usuario.id,
      name: usuario.name,
      email: usuario.email,
      picture: usuario.picture ?? null,
      iat,
      exp,
    }),
  ).toString('base64url')
  const contenido = `${CABECERA}.${carga}`
  return {
    token: `${contenido}.${firma(contenido, secreto)}`,
    expiresAt: new Date(exp * 1000).toISOString(),
  }
}

/**
 * Verifica un token de sesión: formato JWT, algoritmo HS256, firma (comparada con
 * `timingSafeEqual`) y vencimiento.
 *
 * @param {unknown} token - Token recibido en `Authorization: Bearer <token>`.
 * @param {object} options
 * @param {string} options.secreto - `JWT_SECRET`.
 * @param {number} options.ahora - Hora actual en milisegundos.
 * @returns {{id: string, name: string, email: string, picture: string | null} | null}
 *   El usuario de la sesión, o `null` si el token falta, está alterado, mal formado o vencido.
 */
export function verificarSesion(token, { secreto, ahora }) {
  if (typeof token !== 'string') return null
  const partes = token.split('.')
  if (partes.length !== 3) return null
  const [cabecera, carga, firmaRecibida] = partes
  const esperada = Buffer.from(firma(`${cabecera}.${carga}`, secreto))
  const recibida = Buffer.from(firmaRecibida)
  if (esperada.length !== recibida.length || !timingSafeEqual(esperada, recibida)) return null
  try {
    if (JSON.parse(Buffer.from(cabecera, 'base64url').toString('utf8')).alg !== 'HS256') {
      return null
    }
    const datos = JSON.parse(Buffer.from(carga, 'base64url').toString('utf8'))
    if (typeof datos.exp !== 'number' || datos.exp <= Math.floor(ahora / 1000)) return null
    return { id: datos.sub, name: datos.name, email: datos.email, picture: datos.picture ?? null }
  } catch {
    return null
  }
}
