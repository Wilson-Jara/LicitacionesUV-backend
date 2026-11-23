/**
 * Dominio de los montos del contrato público (#7).
 *
 * Los montos se guardan como `BIGINT` (hasta 9.223.372.036.854.775.807), pero el
 * contrato JSON los entrega como `number`, que solo representa enteros exactos hasta
 * `Number.MAX_SAFE_INTEGER` (9.007.199.254.740.991). Por encima de ese valor,
 * `Number('9007199254740993')` devuelve 9007199254740992: el monto cambiaría en silencio.
 *
 * Regla acordada: un monto válido es un entero entre 0 y `MONTO_MAXIMO`, ambos
 * inclusive; es la misma regla de enteros seguros que ya aplica el importador del
 * frontend (Wilson-Jara/LicitacionesUV#121). La base la exige con un `CHECK`
 * (migración 004) y la lectura la vuelve a comprobar antes de responder.
 */

/** Mayor monto representable sin pérdida en el contrato JSON. */
export const MONTO_MAXIMO = Number.MAX_SAFE_INTEGER

/** Error explícito cuando un monto almacenado no cabe en el contrato público. */
export class MontoFueraDeRangoError extends Error {
  /**
   * @param {unknown} valor - Monto recibido de la base.
   */
  constructor(valor) {
    super(`Monto fuera del rango del contrato (0 a ${MONTO_MAXIMO}): ${String(valor)}`)
    this.name = 'MontoFueraDeRangoError'
    this.valor = valor
  }
}

/**
 * Convierte un monto leído de PostgreSQL (`pg` entrega los `BIGINT` como texto) al
 * `number` del contrato, sin perder precisión.
 *
 * @param {string | number | bigint} valor - Monto tal como llega de la base.
 * @returns {number} El mismo monto como entero seguro.
 * @throws {MontoFueraDeRangoError} Si no es un entero o está fuera de 0..MONTO_MAXIMO.
 */
export function montoDelContrato(valor) {
  // BigInt('') vale 0n: se exige texto con solo dígitos (y signo) antes de convertir
  const esTextoEntero = typeof valor === 'string' && /^-?\d+$/.test(valor)
  const esNumeroEntero = typeof valor === 'number' && Number.isInteger(valor)
  if (!esTextoEntero && !esNumeroEntero && typeof valor !== 'bigint') {
    throw new MontoFueraDeRangoError(valor)
  }
  const entero = BigInt(valor)
  if (entero < 0n || entero > BigInt(MONTO_MAXIMO)) {
    throw new MontoFueraDeRangoError(valor)
  }
  return Number(entero)
}
