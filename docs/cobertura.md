# Pruebas y cobertura del backend

`npm run verify` integra lint, formato y pruebas con el runner nativo de Node.
`npm run test:coverage` mide los módulos cargados de `src/**/*.js` y exige
70 % de líneas, 70 % de funciones y 60 % de ramas. Node >= 22.22.0.

| Suite                             | Verificación                                                                                                    |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `health.test.js`                  | Salud del servicio                                                                                              |
| `licitaciones.test.js`            | Contrato, filtros, detalle, errores e invariante del id                                                         |
| `http.test.js`                    | JSON inválido, límite del cuerpo, CORS y parámetros inválidos                                                   |
| `licitaciones.repository.test.js` | Mapeo y SQL parametrizado; comodines literales                                                                  |
| `db.test.js`                      | Migraciones numeradas, ocho entidades, rollback y seed con dobles                                               |
| `db.integration.test.js`          | PostgreSQL real, migraciones, seed idempotente y rollback, filtros Unicode, API y restricciones                 |
| `cli.test.js`                     | Comandos sin configuración y servidor desde otra carpeta; comandos y servidor PostgreSQL con conexión de prueba |

Las pruebas PostgreSQL requieren `DATABASE_URL_TEST` y una base desechable cuyo
nombre termine en `_test`. Cada suite crea y elimina su propio esquema, sin borrar
`public`. Sin conexión se informa la omisión; CI instala PostgreSQL 16 directamente en Ubuntu 24.04 y define la conexión por
socket Unix para ejecutarlas. No usar una base de desarrollo ni datos reales.

Las pruebas HTTP aisladas y las unitarias usan el catálogo ficticio del propio
repositorio y no requieren archivos del frontend. Node mide solo módulos cargados:
el porcentaje no implica que se haya ejercitado cada archivo del proyecto.
El frontend React mantiene su suite y cobertura independientes. Ningún resultado
local acredita que el workflow remoto haya pasado.

## Validación local del 8 de noviembre de 2026

43 pruebas aprobadas, sin omisiones, con PostgreSQL 16.15 temporal y locale ICU
`es-CL`; incluidas integración, comandos y servidor real. La instalación aislada
con `npm ci` también supera verify, sin archivos del frontend. Cobertura de módulos
medidos: 96,22 % líneas, 93,69 % ramas y 100 % funciones. No se modificaron bases
de desarrollo ni se ejecutó el CI remoto. No hay build de Vite en este proyecto.

Tras cambiar la infraestructura a PostgreSQL nativo se volvió a ejecutar verify:
36 pruebas aprobadas, sin fallos; las pruebas con conexión PostgreSQL se omitieron
por no configurar DATABASE_URL_TEST en ese paso. Las 43 pruebas reales indicadas
arriba corresponden a la validación anterior de la misma aplicación. El nuevo
workflow nativo de Ubuntu no se ejecutó desde este equipo Windows.
