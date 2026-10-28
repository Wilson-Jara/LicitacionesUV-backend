// Dos implementaciones con la misma interfaz asíncrona:
//   list({ keyword, region, tipo }) -> Promise<Licitacion[]>
//   findById(id) -> Promise<Licitacion | null>
// Ambas devuelven el contrato del mock del frontend (REF-10).

function equalsIgnoreCase(value, expected) {
  return String(value).toLowerCase() === expected.toLowerCase()
}

// CA1 de #43: la palabra clave se busca solo en el título, igual que el frontend
function matchesKeyword(licitacion, keyword) {
  return licitacion.title.toLowerCase().includes(keyword.toLowerCase())
}

/**
 * Crea un repositorio de licitaciones que filtra en memoria un arreglo ya cargado.
 * Se usa en las pruebas y al inyectar datos de ejemplo.
 *
 * Reglas de filtrado (mismas que el repositorio SQLite y el frontend):
 * `keyword` se busca solo en el título (CA1 de #43); `region` y `tipo` deben
 * coincidir exactamente; las tres comparaciones ignoran mayúsculas y los filtros
 * se combinan con Y lógico. Un filtro vacío no restringe el resultado.
 *
 * @param {Array<object>} licitaciones - Licitaciones con el contrato del mock (REF-10).
 * @returns {{list: (filters?: {keyword?: string, region?: string, tipo?: string}) => Promise<Array<object>>, findById: (id: string) => Promise<object|null>}}
 *   Repositorio: `list` devuelve las que cumplen los filtros y `findById` la de ese
 *   `id` exacto (distingue mayúsculas) o `null`.
 */
export function createMemoryLicitacionesRepository(licitaciones) {
  return {
    async list({ keyword, region, tipo } = {}) {
      let resultado = licitaciones
      if (keyword) resultado = resultado.filter((l) => matchesKeyword(l, keyword))
      if (region) resultado = resultado.filter((l) => equalsIgnoreCase(l.region, region))
      if (tipo) resultado = resultado.filter((l) => equalsIgnoreCase(l.type, tipo))
      return resultado
    },
    async findById(id) {
      return licitaciones.find((l) => l.id === id) ?? null
    },
  }
}

const SELECT_LICITACION = `SELECT id, titulo, institucion, monto, moneda,
  fecha_cierre, tipo, region_id, url_fuente FROM licitaciones`

/** Convierte la fila SQL al contrato público de nueve campos. */
export function mapLicitacionRow(row) {
  return {
    id: row.id,
    title: row.titulo,
    amount: Number(row.monto),
    currency: row.moneda,
    institution: row.institucion,
    closingDate: row.fecha_cierre,
    type: row.tipo,
    region: row.region_id,
    sourceUrl: row.url_fuente,
  }
}

/** Búsqueda literal y Unicode: %, _ y barras se tratan como texto, no comodines. */
export function buildListQuery({ keyword, region, tipo } = {}) {
  const condiciones = []
  const values = []
  if (keyword) {
    condiciones.push('instr(lower_unicode(titulo), lower_unicode(?)) > 0')
    values.push(keyword)
  }
  if (region) {
    condiciones.push('lower_unicode(region_id) = lower_unicode(?)')
    values.push(region)
  }
  if (tipo) {
    condiciones.push('lower_unicode(tipo) = lower_unicode(?)')
    values.push(tipo)
  }
  const where = condiciones.length ? ` WHERE ${condiciones.join(' AND ')}` : ''
  return { text: `${SELECT_LICITACION}${where} ORDER BY id`, values }
}

/** Mantiene la interfaz asíncrona usada por las rutas HTTP. */
export function createSqliteLicitacionesRepository(db) {
  return {
    async list(filters) {
      const { text, values } = buildListQuery(filters)
      return db
        .prepare(text)
        .all(...values)
        .map(mapLicitacionRow)
    },
    async findById(id) {
      const row = db.prepare(`${SELECT_LICITACION} WHERE id = ?`).get(id)
      return row ? mapLicitacionRow(row) : null
    },
  }
}
