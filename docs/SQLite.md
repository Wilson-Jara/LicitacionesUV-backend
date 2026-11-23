> **Guía histórica.** El código activo usa PostgreSQL. Las instrucciones siguientes
> documentan la versión SQLite anterior y no son la guía de ejecución vigente.
> Consultar [PostgreSQL](PostgreSQL.md). Las bases SQLite existentes no se eliminan ni convierten.

# SQLite: configuración y uso

## Requisitos

Node >= 22.22.0 incorpora la API `DatabaseSync` de `node:sqlite` utilizada por este
proyecto. No se instala un servidor de base de datos ni un driver npm adicional.
La [documentación de Node 22.22](https://nodejs.org/download/release/v22.22.0/docs/api/sqlite.html)
describe la API nativa y su estado de desarrollo.

## Configuración

`DATABASE_PATH` indica el archivo; por defecto `./data/licitaciones.sqlite`.
Las rutas relativas parten de la raíz del backend. `:memory:` sirve para pruebas
dentro de un proceso; no sirve para compartir estado entre comandos separados.
El servidor y los scripts cargan `.env` si existe, respetando las variables ya
exportadas. Los archivos `.env` reales y los archivos SQLite quedan fuera de Git.

```bash
npm ci
npm run db:setup
npm start
```

`db:setup` aplica `migrations/sqlite/` y carga `src/data/licitaciones.mock.json`.
`db:migrate` y `db:seed` también se pueden ejecutar por separado. El seed actualiza
registros existentes: no ejecutarlo sobre datos editados que deban conservarse.
El servidor aplica migraciones pendientes al arrancar, sin volver a cargar el seed.

## Persistencia e integridad

`src/db/connection.js` crea el directorio y abre la base con claves foráneas activas,
WAL y busy_timeout de 5000 ms. Las tablas son STRICT, montos y niveles son enteros,
las fechas de dominio son texto ISO `YYYY-MM-DD` con validación de calendario y
las marcas de tiempo automáticas se guardan como texto UTC.

Los identificadores generados de usuarios, unidades, umbrales, delegaciones y
aprobaciones son texto hexadecimal aleatorio. Los ids de licitaciones se mantienen
como en el contrato público. `lower_unicode`, registrada al abrir la conexión,
permite comparar títulos, regiones, tipos y correos sin distinguir mayúsculas con
la misma conversión de JavaScript. Las escrituras que afectan ese índice de correos
requieren abrir la base mediante esta conexión del backend.

Mantener el archivo en disco local persistente. WAL permite lectura concurrente
con una escritura, pero solo hay un escritor a la vez. Para respaldar con una
copia de archivos, detener el backend y cerrar todas las conexiones antes de copiar;
conservar los archivos auxiliares si aún existen. Alternativamente usar el mecanismo
oficial de backup. Ver [WAL](https://sqlite.org/wal.html) y
[backup](https://sqlite.org/backup.html).

## Pruebas

`npm run verify` y `npm run test:coverage` incluyen integración real siempre activa,
con bases temporales independientes. No requieren conexión de red ni configuración
de una base de pruebas compartida. Ver [cobertura](cobertura.md).

## Migraciones anteriores

`migrations/legacy-postgresql/` conserva sin cambios la línea de migraciones previa.
El migrador solo usa `migrations/sqlite/`, que tiene su propio registro en la base
SQLite nueva. No se abre ni modifica una base anterior y no existe una importación
automática de sus datos. Si hay datos reales que conservar, su traslado requiere
una tarea de importación específica; no se reemplazan por el seed.
