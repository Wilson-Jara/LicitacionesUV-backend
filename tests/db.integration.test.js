import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp } from '../src/app.js'
import {
  createSqliteLicitacionesRepository,
  createMemoryLicitacionesRepository,
} from '../src/data/licitaciones.repository.js'
import { loadMockLicitaciones } from '../src/data/mockLicitaciones.js'
import { runMigrations } from '../src/db/migrator.js'
import { seedLicitaciones } from '../src/db/seed.js'
import { openDatabase } from '../src/db/connection.js'

const mock = loadMockLicitaciones()

describe('SQLite real (integración, siempre activa)', () => {
  let dir, db, server, repo
  before(async () => {
    dir = await mkdtemp(join(tmpdir(), 'uv-integracion-'))
    db = openDatabase(join(dir, 'api-test.sqlite'))
    await runMigrations(db)
    await seedLicitaciones(db, mock)
    repo = createSqliteLicitacionesRepository(db)
  })
  after(async () => {
    if (server) {
      server.closeAllConnections()
      await new Promise((resolve) => server.close(resolve))
    }
    db?.close()
    await rm(dir, { recursive: true, force: true })
  })
  it('devuelve el contrato exacto del catálogo y el detalle correcto', async () => {
    assert.deepEqual(await repo.list(), mock)
    assert.deepEqual(await repo.findById(mock[1].id), mock[1])
    assert.equal(await repo.findById('no-existe'), null)
    assert.equal(await repo.findById(mock[1].id.toUpperCase()), null)
  })
  it('mantiene los filtros y la búsqueda solo en título', async () => {
    const memory = createMemoryLicitacionesRepository(mock)
    for (const filters of [
      { keyword: 'SOFTWARE' },
      { region: 'VALPARAISO', tipo: 'Publica' },
      { keyword: 'Banco' },
      { keyword: '%' },
      { keyword: '_' },
      { keyword: "'; DROP TABLE licitaciones;--" },
    ]) {
      assert.deepEqual(await repo.list(filters), await memory.list(filters))
    }
    assert.equal((await repo.list()).length, mock.length)
  })
  it('busca con tildes y trata %, _ y barras literalmente', async () => {
    const item = { ...mock[0], id: 'unicode', title: String.raw`EDUCACIÓN 50%_A\B` }
    await seedLicitaciones(db, [item])
    try {
      for (const keyword of ['educación', '50%_', String.raw`a\b`]) {
        assert.deepEqual(await repo.list({ keyword }), [item])
      }
      assert.deepEqual(await repo.list({ keyword: 'educacion' }), [])
    } finally {
      db.prepare('DELETE FROM licitaciones WHERE id = ?').run(item.id)
    }
  })
  it('sirve listado y detalle HTTP desde el archivo SQLite', async () => {
    server = createServer(createApp({ licitacionesRepository: repo }))
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    const base = `http://127.0.0.1:${server.address().port}`
    const response = await fetch(`${base}/api/licitaciones/licitacion-002`)
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), mock[1])
    const list = await fetch(`${base}/api/licitaciones?keyword=%20SOFTWARE%20`)
    assert.deepEqual(await list.json(), [mock[4]])
    assert.equal((await fetch(`${base}/api/licitaciones/no-existe`)).status, 404)
  })
  it('rechaza referencias inexistentes, montos negativos y tipos de datos incorrectos', () => {
    assert.throws(
      () =>
        db
          .prepare(
            "INSERT INTO favoritos (usuario_id, licitacion_id) VALUES ('no-existe', 'licitacion-001')",
          )
          .run(),
      /FOREIGN KEY/,
    )
    assert.throws(
      () => db.prepare('UPDATE licitaciones SET monto = -1 WHERE id = ?').run(mock[0].id),
      /CHECK/,
    )
    assert.throws(
      () => db.prepare('UPDATE licitaciones SET monto = 1.5 WHERE id = ?').run(mock[0].id),
      /INTEGER/,
    )
    for (const date of ['no-es-fecha', '2026-02-30', '2026-13-01'])
      assert.throws(
        () =>
          db.prepare('UPDATE licitaciones SET fecha_cierre = ? WHERE id = ?').run(date, mock[0].id),
        /CHECK/,
      )
  })
  it('genera identificadores y conserva restricciones de umbrales, correos y delegaciones', () => {
    const unidad = db
      .prepare(
        "INSERT INTO unidades (nombre,tipo) VALUES ('Facultad de prueba','facultad') RETURNING id",
      )
      .get()
    assert.equal(typeof unidad.id, 'string')
    assert.throws(
      () =>
        db
          .prepare(
            'INSERT INTO umbrales_aprobacion (unidad_id,monto_minimo,monto_maximo,nivel_aprobador) VALUES (?,100,100,1)',
          )
          .run(unidad.id),
      /CHECK/,
    )
    db.prepare("INSERT INTO usuarios (nombre,email) VALUES ('A','á@uv.cl')").run()
    assert.throws(
      () => db.prepare("INSERT INTO usuarios (nombre,email) VALUES ('B','Á@UV.CL')").run(),
      /UNIQUE/,
    )
    const usuario = db.prepare('SELECT id FROM usuarios').get()
    assert.throws(
      () =>
        db
          .prepare(
            'INSERT INTO delegaciones (titular_id,subrogante_id,fecha_inicio,fecha_termino) VALUES (?,?,?,?)',
          )
          .run(usuario.id, usuario.id, '2026-10-28', '2026-10-29'),
      /CHECK/,
    )
  })
  it('elimina favoritos en cascada al eliminar su usuario', () => {
    const { id } = db
      .prepare("INSERT INTO usuarios (nombre,email) VALUES ('Temporal','temp@uv.cl') RETURNING id")
      .get()
    db.prepare('INSERT INTO favoritos (usuario_id,licitacion_id) VALUES (?,?)').run(id, mock[0].id)
    db.prepare('DELETE FROM usuarios WHERE id = ?').run(id)
    assert.equal(
      db.prepare('SELECT count(*) AS n FROM favoritos WHERE usuario_id = ?').get(id).n,
      0,
    )
  })
})
