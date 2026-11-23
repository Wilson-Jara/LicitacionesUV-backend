-- Agrega sector y etiquetas al contrato de licitaciones, para que la API entregue
-- los mismos campos que el catálogo del frontend (#94, contratoLicitaciones.js).
-- La migración de montos enteros seguros (#7) va después, como 004.
--
-- sector: opcional (NULL si no aplica); etiquetas: lista obligatoria, puede ser vacía.
-- Los valores permitidos son las claves normalizadas de categorias.js del frontend.

ALTER TABLE licitaciones
  ADD COLUMN sector TEXT
    CHECK (sector IS NULL OR sector IN ('finanzas', 'infraestructura', 'tecnologia')),
  ADD COLUMN etiquetas TEXT[] NOT NULL DEFAULT '{}'
    CHECK (
      etiquetas <@ ARRAY[
        'auditoria', 'consultoria', 'desarrollo', 'equipamiento', 'finanzas', 'hardware',
        'instalaciones', 'licencias', 'mantenimiento', 'seguridad-informatica', 'software'
      ]::TEXT[]
    );
