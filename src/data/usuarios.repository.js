import { randomUUID } from 'node:crypto'

// Dos implementaciones con la misma interfaz asíncrona, como el repositorio de licitaciones:
//   registrarGoogle({ googleSub, email, nombre }) -> Promise<Usuario>
//   findById(id) -> Promise<Usuario | null>
// Usuario = { id, nombre, email, proveedor }

/**
 * Repositorio de usuarios en memoria. Se usa cuando no hay `DATABASE_URL` y en las pruebas.
 * Los usuarios se pierden al reiniciar el servidor.
 *
 * @returns {{registrarGoogle: Function, findById: Function}} Repositorio de usuarios.
 */
export function createMemoryUsuariosRepository() {
  const porId = new Map()
  const idPorSub = new Map()
  return {
    async registrarGoogle({ googleSub, email, nombre }) {
      const id = idPorSub.get(googleSub) ?? randomUUID()
      idPorSub.set(googleSub, id)
      const usuario = { id, nombre, email, proveedor: 'google' }
      porId.set(id, usuario)
      return usuario
    },
    async findById(id) {
      return porId.get(id) ?? null
    },
  }
}

function mapUsuario(row) {
  return { id: row.id, nombre: row.nombre, email: row.email, proveedor: row.proveedor_auth }
}

/**
 * Repositorio de usuarios en PostgreSQL (tabla `usuarios`, migración 005).
 *
 * `registrarGoogle` busca primero por `google_sub`. Si no existe, vincula una cuenta
 * previa con el mismo correo (Google ya verificó ese correo) y, si tampoco existe,
 * la crea. En los tres casos actualiza nombre y correo con los de Google.
 *
 * @param {{query: Function}} db - `pg.Pool`, un cliente o un doble en las pruebas.
 * @returns {{registrarGoogle: Function, findById: Function}} Repositorio de usuarios.
 */
export function createPgUsuariosRepository(db) {
  return {
    async registrarGoogle({ googleSub, email, nombre }) {
      const porSub = await db.query({
        text: `UPDATE usuarios SET nombre = $2, email = $3
          WHERE google_sub = $1 RETURNING id, nombre, email, proveedor_auth`,
        values: [googleSub, nombre, email],
      })
      if (porSub.rows.length) return mapUsuario(porSub.rows[0])

      const vinculado = await db.query({
        text: `UPDATE usuarios SET google_sub = $1, proveedor_auth = 'google', nombre = $2
          WHERE lower(email) = lower($3) AND google_sub IS NULL
          RETURNING id, nombre, email, proveedor_auth`,
        values: [googleSub, nombre, email],
      })
      if (vinculado.rows.length) return mapUsuario(vinculado.rows[0])

      const creado = await db.query({
        text: `INSERT INTO usuarios (nombre, email, proveedor_auth, google_sub)
          VALUES ($1, $2, 'google', $3) RETURNING id, nombre, email, proveedor_auth`,
        values: [nombre, email, googleSub],
      })
      return mapUsuario(creado.rows[0])
    },
    async findById(id) {
      const { rows } = await db.query({
        text: 'SELECT id, nombre, email, proveedor_auth FROM usuarios WHERE id = $1',
        values: [id],
      })
      return rows.length ? mapUsuario(rows[0]) : null
    },
  }
}
