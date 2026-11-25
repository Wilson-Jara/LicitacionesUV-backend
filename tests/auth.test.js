import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { createApp } from '../src/app.js'
import { createGoogleVerifier } from '../src/auth/googleVerifier.js'
import { firmarSesion, verificarSesion } from '../src/lib/sesion.js'
import { loginConfigurado } from '../src/routes/auth.routes.js'

// Valores ficticios solo para pruebas; nunca un secreto real
const SECRETO = 'secreto-de-prueba-con-mas-de-32-caracteres'
const AHORA = Date.UTC(2026, 10, 25, 10, 0, 0)
const CONFIG = {
  googleClientId: 'cliente-de-prueba.apps.googleusercontent.com',
  jwtSecret: SECRETO,
  authTokenTtlHoras: 8,
}
const DATOS_GOOGLE = {
  sub: '1234567890',
  email: 'ana@gmail.com',
  email_verified: true,
  name: 'Ana Pérez',
  picture: 'https://lh3.googleusercontent.com/a/foto',
}
const USUARIO = {
  id: 'google:1234567890',
  name: 'Ana Pérez',
  email: 'ana@gmail.com',
  picture: 'https://lh3.googleusercontent.com/a/foto',
}

/** Verificador falso: las pruebas nunca llaman a Google ni a internet. */
function verificadorFalso(datos = DATOS_GOOGLE) {
  const recibidos = []
  return {
    recibidos,
    async verificar(idToken) {
      recibidos.push(idToken)
      if (idToken !== 'credencial-valida') throw new Error('Token used too late')
      return datos
    },
  }
}

