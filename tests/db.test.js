import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDatabase, withDatabase } from '../src/db/connection.js'
import { listMigrationFiles, runMigrations, migrationsDir } from '../src/db/migrator.js'
import { seedLicitaciones } from '../src/db/seed.js'
import { loadMockLicitaciones } from '../src/data/mockLicitaciones.js'

const mock = loadMockLicitaciones()

describe('conexión SQLite', () => {
  let dir
  before(async () => {
    dir = await mkdtemp(join(tmpdir(), 'uv-conexion-'))
  })
  after(async () => {
    await rm(dir, { recursive: true, force: true })
  })
  it('rechaza una ruta vacía', () => {
    for (const value of ['', ' ', undefined])
      assert.throws(() => openDatabase(value), /DATABASE_PATH/)
  })
  it('conserva datos al cerrar y reabrir un archivo y activa WAL y claves foráneas', async () => {
    const path = join(dir, 'subcarpeta', 'persistencia.sqlite')
    await withDatabase(path, (db) => {
      assert.equal(db.prepare('PRAGMA foreign_keys').get().foreign_keys, 1)
      assert.equal(db.prepare('PRAGMA journal_mode').get().journal_mode, 'wal')
      assert.equal(db.prepare('PRAGMA busy_timeout').get().timeout, 5000)
      db.exec("CREATE TABLE ejemplo (valor TEXT); INSERT INTO ejemplo VALUES ('persistente')")
    })
    await withDatabase(path, (db) =>
      assert.equal(db.prepare('SELECT valor FROM ejemplo').get().valor, 'persistente'),
    )
  })
  it('cierra la conexión aunque la tarea lance un error', async () => {
    let connection
    await assert.rejects(
      withDatabase(':memory:', (db) => {
        connection = db
        throw new Error('fallo esperado')
      }),
      /fallo esperado/,
    )
    assert.equal(connection.isOpen, false)
  })
})

describe('migraciones y seed SQLite', () => {
  let db
  let dir
  before(async () => {
    db = openDatabase(':memory:')
    dir = await mkdtemp(join(tmpdir(), 'uv-migraciones-'))
  })
  after(async () => {
    db.close()
    await rm(dir, { recursive: true, force: true })
  })
  it('usa la línea SQLite y aplica las ocho entidades y el catálogo', async () => {
    assert.deepEqual(await listMigrationFiles(migrationsDir), [
      '001_esquema_inicial.sql',
      '002_catalogo_regiones.sql',
    ])
    assert.equal((await runMigrations(db)).length, 2)
    const tables = db
      .prepare("SELECT name FROM sqlite_schema WHERE type = 'table'")
      .all()
      .map((r) => r.name)
    for (const name of [
      'usuarios',
      'licitaciones',
      'favoritos',
      'regiones',
      'unidades',
      'aprobaciones',
      'delegaciones',
      'umbrales_aprobacion',
    ])
      assert.ok(tables.includes(name), name)
    const regions = db
      .prepare('SELECT id FROM regiones')
      .all()
      .map((r) => r.id)
    for (const region of new Set(mock.map((l) => l.region)))
      assert.ok(regions.includes(region), region)
  })
  it('omite migraciones ya aplicadas sin duplicar el registro', async () => {
    assert.deepEqual(await runMigrations(db), [])
    assert.equal(db.prepare('SELECT count(*) AS total FROM schema_migrations').get().total, 2)
  })
  it('revierte el archivo SQL fallido y conserva migraciones anteriores', async () => {
    await writeFile(join(dir, '001_primera.sql'), 'CREATE TABLE valida (id INTEGER);')
    await writeFile(
      join(dir, '002_fallida.sql'),
      'CREATE TABLE parcial (id INTEGER); SQL INVALIDO;',
    )
    await writeFile(join(dir, 'notas.txt'), 'ignorado')
    const other = openDatabase(':memory:')
    try {
      await assert.rejects(runMigrations(other, dir), /Falló la migración 002_fallida.sql/)
      assert.ok(other.prepare("SELECT name FROM sqlite_schema WHERE name = 'valida'").get())
      assert.equal(
        other.prepare("SELECT name FROM sqlite_schema WHERE name = 'parcial'").get(),
        undefined,
      )
      assert.deepEqual(
        other
          .prepare('SELECT nombre FROM schema_migrations')
          .all()
          .map((r) => r.nombre),
        ['001_primera.sql'],
      )
      assert.equal(other.isTransaction, false)
    } finally {
      other.close()
    }
  })
  it('carga el seed de forma idempotente y actualiza registros existentes', async () => {
    assert.equal(await seedLicitaciones(db, mock), mock.length)
    await seedLicitaciones(db, mock)
    assert.equal(db.prepare('SELECT count(*) AS total FROM licitaciones').get().total, mock.length)
    await seedLicitaciones(db, [{ ...mock[0], title: 'Título actualizado' }])
    assert.equal(
      db.prepare('SELECT titulo FROM licitaciones WHERE id = ?').get(mock[0].id).titulo,
      'Título actualizado',
    )
  })
  it('revierte todas las inserciones y actualizaciones si falla el seed', async () => {
    const before = db.prepare('SELECT titulo FROM licitaciones WHERE id = ?').get(mock[0].id).titulo
    await assert.rejects(
      seedLicitaciones(db, [
        { ...mock[0], title: 'No debe persistir' },
        { ...mock[1], id: 'invalida', region: 'no-existe' },
      ]),
      /Falló la carga del seed/,
    )
    assert.equal(
      db.prepare('SELECT titulo FROM licitaciones WHERE id = ?').get(mock[0].id).titulo,
      before,
    )
    assert.equal(db.prepare('SELECT id FROM licitaciones WHERE id = ?').get('invalida'), undefined)
    assert.equal(db.isTransaction, false)
  })
})
