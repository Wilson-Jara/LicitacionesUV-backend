-- #7: los montos del contrato público se entregan como número JSON, que solo
-- representa enteros exactos hasta 9007199254740991 (Number.MAX_SAFE_INTEGER).
-- Se limita el BIGINT a ese rango para que ningún monto cambie al responder.
--
-- Antes de aplicarla en un entorno con datos, comprobar que no haya filas fuera
-- del rango (si las hay, la migración falla y no se aplica nada):
--   SELECT id, monto FROM licitaciones WHERE monto > 9007199254740991;
--   SELECT id, monto_minimo, monto_maximo FROM umbrales_aprobacion
--     WHERE monto_minimo > 9007199254740991 OR monto_maximo > 9007199254740991;

ALTER TABLE licitaciones
  ADD CONSTRAINT licitaciones_monto_entero_seguro
  CHECK (monto <= 9007199254740991);

ALTER TABLE umbrales_aprobacion
  ADD CONSTRAINT umbrales_montos_enteros_seguros
  CHECK (
    monto_minimo <= 9007199254740991
    AND (monto_maximo IS NULL OR monto_maximo <= 9007199254740991)
  );