async function conServidor(opciones, prueba) {
  const server = createServer(createApp(opciones))
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  try {
    await prueba(`http://127.0.0.1:${server.address().port}`)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
}

function login(base, body) {
  return fetch(`${base}/api/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function me(base, token) {
  return fetch(`${base}/api/auth/me`, {
    headers: token === undefined ? {} : { Authorization: `Bearer ${token}` },
  })
}

describe('firmarSesion / verificarSesion', () => {
  it('ida y vuelta: el token devuelve el mismo usuario y vence a las ttlHoras', () => {
    const { token, expiresAt } = firmarSesion(USUARIO, {
      secreto: SECRETO,
      ttlHoras: 8,
      ahora: AHORA,
    })
    assert.equal(expiresAt, '2026-11-25T18:00:00.000Z')
    assert.deepEqual(verificarSesion(token, { secreto: SECRETO, ahora: AHORA }), USUARIO)
    const [cabecera] = token.split('.')
    assert.deepEqual(JSON.parse(Buffer.from(cabecera, 'base64url')), { alg: 'HS256', typ: 'JWT' })
  })

  it('rechaza una firma o un contenido alterado y otro secreto', () => {
    const { token } = firmarSesion(USUARIO, { secreto: SECRETO, ttlHoras: 8, ahora: AHORA })
    const [cabecera, carga, firma] = token.split('.')
    const otraCarga = Buffer.from(JSON.stringify({ sub: 'google:admin', exp: 9e9 })).toString(
      'base64url',
    )
    const opciones = { secreto: SECRETO, ahora: AHORA }
    assert.equal(verificarSesion(`${cabecera}.${carga}.${firma.slice(0, -2)}xx`, opciones), null)
    assert.equal(verificarSesion(`${cabecera}.${otraCarga}.${firma}`, opciones), null)
    assert.equal(verificarSesion(token, { secreto: 'otro-secreto', ahora: AHORA }), null)
    assert.equal(verificarSesion('no-es-un-jwt', opciones), null)
    assert.equal(verificarSesion(undefined, opciones), null)
  })

  it('rechaza un token vencido', () => {
    const { token } = firmarSesion(USUARIO, { secreto: SECRETO, ttlHoras: 1, ahora: AHORA })
    const unaHoraDespues = AHORA + 3600 * 1000
    assert.equal(verificarSesion(token, { secreto: SECRETO, ahora: unaHoraDespues }), null)
    assert.ok(verificarSesion(token, { secreto: SECRETO, ahora: unaHoraDespues - 1000 }))
  })
})

describe('createGoogleVerifier', () => {
  it('delega en google-auth-library con la audiencia = GOOGLE_CLIENT_ID', async () => {
    const llamadas = []
    const client = {
      async verifyIdToken(opciones) {
        llamadas.push(opciones)
        return { getPayload: () => DATOS_GOOGLE }
      },
    }
    const verificador = createGoogleVerifier({ clientId: CONFIG.googleClientId, client })
    assert.deepEqual(await verificador.verificar('id-token'), DATOS_GOOGLE)
    assert.deepEqual(llamadas, [{ idToken: 'id-token', audience: CONFIG.googleClientId }])
  })

  it('lanza si el token no trae datos', async () => {
    const client = { verifyIdToken: async () => ({ getPayload: () => undefined }) }
    await assert.rejects(createGoogleVerifier({ clientId: 'x', client }).verificar('t'))
  })
})

describe('POST /api/auth/google', () => {
  it('200 con credencial válida: token, expiresAt y user con la forma del contrato', async () => {
    const googleVerifier = verificadorFalso()
    await conServidor({ authConfig: CONFIG, googleVerifier, ahora: () => AHORA }, async (base) => {
      const respuesta = await login(base, { credential: 'credencial-valida' })
      assert.equal(respuesta.status, 200)
      const cuerpo = await respuesta.json()
      assert.deepEqual(Object.keys(cuerpo).sort(), ['expiresAt', 'token', 'user'])
      assert.deepEqual(cuerpo.user, USUARIO)
      assert.equal(cuerpo.expiresAt, '2026-11-25T18:00:00.000Z')
      assert.deepEqual(verificarSesion(cuerpo.token, { secreto: SECRETO, ahora: AHORA }), USUARIO)
      assert.deepEqual(googleVerifier.recibidos, ['credencial-valida'])
    })
  })

  it('picture es null si Google no la entrega', async () => {
    const { picture, ...sinFoto } = DATOS_GOOGLE
    assert.ok(picture)
    await conServidor(
      { authConfig: CONFIG, googleVerifier: verificadorFalso(sinFoto) },
      async (base) => {
        const { user } = await (await login(base, { credential: 'credencial-valida' })).json()
        assert.equal(user.picture, null)
      },
    )
  })

  it('400 sin credential, con credential vacía o que no es texto', async () => {
    await conServidor({ authConfig: CONFIG, googleVerifier: verificadorFalso() }, async (base) => {
      for (const body of [{}, { credential: '' }, { credential: 123 }]) {
        const respuesta = await login(base, body)
        assert.equal(respuesta.status, 400, JSON.stringify(body))
        assert.deepEqual(await respuesta.json(), { error: 'Falta la credencial de Google' })
      }
    })
  })

  it('400 con cuerpo vacío o JSON inválido', async () => {
    await conServidor({ authConfig: CONFIG, googleVerifier: verificadorFalso() }, async (base) => {
      for (const body of ['', '{"credential": ']) {
        const respuesta = await fetch(`${base}/api/auth/google`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        })
        assert.equal(respuesta.status, 400, body)
        assert.deepEqual(await respuesta.json(), { error: 'Falta la credencial de Google' })
      }
    })
  })

  it('401 cuando el verificador rechaza, sin registrar el token', async () => {
    const registros = []
    const errorOriginal = console.error
    console.error = (...args) => registros.push(args)
    try {
      await conServidor(
        { authConfig: CONFIG, googleVerifier: verificadorFalso() },
        async (base) => {
          const respuesta = await login(base, { credential: 'credencial-falsa' })
          assert.equal(respuesta.status, 401)
          assert.deepEqual(await respuesta.json(), { error: 'Credencial de Google inválida' })
        },
      )
    } finally {
      console.error = errorOriginal
    }
    assert.ok(!JSON.stringify(registros).includes('credencial-falsa'))
  })

  it('401 con email_verified: false', async () => {
    const googleVerifier = verificadorFalso({ ...DATOS_GOOGLE, email_verified: false })
    await conServidor({ authConfig: CONFIG, googleVerifier }, async (base) => {
      const respuesta = await login(base, { credential: 'credencial-valida' })
      assert.equal(respuesta.status, 401)
      assert.deepEqual(await respuesta.json(), { error: 'Credencial de Google inválida' })
    })
  })

  it('503 sin GOOGLE_CLIENT_ID o con un JWT_SECRET corto', async () => {
    const errorOriginal = console.error
    console.error = () => {}
    try {
      for (const authConfig of [
        { ...CONFIG, googleClientId: '' },
        { ...CONFIG, jwtSecret: '' },
        { ...CONFIG, jwtSecret: 'corto' },
      ]) {
        await conServidor({ authConfig }, async (base) => {
          const respuesta = await login(base, { credential: 'credencial-valida' })
          assert.equal(respuesta.status, 503)
          assert.deepEqual(await respuesta.json(), { error: 'Login con Google no configurado' })
          assert.equal((await me(base, 'x')).status, 503)
        })
      }
    } finally {
      console.error = errorOriginal
    }
  })
})

describe('GET /api/auth/me', () => {
  it('200 con el token recién emitido', async () => {
    await conServidor({ authConfig: CONFIG, googleVerifier: verificadorFalso() }, async (base) => {
      const { token, user } = await (await login(base, { credential: 'credencial-valida' })).json()
      const respuesta = await me(base, token)
      assert.equal(respuesta.status, 200)
      assert.deepEqual(await respuesta.json(), { user })
    })
  })

  it('401 sin header, con otro esquema o con firma alterada', async () => {
    await conServidor({ authConfig: CONFIG, googleVerifier: verificadorFalso() }, async (base) => {
      const { token } = await (await login(base, { credential: 'credencial-valida' })).json()
      const casos = [
        await fetch(`${base}/api/auth/me`),
        await fetch(`${base}/api/auth/me`, { headers: { Authorization: `Basic ${token}` } }),
        await me(base, `${token.slice(0, -2)}xx`),
      ]
      for (const respuesta of casos) {
        assert.equal(respuesta.status, 401)
        assert.deepEqual(await respuesta.json(), { error: 'Sesión inválida o expirada' })
      }
    })
  })

  it('401 con token expirado (reloj inyectado)', async () => {
    let reloj = AHORA
    const opciones = { authConfig: CONFIG, googleVerifier: verificadorFalso(), ahora: () => reloj }
    await conServidor(opciones, async (base) => {
      const { token } = await (await login(base, { credential: 'credencial-valida' })).json()
      reloj += 8 * 3600 * 1000
      assert.equal((await me(base, token)).status, 401)
    })
  })
})

describe('POST /api/auth/logout', () => {
  it('204 sin cuerpo, con o sin token y aunque falte configuración', async () => {
    for (const opciones of [{ authConfig: CONFIG, googleVerifier: verificadorFalso() }, {}]) {
      await conServidor(opciones, async (base) => {
        for (const headers of [{}, { Authorization: 'Bearer cualquiera' }]) {
          const respuesta = await fetch(`${base}/api/auth/logout`, { method: 'POST', headers })
          assert.equal(respuesta.status, 204)
          assert.equal(await respuesta.text(), '')
        }
      })
    }
  })
})

describe('catálogo sin variables de auth', () => {
  it('/api/licitaciones sigue respondiendo 200', async () => {
    const sinAuth = { googleClientId: '', jwtSecret: '', authTokenTtlHoras: 8 }
    assert.equal(loginConfigurado(sinAuth), false)
    await conServidor({ authConfig: sinAuth }, async (base) => {
      const respuesta = await fetch(`${base}/api/licitaciones`)
      assert.equal(respuesta.status, 200)
      assert.equal((await respuesta.json()).length, 6)
    })
  })
})
