import { OAuth2Client } from 'google-auth-library'

/**
 * Crea el verificador de ID tokens de Google que usa la API por defecto.
 *
 * Delega en la librería oficial `google-auth-library`: `verifyIdToken` descarga y guarda
 * en caché las claves públicas de Google y valida la firma, el emisor
 * (`accounts.google.com`), la audiencia (`GOOGLE_CLIENT_ID`) y el vencimiento. La revisión
 * de `email_verified` la hace la ruta, igual con este verificador que con uno falso.
 *
 * @param {object} options
 * @param {string} options.clientId - `GOOGLE_CLIENT_ID`: audiencia esperada del token.
 * @param {{verifyIdToken: Function}} [options.client] - Cliente OAuth2 inyectable (pruebas).
 * @returns {{verificar: (idToken: string) => Promise<object>}} Verificador cuyo `verificar`
 *   devuelve el contenido del token (`sub`, `email`, `email_verified`, `name`, `picture`)
 *   o lanza si el token no es válido.
 */
export function createGoogleVerifier({ clientId, client = new OAuth2Client() }) {
  return {
    async verificar(idToken) {
      const ticket = await client.verifyIdToken({ idToken, audience: clientId })
      const datos = ticket.getPayload()
      if (!datos) throw new Error('El ID token no trae datos')
      return datos
    },
  }
}
