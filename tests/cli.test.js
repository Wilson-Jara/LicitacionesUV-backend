import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { promisify } from 'node:util'
import { execFile, spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { openDatabase, projectRoot } from '../src/db/connection.js'
import { loadMockLicitaciones } from '../src/data/mockLicitaciones.js'

const exec = promisify(execFile)

describe('comandos y servidor SQLite', { timeout: 20000 }, () => {
  let dir, databasePath
  before(async () => {
    dir = await mkdtemp(join(tmpdir(), 'uv-cli-'))
    databasePath = join(dir, 'comandos.sqlite')
  })
  after(async () => {
    await rm(dir, { recursive: true, force: true })
  })
  async function command(name, path = databasePath) {
    return exec(process.execPath, [join(projectRoot, 'scripts', name)], {
      cwd: dir,
      env: { ...process.env, DATABASE_PATH: relative(projectRoot, path) },
      timeout: 10000,
    })
  }
  it('ejecuta migración y seed repetidos desde otra carpeta conservando la base', async () => {
    assert.match((await command('migrate.js')).stdout, /Migraciones aplicadas/)
    assert.match((await command('migrate.js')).stdout, /No hay migraciones pendientes/)
    for (let i = 0; i < 2; i++) assert.match((await command('seed.js')).stdout, /Seed cargado/)
    const db = openDatabase(databasePath)
    try {
      assert.equal(
        db.prepare('SELECT count(*) AS total FROM licitaciones').get().total,
        loadMockLicitaciones().length,
      )
    } finally {
      db.close()
    }
  })
  it('sirve datos persistidos con el servidor real y cierra al recibir SIGTERM', async () => {
    const probe = createServer()
    await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve))
    const port = probe.address().port
    await new Promise((resolve) => probe.close(resolve))
    const child = spawn(process.execPath, ['src/server.js'], {
      cwd: projectRoot,
      env: { ...process.env, DATABASE_PATH: databasePath, PORT: String(port) },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const closed = once(child, 'exit')
    let output = ''
    const ready = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('El servidor no inició')), 10000)
      child.stdout.on('data', (data) => {
        output += data
        if (output.includes('API LicitacionesUV escuchando')) {
          clearTimeout(timer)
          resolve()
        }
      })
      child.once('exit', (code) => {
        clearTimeout(timer)
        reject(new Error(`El servidor terminó: ${code}`))
      })
      child.once('error', (error) => {
        clearTimeout(timer)
        reject(error)
      })
    })
    try {
      await ready
      const response = await fetch(`http://127.0.0.1:${port}/api/licitaciones/licitacion-002`)
      assert.equal(response.status, 200)
      assert.deepEqual(await response.json(), loadMockLicitaciones()[1])
    } finally {
      child.kill('SIGTERM')
      const [code, signal] = await closed
      if (process.platform === 'win32') {
        // Windows termina el proceso por señal, sin ejecutar el cierre ordenado.
        assert.equal(code, null)
        assert.equal(signal, 'SIGTERM')
      } else {
        assert.equal(code, 0)
        assert.equal(signal, null)
      }
    }
  })
  it('los comandos fallan con salida de error si no pueden crear la base', async () => {
    const block = join(dir, 'archivo')
    await writeFile(block, 'no es un directorio')
    for (const name of ['migrate.js', 'seed.js']) {
      await assert.rejects(command(name, join(block, 'base.sqlite')), (error) => {
        assert.equal(error.code, 1)
        assert.match(error.stderr, /EEXIST|ENOTDIR/)
        return true
      })
    }
  })
})
