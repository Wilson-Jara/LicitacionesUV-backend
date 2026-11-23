import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { createApp } from '../src/app.js'
import {
  REGIONES_VALIDAS,
  TIPOS_VALIDOS,
  normalizarClave,
  normalizarFiltrosListado,
} from '../src/lib/filtrosListado.js'

const params = (query) => new URLSearchParams(query)

describe('normalizarFiltrosListado (#5)', () => {
  it('sin parámetros no aplica filtros', () => {
    assert.deepEqual(normalizarFiltrosListado(params('')), { keyword: '', region: '', tipo: '' })
  })

  it('usa el último valor válido y descarta los inválidos', () => {
    assert.equal(
      normalizarFiltrosListado(params('region=valparaiso&region=atacama')).region,
      'valparaiso',
    )
    assert.equal(normalizarFiltrosListado(params('region=atacama&region=biobio')).region, 'biobio')
    assert.equal(normalizarFiltrosListado(params('region=atacama')).region, '')
    assert.equal(normalizarFiltrosListado(params('tipo=publica&tipo=PRIVADA')).tipo, 'privada')
    assert.equal(normalizarFiltrosListado(params('tipo=licitacion')).tipo, '')
  })

  it('normaliza tildes, espacios y mayúsculas', () => {
    assert.equal(normalizarClave('  Biobío '), 'biobio')
    assert.equal(normalizarClave(undefined), '')
    assert.equal(normalizarFiltrosListado(params('tipo=P%C3%BAblica')).tipo, 'publica')
  })

  it('recorta la última palabra clave sin alterar su contenido', () => {
    assert.equal(
      normalizarFiltrosListado(params('keyword=a&keyword=%20Software%20')).keyword,
      'Software',
    )
    assert.equal(normalizarFiltrosListado(params('keyword=50%25_')).keyword, '50%_')
  })

  it('las regiones válidas coinciden con el catálogo de la migración 002', () => {
    const sql = readFileSync(
      new URL('../migrations/postgresql/002_catalogo_regiones.sql', import.meta.url),
      'utf8',
    )
    const enSql = [...sql.matchAll(/\('([a-z]+)',/g)].map((m) => m[1])
    assert.deepEqual([...enSql].sort(), [...REGIONES_VALIDAS].sort())
  })

  it('los tipos válidos coinciden con el CHECK de la tabla licitaciones', () => {
    const sql = readFileSync(
      new URL('../migrations/postgresql/001_esquema_inicial.sql', import.meta.url),
      'utf8',
    )
    assert.match(sql, /tipo IN \('publica', 'privada'\)/)
    assert.deepEqual(TIPOS_VALIDOS, ['publica', 'privada'])
  })
})

describe('contrato de la frontera HTTP: ambos repositorios reciben filtros saneados (#5)', () => {
  it('la ruta entrega al repositorio los filtros ya normalizados', async () => {
    const recibidos = []
    const repositorioEspia = {
      async list(filtros) {
        recibidos.push(filtros)
        return []
      },
      async findById() {
        return null
      },
    }
    const server = createServer(createApp({ licitacionesRepository: repositorioEspia }))
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    try {
      const base = `http://127.0.0.1:${server.address().port}`
      await fetch(
        `${base}/api/licitaciones?region=VALPARAISO&region=atacama&tipo=xx&keyword=%20de%20`,
      )
      assert.deepEqual(recibidos, [{ keyword: 'de', region: 'valparaiso', tipo: '' }])
    } finally {
      await new Promise((resolve) => server.close(resolve))
    }
  })
})
