import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync, sign } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { createApp } from '../src/app.js'
import {
  GOOGLE_JWKS_URL,
  INTERVALO_MINIMO_DESCARGA_MS,
  TokenGoogleInvalidoError,
  createGoogleIdTokenVerifier,
} from '../src/auth/googleIdToken.js'
import {
  COOKIE_SESION,
  crearTokenSesion,
  leerCookies,
  leerTokenSesion,
} from '../src/auth/sesion.js'
import {
  createMemoryUsuariosRepository,
  createPgUsuariosRepository,
} from '../src/data/usuarios.repository.js'

const CLIENT_ID = 'cliente-de-prueba.apps.googleusercontent.com'
const AHORA = Date.UTC(2026, 10, 24, 12, 0, 0)
const SECRETO = 'secreto-solo-para-pruebas'
const ORIGEN_FRONTEND = 'https://licitacionesuv.vercel.app'

// Par de claves falso: hace de Google sin red ni cuentas reales
const google = generateKeyPairSync('rsa', { modulusLength: 2048 })
const intruso = generateKeyPairSync('rsa', { modulusLength: 2048 })
const jwk = { ...google.publicKey.export({ format: 'jwk' }), kid: 'clave-1', alg: 'RS256' }

function b64(objeto) {
  return Buffer.from(JSON.stringify(objeto)).toString('base64url')
}

function firmarToken(carga = {}, { cabecera = {}, clave = google.privateKey } = {}) {
  const inicio = `${b64({ alg: 'RS256', kid: 'clave-1', typ: 'JWT', ...cabecera })}.${b64({
    iss: 'https://accounts.google.com',
    aud: CLIENT_ID,
    sub: '1234567890',
    email: 'ana@uv.cl',
    email_verified: true,
    name: 'Ana Pérez',
    exp: AHORA / 1000 + 3600,
    ...carga,
  })}`
  return `${inicio}.${sign('RSA-SHA256', Buffer.from(inicio), clave).toString('base64url')}`
}

function fetchClaves(claves = [jwk]) {
  const llamadas = []
  const fetchImpl = async (url) => {
    llamadas.push(url)
    return { ok: true, status: 200, json: async () => ({ keys: claves }) }
  }
  return { fetchImpl, llamadas }
}

function verificador(fetchImpl = fetchClaves().fetchImpl) {
  return createGoogleIdTokenVerifier({ clientId: CLIENT_ID, fetchImpl, ahora: () => AHORA })
}

