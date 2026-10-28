/** Carga el catálogo de ejemplo con upsert; cualquier fallo revierte toda la carga. */
export async function seedLicitaciones(db, licitaciones) {
  const insert = db.prepare(`INSERT INTO licitaciones
    (id, titulo, institucion, monto, moneda, fecha_cierre, tipo, region_id, url_fuente)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (id) DO UPDATE SET
      titulo = excluded.titulo, institucion = excluded.institucion,
      monto = excluded.monto, moneda = excluded.moneda,
      fecha_cierre = excluded.fecha_cierre, tipo = excluded.tipo,
      region_id = excluded.region_id, url_fuente = excluded.url_fuente`)
  db.exec('BEGIN IMMEDIATE')
  try {
    for (const l of licitaciones) {
      insert.run(
        l.id,
        l.title,
        l.institution,
        l.amount,
        l.currency,
        l.closingDate,
        l.type,
        l.region,
        l.sourceUrl,
      )
    }
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw new Error(`Falló la carga del seed de licitaciones: ${error.message}`, { cause: error })
  }
  return licitaciones.length
}
