# API 1 — Buscar y filtrar licitaciones

**Historia de usuario:** #43 Buscar licitaciones por palabra clave.

```http
GET /api/licitaciones?keyword={texto}&region={region}&tipo={tipo}
```

Devuelve las licitaciones que cumplen **todos** los filtros indicados. Sin filtros devuelve el catálogo completo.

## Parámetros de consulta

Todos son opcionales. Un parámetro ausente o vacío no restringe el resultado.

| Parámetro | Ejemplo      | Regla                                                                                                                                                                                                                 |
| --------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `keyword` | `software`   | Busca el texto **solo dentro de `title`** (CA1 de #43, igual que el buscador del frontend), sin distinguir mayúsculas. Se ignoran los espacios al inicio y al final. Los caracteres `%` y `_` se buscan literalmente. |
| `region`  | `valparaiso` | Coincidencia exacta con la clave de región (`valparaiso`, `metropolitana`, `biobio` o `antofagasta`), sin distinguir mayúsculas ni tildes. Un valor fuera de esa lista se ignora.                                     |
| `tipo`    | `publica`    | Coincidencia exacta con la modalidad (`publica` o `privada`), sin distinguir mayúsculas ni tildes. Un valor fuera de esa lista se ignora.                                                                             |

Los parámetros desconocidos se ignoran.

### Parámetros repetidos, inválidos y vacíos (#5)

La API aplica **la misma regla que el explorador del frontend** (`sanitizeFilterParams`), para que una URL dé el mismo resultado en ambos. La normalización ocurre en la frontera HTTP (`src/lib/filtrosListado.js`), así que el repositorio en memoria y el de PostgreSQL reciben los mismos filtros.

| Caso                              | Ejemplo                                  | Resultado                                                          |
| --------------------------------- | ---------------------------------------- | ------------------------------------------------------------------ |
| Valor inválido                    | `region=atacama`                         | El filtro se ignora: catálogo completo, igual que en el explorador |
| Repetido, el último es inválido   | `region=valparaiso&region=atacama`       | Se usa el último **válido**: `valparaiso`                          |
| Repetido, ambos válidos           | `region=metropolitana&region=valparaiso` | Se usa el último: `valparaiso`                                     |
| Con tildes, mayúsculas o espacios | `region=%20Valparaíso%20&tipo=Pública`   | Igual que `region=valparaiso&tipo=publica`                         |
| Vacío                             | `region=&tipo=`                          | No restringe el resultado                                          |
| `keyword` repetida                | `keyword=zzz&keyword=%20software%20`     | Se usa la última, recortada: `software`                            |

La búsqueda por título sigue siendo literal y los parámetros de un solo valor válido conservan el comportamiento anterior. Lo único que cambia es que una región o un tipo inválido ya no devuelve `[]`.

## Respuestas

### `200 OK`: lista de licitaciones

```http
GET /api/licitaciones?keyword=software
```

```json
[
  {
    "id": "licitacion-005",
    "title": "Renovación de licencias de software",
    "amount": 3200000,
    "currency": "CLP",
    "institution": "Municipalidad de Viña del Mar",
    "closingDate": "2026-09-15",
    "type": "publica",
    "region": "valparaiso",
    "sector": "tecnologia",
    "etiquetas": ["software", "licencias"],
    "sourceUrl": "https://www.mercadopublico.cl/"
  }
]
```

### `200 OK`: sin coincidencias

Cuando ningún registro cumple los filtros, la respuesta es una lista vacía, no un error. El cliente decide cómo mostrar el estado "sin resultados" (CA3 de #43).

```json
[]
```

### Errores

| Código | Cuándo                                | Cuerpo                                      |
| ------ | ------------------------------------- | ------------------------------------------- |
| `500`  | Falla inesperada al obtener los datos | `{ "error": "Error interno del servidor" }` |

## Trazabilidad con la historia de usuario #43

| Criterio de #43                                                | Cómo lo cubre la API                                                                                                                          | Casos de Thunder Client |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| CA1: filtrar por coincidencia de la palabra clave en el título | `keyword` busca solo en el título, sin distinguir mayúsculas y sin espacios sobrantes; un término presente solo en la institución no coincide | TC-L02 a TC-L08         |
| CA2: la búsqueda se combina con los filtros de región y tipo   | `keyword`, `region` y `tipo` se combinan con Y lógico                                                                                         | TC-L09, TC-L10          |
| CA3: sin coincidencias se informa "sin resultados"             | Lista vacía con `200 OK`                                                                                                                      | TC-L03, TC-L05          |
| Catálogo completo sin filtros                                  | Sin parámetros devuelve todas las licitaciones                                                                                                | TC-L01                  |

El contrato de datos (los 11 campos y sus tipos) se verifica en las pruebas automatizadas del backend (`npm run verify`). El tiempo de respuesta (REF-01, menos de 2 s) se observa en el campo **Time** de cada respuesta en Thunder Client.

## Casos de prueba (colección API 1, 10 casos)

Todos son `GET` sobre `http://localhost:3000/api/licitaciones`.

| Caso   | Técnica      | Parámetros                                     | Resultado esperado                          |
| ------ | ------------ | ---------------------------------------------- | ------------------------------------------- |
| TC-L01 | Éxito        | (ninguno)                                      | `200`, 6 licitaciones                       |
| TC-L02 | Equivalencia | `keyword=software` (en el título)              | `200`, 1 licitación (`licitacion-005`)      |
| TC-L03 | Equivalencia | `keyword=Banco` (solo en una institución)      | `200`, `[]`                                 |
| TC-L04 | Negocio      | `keyword=SOFTWARE` (mayúsculas)                | `200`, 1 licitación                         |
| TC-L05 | Equivalencia | `keyword=zzz` (sin coincidencias)              | `200`, `[]`                                 |
| TC-L06 | Límite       | `keyword=` (vacío)                             | `200`, 6 licitaciones                       |
| TC-L07 | Límite       | `keyword=w` (un carácter)                      | `200`, 1 licitación                         |
| TC-L08 | Límite       | `keyword=%20%20%20` (solo espacios)            | `200`, 6 licitaciones                       |
| TC-L09 | Equivalencia | `region=atacama` (región inexistente)          | `200`, 6 licitaciones (filtro ignorado, #5) |
| TC-L10 | Negocio      | `keyword=de&region=metropolitana&tipo=publica` | `200`, 1 licitación (`licitacion-003`)      |

- **Éxito:** TC-L01.
- **Clases de equivalencia:** término en el título (L02), término presente solo en la institución, que no coincide (L03), sin coincidencias (L05) y región inexistente, que se ignora (L09).
- **Valores límite:** término vacío (L06), de un carácter (L07) y solo espacios (L08).
- **Reglas de negocio:** sin distinguir mayúsculas (L04) y combinación de filtros con Y lógico (L10).