describe('createGoogleIdTokenVerifier', () => {
  it('acepta un ID token válido y devuelve sub, correo y nombre', async () => {
    const { fetchImpl, llamadas } = fetchClaves()
    assert.deepEqual(await verificador(fetchImpl).verificar(firmarToken()), {
      googleSub: '1234567890',
      email: 'ana@uv.cl',
      nombre: 'Ana Pérez',
    })
    assert.deepEqual(llamadas, [GOOGLE_JWKS_URL])
  })

  it('reutiliza las claves descargadas', async () => {
    const { fetchImpl, llamadas } = fetchClaves()
    const v = verificador(fetchImpl)
    await v.verificar(firmarToken())
    await v.verificar(firmarToken())
    assert.equal(llamadas.length, 1)
  })

  const casosInvalidos = [
    ['audiencia de otro cliente', () => firmarToken({ aud: 'otro-cliente' }), 'audiencia'],
    ['token expirado', () => firmarToken({ exp: AHORA / 1000 - 120 }), 'expirado'],
    ['correo no verificado', () => firmarToken({ email_verified: false }), 'correo no verificado'],
    ['emisor que no es Google', () => firmarToken({ iss: 'https://evil.example' }), 'emisor'],
    ['firmado con otra clave', () => firmarToken({}, { clave: intruso.privateKey }), 'firma'],
    [
      'clave desconocida',
      () => firmarToken({}, { cabecera: { kid: 'otra' } }),
      'clave desconocida',
    ],
    ['algoritmo none', () => firmarToken({}, { cabecera: { alg: 'none' } }), 'algoritmo'],
    ['texto que no es JWT', () => 'no-es-un-token', 'formato'],
  ]
  for (const [nombre, crear, motivo] of casosInvalidos) {
    it(`rechaza: ${nombre}`, async () => {
      await assert.rejects(verificador().verificar(crear()), (error) => {
        assert.ok(error instanceof TokenGoogleInvalidoError)
        assert.equal(error.motivo, motivo)
        return true
      })
    })
  }

  it('un kid inventado no fuerza descargas repetidas de las claves', async () => {
    let reloj = AHORA
    const { fetchImpl, llamadas } = fetchClaves()
    const v = createGoogleIdTokenVerifier({ clientId: CLIENT_ID, fetchImpl, ahora: () => reloj })
    const tokenFalso = firmarToken({}, { cabecera: { kid: 'inventado' } })
    for (let i = 0; i < 5; i++) {
      await assert.rejects(v.verificar(tokenFalso), TokenGoogleInvalidoError)
    }
    assert.equal(llamadas.length, 1, 'cinco tokens falsos, una sola descarga')
    reloj += INTERVALO_MINIMO_DESCARGA_MS + 1000
    await assert.rejects(v.verificar(tokenFalso), TokenGoogleInvalidoError)
    assert.equal(llamadas.length, 2, 'pasado el intervalo, se permite una descarga más')
  })

  it('sigue aceptando una clave nueva cuando Google rota sus claves', async () => {
    let reloj = AHORA
    let claves = []
    const llamadas = []
    const fetchImpl = async (url) => {
      llamadas.push(url)
      return { ok: true, status: 200, json: async () => ({ keys: claves }) }
    }
    const v = createGoogleIdTokenVerifier({ clientId: CLIENT_ID, fetchImpl, ahora: () => reloj })
    await assert.rejects(v.verificar(firmarToken()), TokenGoogleInvalidoError)
    claves = [jwk]
    reloj += INTERVALO_MINIMO_DESCARGA_MS + 1000
    assert.equal((await v.verificar(firmarToken({ exp: reloj / 1000 + 3600 }))).email, 'ana@uv.cl')
    assert.equal(llamadas.length, 2)
  })

  it('las verificaciones simultáneas comparten una sola descarga', async () => {
    const { fetchImpl, llamadas } = fetchClaves()
    const v = verificador(fetchImpl)
    await Promise.all([1, 2, 3].map(() => v.verificar(firmarToken())))
    assert.equal(llamadas.length, 1)
  })

  it('exige el Client ID', () => {
    assert.throws(() => createGoogleIdTokenVerifier({ clientId: '' }), /GOOGLE_CLIENT_ID/)
  })
})

describe('token de sesión', () => {
  const usuario = { id: 'u-1', email: 'ana@uv.cl', nombre: 'Ana' }

  it('se lee de vuelta mientras está vigente', () => {
    const sesion = leerTokenSesion(crearTokenSesion(usuario, SECRETO, AHORA), SECRETO, AHORA)
    assert.equal(sesion.sub, 'u-1')
    assert.equal(sesion.email, 'ana@uv.cl')
  })

  it('rechaza un token alterado, vencido o firmado con otro secreto', () => {
    const token = crearTokenSesion(usuario, SECRETO, AHORA)
    const [carga, firma] = token.split('.')
    const otraCarga = Buffer.from(JSON.stringify({ sub: 'admin', exp: 9e9 })).toString('base64url')
    assert.equal(leerTokenSesion(`${otraCarga}.${firma}`, SECRETO, AHORA), null)
    assert.equal(leerTokenSesion(`${carga}.${firma}x`, SECRETO, AHORA), null)
    assert.equal(leerTokenSesion(token, 'otro-secreto', AHORA), null)
    assert.equal(leerTokenSesion(token, SECRETO, AHORA + 9 * 3600 * 1000), null)
    assert.equal(leerTokenSesion(undefined, SECRETO, AHORA), null)
  })

  it('lee las cookies de la cabecera', () => {
    assert.deepEqual(leerCookies('a=1; licitacionesuv_sesion=x.y; b'), {
      a: '1',
      licitacionesuv_sesion: 'x.y',
    })
  })
})

