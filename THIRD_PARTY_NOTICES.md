# Avisos de terceros · Backend LicitacionesUV

Este proyecto se distribuye bajo la licencia MIT (ver [LICENSE](LICENSE)). Incluye o usa en ejecución los paquetes de terceros de esta lista, cada uno bajo su propia licencia. Las de desarrollo (ESLint y Prettier) no se usan en ejecución y no se listan.

La única dependencia directa de ejecución es `pg` (cliente de PostgreSQL); el resto son sus dependencias.

Lista generada el 24-11-2026 desde `package-lock.json` (dependencias que no son de desarrollo). Para regenerarla tras cambiar dependencias, revisar el campo `license` de cada paquete en `package-lock.json`.

| Paquete                                                                    | Versión | Licencia | Tipo       |
| -------------------------------------------------------------------------- | ------- | -------- | ---------- |
| [pg](https://www.npmjs.com/package/pg)                                     | 8.23.1  | MIT      | directa    |
| [pg-cloudflare](https://www.npmjs.com/package/pg-cloudflare)               | 1.4.1   | MIT      | transitiva |
| [pg-connection-string](https://www.npmjs.com/package/pg-connection-string) | 2.14.1  | MIT      | transitiva |
| [pg-int8](https://www.npmjs.com/package/pg-int8)                           | 1.0.1   | ISC      | transitiva |
| [pg-pool](https://www.npmjs.com/package/pg-pool)                           | 3.14.0  | MIT      | transitiva |
| [pg-protocol](https://www.npmjs.com/package/pg-protocol)                   | 1.16.1  | MIT      | transitiva |
| [pg-types](https://www.npmjs.com/package/pg-types)                         | 2.2.0   | MIT      | transitiva |
| [pgpass](https://www.npmjs.com/package/pgpass)                             | 1.0.5   | MIT      | transitiva |
| [postgres-array](https://www.npmjs.com/package/postgres-array)             | 2.0.0   | MIT      | transitiva |
| [postgres-bytea](https://www.npmjs.com/package/postgres-bytea)             | 1.0.1   | MIT      | transitiva |
| [postgres-date](https://www.npmjs.com/package/postgres-date)               | 1.0.7   | MIT      | transitiva |
| [postgres-interval](https://www.npmjs.com/package/postgres-interval)       | 1.2.0   | MIT      | transitiva |
| [split2](https://www.npmjs.com/package/split2)                             | 4.2.0   | ISC      | transitiva |
| [xtend](https://www.npmjs.com/package/xtend)                               | 4.0.2   | MIT      | transitiva |

## Obligaciones

- **MIT e ISC:** conservar el aviso de copyright y de licencia en las copias. La API no se empaqueta: `npm ci` instala cada paquete con su propio archivo de licencia en `node_modules/`.
