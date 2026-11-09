import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createApp } from '../src/app.js'
import {
  createPgLicitacionesRepository,
  createMemoryLicitacionesRepository,
} from '../src/data/licitaciones.repository.js'
import { loadMockLicitaciones } from '../src/data/mockLicitaciones.js'
import { runMigrations } from '../src/db/migrator.js'
import { seedLicitaciones } from '../src/db/seed.js'
import { crearBaseDePrueba, motivoParaOmitir } from './helpers/postgres.js'

const migrationsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../migrations/postgresql')
const mock = loadMockLicitaciones()

describe('PostgreSQL real (integración)', { skip: motivoParaOmitir() }, () => {
  let fixture, pool, server
  before(async () => {
    fixture = await crearBaseDePrueba()
    pool = fixture.pool
  })
  after(async () => {
    if (server) {
      server.closeAllConnections()
      await new Promise((resolve) => server.close(resolve))
    }
    await fixture?.close()
  })
  it('aplica las ocho entidades y las migraciones una sola vez', async () => {
    const client = await pool.connect()
    try {
      assert.equal((await runMigrations(client, migrationsDir)).length, 2)
      assert.deepEqual(await runMigrations(client, migrationsDir), [])
      const { rows } = await client.query(
        'SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema()',
      )
      for (const name of [
        'usuarios',
        'licitaciones',
        'favoritos',
        'regiones',
        'unidades',
        'aprobaciones',
        'delegaciones',
        'umbrales_aprobacion',
      ]) {
        assert.ok(
          rows.some((r) => r.table_name === name),
          name,
        )
      }
    } finally {
      client.release()
    }
  })
  it('carga el catálogo propio con upsert idempotente y revierte una carga fallida', async () => {
    const client = await pool.connect()
    try {
      assert.equal(await seedLicitaciones(client, mock), mock.length)
      await seedLicitaciones(client, mock)
      assert.equal(
        (await client.query('SELECT count(*)::int AS total FROM licitaciones')).rows[0].total,
        mock.length,
      )
      await assert.rejects(
        seedLicitaciones(client, [
          { ...mock[0], title: 'No debe persistir' },
          { ...mock[1], id: 'invalida', region: 'no-existe' },
        ]),
        /Falló la carga del seed/,
      )
      assert.equal(
        (await client.query('SELECT titulo FROM licitaciones WHERE id = $1', [mock[0].id])).rows[0]
          .titulo,
        mock[0].title,
      )
    } finally {
      client.release()
    }
  })
  it('mantiene el contrato de nueve campos, detalle y filtros del repositorio en memoria', async () => {
    const repo = createPgLicitacionesRepository(pool)
    const memory = createMemoryLicitacionesRepository(mock)
    assert.deepEqual(await repo.list(), mock)
    assert.deepEqual(await repo.findById(mock[1].id), mock[1])
    assert.equal(await repo.findById('no-existe'), null)
    assert.equal(await repo.findById(mock[1].id.toUpperCase()), null)
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
  })
  it('busca Unicode y caracteres especiales como texto literal', async () => {
    const item = { ...mock[0], id: 'unicode', title: String.raw`EDUCACIÓN 50%_A\B` }
    const client = await pool.connect()
    try {
      await seedLicitaciones(client, [item])
      const repo = createPgLicitacionesRepository(client)
      for (const keyword of ['educación', '50%_', String.raw`a\b`])
        assert.deepEqual(await repo.list({ keyword }), [item])
      assert.deepEqual(await repo.list({ keyword: 'educacion' }), [])
    } finally {
      await client.query('DELETE FROM licitaciones WHERE id = $1', [item.id])
      client.release()
    }
  })
  it('sirve listado y detalle HTTP desde PostgreSQL', async () => {
    server = createServer(
      createApp({ licitacionesRepository: createPgLicitacionesRepository(pool) }),
    )
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    const base = `http://127.0.0.1:${server.address().port}`
    const response = await fetch(`${base}/api/licitaciones/licitacion-002`)
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), mock[1])
    assert.deepEqual(
      await (await fetch(`${base}/api/licitaciones?keyword=%20SOFTWARE%20`)).json(),
      [mock[4]],
    )
    assert.equal((await fetch(`${base}/api/licitaciones/no-existe`)).status, 404)
  })
  it('conserva claves foráneas y restricciones del modelo', async () => {
    await assert.rejects(
      pool.query(
        "INSERT INTO favoritos (usuario_id, licitacion_id) VALUES (gen_random_uuid(), 'licitacion-001')",
      ),
      /foreign key/,
    )
    const { rows } = await pool.query(
      "INSERT INTO unidades (nombre,tipo) VALUES ('Facultad de prueba','facultad') RETURNING id",
    )
    await assert.rejects(
      pool.query(
        'INSERT INTO umbrales_aprobacion (unidad_id,monto_minimo,monto_maximo,nivel_aprobador) VALUES ($1,100,100,1)',
        [rows[0].id],
      ),
      /check constraint/,
    )
    await assert.rejects(
      pool.query("INSERT INTO usuarios (nombre,email) VALUES ('A','dup@uv.cl'), ('B','DUP@uv.cl')"),
      /duplicate key/,
    )
    await assert.rejects(
      pool.query('UPDATE licitaciones SET monto = -1 WHERE id = $1', [mock[0].id]),
      /check constraint/,
    )
  })
})