describe('repositorios de usuarios', () => {
  it('en memoria, la misma cuenta de Google conserva su id', async () => {
    const repo = createMemoryUsuariosRepository()
    const primero = await repo.registrarGoogle({ googleSub: 's1', email: 'a@uv.cl', nombre: 'A' })
    const segundo = await repo.registrarGoogle({ googleSub: 's1', email: 'a@uv.cl', nombre: 'A2' })
    assert.equal(primero.id, segundo.id)
    assert.equal((await repo.findById(primero.id)).nombre, 'A2')
    assert.equal(await repo.findById('no-existe'), null)
  })

  it('en PostgreSQL busca por sub, luego vincula por correo y si no, crea', async () => {
    const consultas = []
    const respuestas = [
      { rows: [] },
      { rows: [] },
      { rows: [{ id: 'u-9', nombre: 'A', email: 'a@uv.cl', proveedor_auth: 'google' }] },
    ]
    const db = {
      query: async (consulta) => {
        consultas.push(consulta)
        return respuestas.shift()
      },
    }
    const usuario = await createPgUsuariosRepository(db).registrarGoogle({
      googleSub: 's1',
      email: 'a@uv.cl',
      nombre: 'A',
    })
    assert.deepEqual(usuario, { id: 'u-9', nombre: 'A', email: 'a@uv.cl', proveedor: 'google' })
    assert.match(consultas[0].text, /WHERE google_sub = \$1/)
    assert.match(consultas[1].text, /lower\(email\) = lower\(\$3\) AND google_sub IS NULL/)
    assert.match(consultas[2].text, /INSERT INTO usuarios/)
    // Siempre con parámetros, nunca interpolando valores
    for (const consulta of consultas) assert.ok(!consulta.text.includes('a@uv.cl'))
  })

  it('la migración 005 agrega google_sub único', async () => {
    const sql = await readFile(
      new URL('../migrations/postgresql/005_usuarios_google.sql', import.meta.url),
      'utf8',
    )
    assert.match(sql, /ADD COLUMN google_sub TEXT/)
    assert.match(sql, /CREATE UNIQUE INDEX usuarios_google_sub_unico ON usuarios \(google_sub\)/)
  })
})

