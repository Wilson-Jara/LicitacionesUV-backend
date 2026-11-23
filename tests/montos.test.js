import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { createApp } from '../src/app.js'
import { MONTO_MAXIMO, MontoFueraDeRangoError, montoDelContrato } from '../src/lib/montos.js'
import {
  createPgLicitacionesRepository,
  mapLicitacionRow,
} from '../src/data/licitaciones.repository.js'
import { loadMockLicitaciones } from '../src/data/mockLicitaciones.js'

const fila = (monto) => ({
  id: 'licitacion-900',
  titulo: 'Monto de prueba',
  institucion: 'Universidad de Valparaíso',
  monto,
  moneda: 'CLP',
  fecha_cierre: '2026-12-31',
  tipo: 'publica',
  region_id: 'valparaiso',
  url_fuente: 'https://www.mercadopublico.cl/',
})

describe('montoDelContrato (#7)', () => {
  it('el límite es Number.MAX_SAFE_INTEGER', () => {
    assert.equal(MONTO_MAXIMO, 9007199254740991)
  })

  it('un monto dentro del rango sale intacto, también justo en el límite', () => {
    assert.equal(montoDelContrato('0'), 0)
    assert.equal(montoDelContrato('12500000'), 12500000)
    assert.equal(montoDelContrato('9007199254740991'), 9007199254740991)
    assert.equal(montoDelContrato(9007199254740991n), 9007199254740991)
  })

  it('rechaza de forma explícita el primer monto por encima del límite', () => {
    // Sin la regla, Number('9007199254740993') devolvería 9007199254740992 en silencio
    for (const valor of ['9007199254740992', '9007199254740993', '9223372036854775807']) {
      assert.throws(() => montoDelContrato(valor), MontoFueraDeRangoError, valor)
    }
  })

  it('rechaza montos negativos, decimales o que no son números', () => {
    for (const valor of ['-1', '10.5', 'abc', '', null]) {
      assert.throws(() => montoDelContrato(valor), MontoFueraDeRangoError, String(valor))
    }
  })
})

describe('lectura de montos en listado y detalle (#7)', () => {
  function repoCon(monto) {
    return createPgLicitacionesRepository({ query: async () => ({ rows: [fila(monto)] }) })
  }

  it('listado y detalle entregan el monto límite sin cambiarlo', async () => {
    const repo = repoCon('9007199254740991')
    assert.equal((await repo.list())[0].amount, 9007199254740991)
    assert.equal((await repo.findById('licitacion-900')).amount, 9007199254740991)
  })

  it('un monto fuera de rango no se entrega alterado: falla con MontoFueraDeRangoError', async () => {
    const repo = repoCon('9007199254740993')
    await assert.rejects(repo.list(), MontoFueraDeRangoError)
    await assert.rejects(repo.findById('licitacion-900'), MontoFueraDeRangoError)
    assert.throws(() => mapLicitacionRow(fila('9007199254740993')), MontoFueraDeRangoError)
  })

  it('la API responde 500 genérico en vez de un monto incorrecto', async () => {
    const server = createServer(createApp({ licitacionesRepository: repoCon('9007199254740993') }))
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    const errorOriginal = console.error
    console.error = () => {}
    try {
      const base = `http://127.0.0.1:${server.address().port}`
      for (const ruta of ['/api/licitaciones', '/api/licitaciones/licitacion-900']) {
        const response = await fetch(base + ruta)
        assert.equal(response.status, 500, ruta)
        assert.deepEqual(await response.json(), { error: 'Error interno del servidor' })
      }
    } finally {
      console.error = errorOriginal
      await new Promise((resolve) => server.close(resolve))
    }
  })

  it('el catálogo propio en memoria solo tiene montos dentro del rango', () => {
    for (const licitacion of loadMockLicitaciones()) {
      assert.ok(Number.isSafeInteger(licitacion.amount) && licitacion.amount >= 0, licitacion.id)
    }
  })

  it('la migración 004 limita los montos al mismo valor', async () => {
    const sql = await readFile(
      new URL('../migrations/postgresql/004_montos_enteros_seguros.sql', import.meta.url),
      'utf8',
    )
    assert.match(sql, /CHECK \(monto <= 9007199254740991\)/)
    assert.match(sql, /monto_minimo <= 9007199254740991/)
    assert.match(sql, /monto_maximo <= 9007199254740991/)
  })
})
