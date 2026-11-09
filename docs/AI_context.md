# Contexto técnico — LicitacionesUV Backend

Leer primero `AGENTS.md`. Idioma del proyecto: español. Repositorio independiente
del frontend; no hay imports ni lecturas de archivos del cliente.

## Estado y estructura

API REST con `node:http`, rutas propias y SQLite nativo de Node (`node:sqlite`).
`src/server.js` abre la base, aplica migraciones pendientes y monta `createApp`
con `createSqliteLicitacionesRepository`. Expone salud, listado filtrado y detalle.
`src/lib/` contiene router y helpers HTTP; `src/routes/` registra endpoints.

`src/db/connection.js` configura claves foráneas, WAL, busy_timeout de 5000 ms y
`lower_unicode` para comparaciones equivalentes a JavaScript. Las tablas son STRICT.
Las consultas preparadas usan `?`; las fechas de dominio son texto ISO validado.
`src/data/licitaciones.repository.js` conserva la interfaz asíncrona de rutas, búsqueda
literal solo por título y contrato de nueve campos. El repositorio en memoria se
conserva para inyección en pruebas HTTP. El servidor usa siempre SQLite.

`migrations/sqlite/` es la línea activa: esquema de ocho entidades y regiones.
`migrations/legacy-postgresql/` conserva intactas las migraciones previas, sin uso
en ejecución. `src/db/migrator.js` registra cada archivo y sus cambios en la misma
transacción. `src/db/seed.js` carga el catálogo propio con upsert en una transacción.
El servidor no ejecuta seed; una base nueva queda vacía hasta cargar datos.
No hay importación automática desde bases del motor anterior.

## Stack, comandos y configuración

Node >= 22.22.0, npm >= 10, ES modules. No hay dependencias de producción externas.
Las herramientas de desarrollo son ESLint y Prettier, con versiones exactas.

- `npm ci`: instalación reproducible.
- `npm run db:setup`: migraciones y catálogo de ejemplo.
- `npm run db:migrate`, `npm run db:seed`: operaciones independientes.
- `npm run dev` / `npm start`: servidor con / sin recarga.
- `npm run verify`: lint + formato + pruebas; no requiere build.
- `npm run test:coverage`: mínimo 70 % líneas, 70 % funciones y 60 % ramas.

`.env.example` documenta PORT, CORS_ORIGIN, DATABASE_PATH y JWT_SECRET (reservada).
El archivo por defecto es `data/licitaciones.sqlite`; las rutas relativas parten
de la raíz del backend. Se crean directorios faltantes. No versionar archivos de
base de datos, auxiliares WAL ni `.env` reales. No leer ni modificar configuración
privada sin autorización humana. Mantener almacenamiento local persistente.

CI usa Node 22.22.0 y ejecuta toda la suite, con bases SQLite temporales reales;
no requiere servicios de base de datos externos ni variables de conexión de prueba.
Las pruebas no usan la base de desarrollo. Ver `docs/cobertura.md`.

La prueba del servidor real valida la terminación por SIGTERM en Windows
(código null y señal SIGTERM). En Linux comprueba el cierre ordenado con código 0
y sin señal de terminación; Windows no acredita ese cierre ordenado.

## Validación local

El 28 de octubre de 2026 pasaron verify y las 41 pruebas, incluida integración
SQLite y servidor real, sin omisiones. La cobertura local fue 94,78 % líneas,
95,73 % ramas y 97,87 % funciones. El workflow remoto no se ha ejecutado aquí.

## Integración y documentación

El frontend corre en Vite por separado y aún usa su mock, sin consumir
VITE_API_BASE_URL. CORS permite por defecto `http://localhost:5173`. Se conservan
las tablas de usuarios, favoritos, umbrales, delegaciones y aprobaciones, pero no
hay endpoints de escritura ni sesiones implementados para esas funciones.

`docs/README.md` delimita el contenido; `docs/SQLite.md`, `ModeloDatos.md`, `api/`
y `CONTRIBUTING.md` describen operación, contrato y reglas. Los requisitos y el
perfil de calidad compartidos son objetivos del producto completo; no acreditan
funciones implementadas en la API.

## Reglas de trabajo para futuras IAs

Aplicar AGENTS.md: pedir confirmación específica antes de cada comando Git/gh y
cada efecto externo. Editar archivos solo con autorización explícita. No tocar
secretos, `.env` reales ni decisiones de producción sin autorización humana.
Leer README, package.json y archivos afectados antes de editar. Mantener dos
espacios, comillas simples y código sin punto y coma. No editar migraciones ya
aplicadas; agregar nuevas a la línea activa. Actualizar este contexto cuando
cambie el estado técnico, sin añadir planificación privada. Ejecutar verify y
cobertura y revisar el diff antes de entregar.