describe('rutas /api/auth', () => {
  async function conServidor(opciones, prueba) {
    const server = createServer(createApp(opciones))
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    try {
      await prueba(`http://127.0.0.1:${server.address().port}`)
    } finally {
      await new Promise((resolve) => server.close(resolve))
    }
  }

  const verificadorFalso = {
    async verificar(credential) {
      if (credential !== 'token-bueno') throw new TokenGoogleInvalidoError('firma')
      return { googleSub: 's1', email: 'ana@uv.cl', nombre: 'Ana' }
    },
  }
  const configurado = () => ({
    verificadorGoogle: verificadorFalso,
    usuariosRepository: createMemoryUsuariosRepository(),
    secretoSesion: SECRETO,
    origenPermitido: ORIGEN_FRONTEND,
  })

  function postJson(url, body) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('login → me → logout con cookie HttpOnly, Secure y SameSite=None', async () => {
    await conServidor(configurado(), async (base) => {
      const login = await postJson(`${base}/api/auth/google`, { credential: 'token-bueno' })
      assert.equal(login.status, 200)
      const { usuario } = await login.json()
      assert.equal(usuario.email, 'ana@uv.cl')
      const setCookie = login.headers.get('set-cookie')
      assert.match(setCookie, new RegExp(`^${COOKIE_SESION}=`))
      for (const atributo of ['HttpOnly', 'Secure', 'SameSite=None', 'Path=/']) {
        assert.ok(setCookie.includes(atributo), atributo)
      }
      const cookie = setCookie.split(';')[0]

      const me = await fetch(`${base}/api/auth/me`, { headers: { Cookie: cookie } })
      assert.equal(me.status, 200)
      assert.deepEqual((await me.json()).usuario, usuario)

      const logout = await fetch(`${base}/api/auth/logout`, { method: 'POST' })
      assert.equal(logout.status, 204)
      assert.match(logout.headers.get('set-cookie'), /Max-Age=0/)
    })
  })

  it('responde 401 sin sesión, con un token inválido y 400 sin credential', async () => {
    await conServidor(configurado(), async (base) => {
      assert.equal((await fetch(`${base}/api/auth/me`)).status, 401)
      const cookieFalsa = `${COOKIE_SESION}=abc.def`
      assert.equal(
        (await fetch(`${base}/api/auth/me`, { headers: { Cookie: cookieFalsa } })).status,
        401,
      )
      assert.equal((await postJson(`${base}/api/auth/google`, { credential: 'malo' })).status, 401)
      assert.equal((await postJson(`${base}/api/auth/google`, {})).status, 400)
    })
  })

  it('sin GOOGLE_CLIENT_ID o JWT_SECRET responde 503 y el resto de la API sigue', async () => {
    // El 503 se registra con console.error (como todo 5xx); se silencia solo en esta prueba
    const errorOriginal = console.error
    console.error = () => {}
    await conServidor({ verificadorGoogle: null, secretoSesion: '' }, async (base) => {
      assert.equal((await postJson(`${base}/api/auth/google`, { credential: 'x' })).status, 503)
      assert.equal((await fetch(`${base}/api/auth/me`)).status, 503)
      assert.equal((await fetch(`${base}/api/licitaciones`)).status, 200)
    }).finally(() => {
      console.error = errorOriginal
    })
  })

  it('CSRF: rechaza el login que no viene como JSON', async () => {
    await conServidor(configurado(), async (base) => {
      for (const tipo of [
        'text/plain',
        'application/x-www-form-urlencoded',
        'multipart/form-data',
      ]) {
        const respuesta = await fetch(`${base}/api/auth/google`, {
          method: 'POST',
          headers: { 'Content-Type': tipo },
          body: JSON.stringify({ credential: 'token-bueno' }),
        })
        assert.equal(respuesta.status, 415, tipo)
        assert.equal(respuesta.headers.get('set-cookie'), null, tipo)
      }
    })
  })

  it('CSRF: rechaza login y logout desde otro origen y acepta el del frontend', async () => {
    await conServidor(configurado(), async (base) => {
      const login = (origen) =>
        fetch(`${base}/api/auth/google`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Origin: origen },
          body: JSON.stringify({ credential: 'token-bueno' }),
        })
      const ajeno = await login('https://sitio-malicioso.example')
      assert.equal(ajeno.status, 403)
      assert.equal(ajeno.headers.get('set-cookie'), null)
      assert.equal((await login(ORIGEN_FRONTEND)).status, 200)
      const logoutAjeno = await fetch(`${base}/api/auth/logout`, {
        method: 'POST',
        headers: { Origin: 'https://sitio-malicioso.example' },
      })
      assert.equal(logoutAjeno.status, 403)
    })
  })

  it('CORS permite credenciales para el origen configurado', async () => {
    await conServidor(configurado(), async (base) => {
      const preflight = await fetch(`${base}/api/auth/google`, { method: 'OPTIONS' })
      assert.equal(preflight.status, 204)
      assert.equal(preflight.headers.get('access-control-allow-credentials'), 'true')
      assert.notEqual(preflight.headers.get('access-control-allow-origin'), '*')
    })
  })
})
