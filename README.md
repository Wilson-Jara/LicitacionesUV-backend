# LicitacionesUV — Backend

API REST independiente con `node:http` y SQLite integrado mediante `node:sqlite`.
Requiere Node.js >= 22.22.0 y npm >= 10. No tiene dependencias de producción externas.

## Instalación y ejecución

Desde esta raíz:

```bash
npm ci
npm run db:setup
npm run dev
```

`db:setup` aplica migraciones y carga el catálogo de ejemplo. La API escucha en
`http://localhost:3000`; `npm start` la inicia sin recarga automática.

SQLite guarda la información en `data/licitaciones.sqlite`. La carpeta se crea si
falta. Opcionalmente copia `.env.example` como `.env` y configura `DATABASE_PATH`,
`PORT` y `CORS_ORIGIN`. Las rutas relativas de la base parten de esta raíz, incluso
si el comando se ejecuta desde otra carpeta.

## Endpoints

- `GET /api/health`: estado del servicio.
- `GET /api/licitaciones`: filtros `keyword` (solo título), `region` y `tipo`.
- `GET /api/licitaciones/:id`: detalle o 404.

Se conserva el contrato de nueve campos. La búsqueda ignora mayúsculas, conserva
las tildes y trata `%`, `_` y barras como texto literal. Ver [API](docs/api/README.md).

## Datos y migraciones

```bash
npm run db:migrate
npm run db:seed
```

La línea activa está en `migrations/sqlite/`. Cada archivo y su registro en
`schema_migrations` comparten una transacción. El seed hace upsert por id: repetirlo
no duplica filas, pero sí actualiza sus datos con el catálogo de ejemplo.

El servidor aplica migraciones pendientes al arrancar y no ejecuta el seed. Una
base recién creada queda vacía hasta cargar datos. Reiniciar conserva los datos.
Las migraciones anteriores se preservan como referencia histórica en
`migrations/legacy-postgresql/`; no se ejecutan. Este cambio crea una base SQLite
nueva: no importa datos desde instalaciones previas de otro motor.

## Pruebas y CI

```bash
npm run verify
npm run test:coverage
```

Las pruebas unitarias, HTTP e integración SQLite se ejecutan siempre. Crean bases
propias en memoria o archivos temporales y las retiran al terminar; no usan la
base de desarrollo ni necesitan variables de conexión. El CI solo instala Node y
las herramientas de desarrollo. No hay build: Node ejecuta el JavaScript directamente.

## Operación

SQLite activa claves foráneas, modo WAL y espera de bloqueos de hasta cinco segundos.
Usa disco local persistente para el archivo y sus auxiliares; no compartas el archivo
directamente entre servidores. Realiza copias consistentes con el backend detenido
o mediante una herramienta de backup de SQLite. Los archivos de base de datos no
se publican en Git. Ver [guía SQLite](docs/SQLite.md).

## Frontend y documentación

El frontend `LicitacionesUV` sigue usando su mock local; la integración HTTP no está
implementada. Para desarrollar, inicia Vite en otra terminal y configura CORS_ORIGIN
con su origen (por defecto `http://localhost:5173`).

Ver [índice de documentación](docs/README.md), [arquitectura](docs/Arquitectura.md),
[modelo de datos](docs/ModeloDatos.md), [CONTRIBUTING.md](CONTRIBUTING.md),
[AGENTS.md](AGENTS.md) y [contexto técnico](docs/AI_context.md).
