import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { loadMockLicitaciones } from '../src/data/mockLicitaciones.js'
import { crearBaseDePrueba, motivoParaOmitir } from './helpers/postgres.js'

const exec = promisify(execFile)
const projectRoot = fileURLToPath(new URL('../', import.meta.url))
async function command(name, databaseUrl) {
  return exec(process.execPath, [join(projectRoot, 'scripts', name)], {
    cwd: tmpdir(),
    env: { ...process.env, DATABASE_URL: databaseUrl },
    timeout: 10000,
  })
}
async function probarServidor(databaseUrl) {
  const probe = createServer()
  await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve))
  const port = probe.address().port
  await new Promise((resolve) => probe.close(resolve))
  const child = spawn(process.execPath, [join(projectRoot, 'src/server.js')], {
    cwd: tmpdir(),
    env: { ...process.env, DATABASE_URL: databaseUrl, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const closed = once(child, 'exit')
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('El servidor no inició')), 10000)
    let output = ''
    child.stdout.on('data', (data) => {
      output += data
      if (output.includes('API LicitacionesUV escuchando')) {
        clearTimeout(timer)
        resolve()
      }
    })
    child.once('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.once('exit', () => {
      clearTimeout(timer)
      reject(new Error('El servidor terminó antes de responder'))
    })
  })
  try {
    await ready
    const response = await fetch(`http://127.0.0.1:${port}/api/licitaciones/licitacion-002`)
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), loadMockLicitaciones()[1])
  } finally {
    child.kill('SIGTERM')
    const [code] = await closed
    if (process.platform !== 'win32') assert.equal(code, 0)
  }
}

describe('comandos y servidor independiente', { timeout: 20000 }, () => {
  it('los comandos sin DATABASE_URL fallan sin crear una base', async () => {
    for (const name of ['migrate.js', 'seed.js'])
      await assert.rejects(command(name, ''), (error) => {
        assert.equal(error.code, 1)
        assert.match(error.stderr, /Falta DATABASE_URL/)
        return true
      })
  })
  it('sirve el catálogo propio sin PostgreSQL desde otra carpeta', async () => {
    await probarServidor('')
  })
  it(
    'ejecuta migraciones, seed repetido y servidor con PostgreSQL desde otra carpeta',
    { skip: motivoParaOmitir() },
    async () => {
      const fixture = await crearBaseDePrueba()
      try {
        assert.match((await command('migrate.js', fixture.url)).stdout, /Migraciones aplicadas/)
        assert.match(
          (await command('migrate.js', fixture.url)).stdout,
          /No hay migraciones pendientes/,
        )
        for (let i = 0; i < 2; i++)
          assert.match((await command('seed.js', fixture.url)).stdout, /Seed cargado/)
        assert.equal(
          (await fixture.pool.query('SELECT count(*)::int AS total FROM licitaciones')).rows[0]
            .total,
          loadMockLicitaciones().length,
        )
        await probarServidor(fixture.url)
      } finally {
        await fixture.close()
      }
    },
  )
})
