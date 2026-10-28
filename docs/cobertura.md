# Pruebas y cobertura del backend

El runner nativo de Node ejecuta la suite completa. `npm run verify` integra lint,
formato y pruebas; `npm run test:coverage` mide los módulos cargados de `src/**/*.js`
y exige 70 % líneas, 70 % funciones y 60 % ramas. Requiere Node >= 22.22.0.

| Suite                             | Verificación                                                                                         |
| --------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `health.test.js`                  | Salud del servicio.                                                                                  |
| `licitaciones.test.js`            | Contrato, filtros, detalle, errores e invariante del id.                                             |
| `http.test.js`                    | JSON inválido, límite de cuerpo, CORS y parámetros inválidos.                                        |
| `licitaciones.repository.test.js` | Mapeo del contrato y enlaces de parámetros.                                                          |
| `db.test.js`                      | Persistencia en archivo, WAL, claves foráneas, migraciones y rollback real del seed y del esquema.   |
| `db.integration.test.js`          | SQLite real, equivalencia de filtros, Unicode, búsqueda literal, API HTTP, restricciones y cascadas. |
| `cli.test.js`                     | Comandos de migración/seed y servidor real con almacenamiento temporal.                              |

La integración se ejecuta siempre. Cada prueba crea su base en memoria o en un
archivo temporal propio y cierra y elimina solo esos recursos. No se usan archivos
de desarrollo ni conexiones configuradas por el usuario.

Node mide únicamente módulos cargados: el porcentaje no implica que cada archivo
del proyecto haya sido medido. El frontend React tiene su propia suite y cobertura.
Los resultados locales no acreditan la ejecución del workflow remoto.
