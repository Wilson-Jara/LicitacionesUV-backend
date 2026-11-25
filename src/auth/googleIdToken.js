import { createPublicKey, verify } from 'node:crypto'

/** Claves públicas con que Google firma sus ID tokens (formato JWK). */
export const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs'

const EMISORES_GOOGLE = ['accounts.google.com', 'https://accounts.google.com']
const TOLERANCIA_RELOJ_S = 60
const CACHE_CLAVES_MS = 60 * 60 * 1000

/** El ID token no es válido: firma, emisor, audiencia, vigencia o correo no verificado. */
export class TokenGoogleInvalidoError extends Error {
  /**
   * @param {string} motivo - Qué comprobación falló (para el registro y las pruebas).
   */
  constructor(motivo) {
    super(`ID token de Google inválido: ${motivo}`)
    this.name = 'TokenGoogleInvalidoError'
    this.motivo = motivo
  }
}

function decodificarSegmento(segmento, motivo) {
  try {
    return JSON.parse(Buffer.from(segmento, 'base64url').toString('utf8'))
  } catch {
    throw new TokenGoogleInvalidoError(motivo)
  }
}

/**
 * Crea un verificador de ID tokens de Google («Sign in with Google») sin dependencias
 * externas: descarga las claves públicas de Google y comprueba la firma con `node:crypto`.
 *
 * Comprobaciones, en orden: formato JWT, algoritmo `RS256`, clave conocida (`kid`),
 * firma, emisor de Google, audiencia igual al Client ID, vigencia (`exp`, con 60 s de
 * tolerancia de reloj) y `email_verified`.
 *
 * @param {object} options
 * @param {string} options.clientId - Client ID web de Google (`GOOGLE_CLIENT_ID`).
 * @param {typeof fetch} [options.fetchImpl=fetch] - `fetch` inyectable para probar sin red.
 * @param {() => number} [options.ahora=Date.now] - Reloj inyectable (milisegundos).
 * @returns {{verificar: (idToken: string) => Promise<{googleSub: string, email: string, nombre: string}>}}
 *   Verificador cuyo `verificar` devuelve los datos del usuario o lanza `TokenGoogleInvalidoError`.
 */
export function createGoogleIdTokenVerifier({ clientId, fetchImpl = fetch, ahora = Date.now }) {
  if (!clientId) throw new Error('Falta el Client ID de Google (GOOGLE_CLIENT_ID)')
  let cache = { claves: null, vence: 0 }

  async function obtenerClaves(forzar = false) {
    if (!forzar && cache.claves && ahora() < cache.vence) return cache.claves
    const respuesta = await fetchImpl(GOOGLE_JWKS_URL)
    if (!respuesta.ok)
      throw new Error(`No se pudieron obtener las claves de Google (${respuesta.status})`)
    const { keys } = await respuesta.json()
    cache = { claves: keys, vence: ahora() + CACHE_CLAVES_MS }
    return keys
  }

  async function verificar(idToken) {
    const partes = typeof idToken === 'string' ? idToken.split('.') : []
    if (partes.length !== 3) throw new TokenGoogleInvalidoError('formato')
    const [cabeceraB64, cargaB64, firmaB64] = partes
    const cabecera = decodificarSegmento(cabeceraB64, 'cabecera')
    if (cabecera.alg !== 'RS256') throw new TokenGoogleInvalidoError('algoritmo')

    // Google rota sus claves: si el kid no está en la caché, se vuelve a descargar una vez
    const buscar = (claves) => claves.find((clave) => clave.kid === cabecera.kid)
    const jwk = buscar(await obtenerClaves()) ?? buscar(await obtenerClaves(true))
    if (!jwk) throw new TokenGoogleInvalidoError('clave desconocida')
    const firmaValida = verify(
      'RSA-SHA256',
      Buffer.from(`${cabeceraB64}.${cargaB64}`),
      createPublicKey({ key: jwk, format: 'jwk' }),
      Buffer.from(firmaB64, 'base64url'),
    )
    if (!firmaValida) throw new TokenGoogleInvalidoError('firma')

    const carga = decodificarSegmento(cargaB64, 'carga')
    if (!EMISORES_GOOGLE.includes(carga.iss)) throw new TokenGoogleInvalidoError('emisor')
    if (carga.aud !== clientId) throw new TokenGoogleInvalidoError('audiencia')
    if (typeof carga.exp !== 'number' || carga.exp + TOLERANCIA_RELOJ_S <= ahora() / 1000) {
      throw new TokenGoogleInvalidoError('expirado')
    }
    if (carga.email_verified !== true || !carga.email) {
      throw new TokenGoogleInvalidoError('correo no verificado')
    }
    if (!carga.sub) throw new TokenGoogleInvalidoError('sin sub')

    return { googleSub: String(carga.sub), email: carga.email, nombre: carga.name || carga.email }
  }

  return { verificar }
}
