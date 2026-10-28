import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildListQuery,
  createMemoryLicitacionesRepository,
  mapLicitacionRow,
} from '../src/data/licitaciones.repository.js'
import { loadMockLicitaciones } from '../src/data/mockLicitaciones.js'

const mock = loadMockLicitaciones()

function contrato(licitacion) {
  return Object.fromEntries(
    Object.keys(licitacion)
      .sort()
      .map((campo) => [campo, typeof licitacion[campo]]),
  )
}

// Fila SQLite con fecha ISO y monto numérico.
function filaDesde(licitacion) {
  return {
    id: licitacion.id,
    titulo: licitacion.title,
    institucion: licitacion.institution,
    monto: licitacion.amount,
    moneda: licitacion.currency,
    fecha_cierre: licitacion.closingDate,
    tipo: licitacion.type,
    region_id: licitacion.region,
    url_fuente: licitacion.sourceUrl,
  }
}

describe('mapLicitacionRow', () => {
  it('devuelve exactamente el contrato del mock del frontend', () => {
    for (const licitacion of mock) {
      const mapeada = mapLicitacionRow(filaDesde(licitacion))
      assert.deepEqual(mapeada, licitacion)
      assert.deepEqual(contrato(mapeada), contrato(mock[0]))
    }
  })
})

describe('buildListQuery', () => {
  it('sin filtros consulta todo ordenado por id', () => {
    const { text, values } = buildListQuery()
    assert.doesNotMatch(text, /WHERE/)
    assert.match(text, /ORDER BY id$/)
    assert.deepEqual(values, [])
  })
  it('enlaza los valores de búsqueda sin interpolar SQL', () => {
    const keyword = "software'; DROP TABLE licitaciones;--"
    const { text, values } = buildListQuery({ keyword, region: 'VALPARAISO', tipo: 'Publica' })
    assert.equal((text.match(/\?/g) || []).length, 3)
    assert.doesNotMatch(text, /DROP TABLE/)
    assert.deepEqual(values, [keyword, 'VALPARAISO', 'Publica'])
  })
})

describe('createMemoryLicitacionesRepository', () => {
  it('filtra igual que la API (sin distinguir mayúsculas)', async () => {
    const repo = createMemoryLicitacionesRepository(mock)
    const resultado = await repo.list({ region: 'VALPARAISO', tipo: 'PUBLICA' })
    assert.ok(resultado.length > 0)
    assert.ok(resultado.every((l) => l.region === 'valparaiso' && l.type === 'publica'))
    assert.equal(await repo.findById('no-existe'), null)
  })
})
