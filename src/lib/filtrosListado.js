/**
 * Normalización de los filtros de `GET /api/licitaciones` en la frontera HTTP (#5).
 *
 * Aplica la misma regla que el explorador del frontend (`sanitizeFilterParams` en
 * `licitacionFilters.js`), para que una misma URL dé el mismo resultado en el cliente y
 * en la API:
 * - `region` y `tipo` se comparan sin tildes, sin espacios en los extremos y sin
 *   distinguir mayúsculas.
 * - Si un parámetro se repite, se recorre del último al primero y se usa el último
 *   valor válido. Si ninguno es válido (por ejemplo `region=atacama`), el filtro se
 *   ignora y no restringe el resultado.
 * - `keyword` usa el último valor recibido, recortado; la coincidencia sigue siendo
 *   literal y solo en el título (CA1 de #43).
 */

/** Regiones aceptadas: las mismas de `002_catalogo_regiones.sql` y del frontend. */
export const REGIONES_VALIDAS = ['valparaiso', 'metropolitana', 'biobio', 'antofagasta']

/** Modalidades aceptadas: las mismas del `CHECK` de la tabla `licitaciones`. */
export const TIPOS_VALIDOS = ['publica', 'privada']

/**
 * Normaliza una clave de categoría: sin tildes, sin espacios en los extremos y en minúsculas.
 *
 * @param {unknown} valor - Valor recibido en la URL.
 * @returns {string} Clave normalizada, o cadena vacía si no es texto.
 */
export function normalizarClave(valor) {
  if (typeof valor !== 'string') return ''
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

function ultimoValido(valores, permitidos) {
  for (let i = valores.length - 1; i >= 0; i--) {
    const clave = normalizarClave(valores[i])
    if (permitidos.includes(clave)) return clave
  }
  return ''
}

/**
 * Convierte los parámetros de la URL en los filtros que recibe el repositorio.
 *
 * @param {URLSearchParams} searchParams - Parámetros de la consulta, con sus repeticiones.
 * @returns {{keyword: string, region: string, tipo: string}} Filtros saneados; una cadena
 *   vacía significa que ese filtro no se aplica.
 */
export function normalizarFiltrosListado(searchParams) {
  const keywords = searchParams.getAll('keyword')
  return {
    keyword: (keywords.at(-1) ?? '').trim(),
    region: ultimoValido(searchParams.getAll('region'), REGIONES_VALIDAS),
    tipo: ultimoValido(searchParams.getAll('tipo'), TIPOS_VALIDOS),
  }
}
