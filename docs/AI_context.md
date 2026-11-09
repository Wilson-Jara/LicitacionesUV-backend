# Contexto técnico — LicitacionesUV Backend

Leer primero `AGENTS.md`. Idioma del proyecto: español. API independiente del
frontend, con catálogo ficticio propio y sin lecturas de archivos del cliente.

## Estado y estructura

API REST sobre `node:http` y PostgreSQL 16 con el driver `pg` 8.23.1.
`src/server.js` selecciona `createPgLicitacionesRepository` con `DATABASE_URL`;
sin ella usa el catálogo propio en memoria, conservando el comportamiento original.
El servidor no aplica migraciones ni seed al arrancar y cierra el pool al terminar.
No se usa SQLite en el código activo ni hay conversión automática de datos anteriores.

`src/lib/` contiene router y helpers HTTP; `src/routes/` registra salud, listado
filtrado y detalle. Los errores de entrada devuelven 400, 404 o 413; los internos
responden 500 genérico. El detalle comprueba la invariante del identificador.

`src/data/licitaciones.repository.js` conserva la interfaz asíncrona y el contrato
de nueve campos. SQL parametrizado, búsqueda literal solo por título y comparación
sin distinguir mayúsculas. La ruta HTTP recorta espacios externos de keyword.
El monto se convierte de BIGINT a número y la fecha se entrega como YYYY-MM-DD.
`src/data/licitaciones.mock.json` contiene seis ejemplos propios.

`migrations/postgresql/` es la línea activa de ocho entidades y catálogo de regiones.
El migrador registra cada archivo en la misma transacción que su SQL; el seed hace
upsert en una transacción. `migrations/sqlite/` y `migrations/legacy-postgresql/`
se conservan sin cambios como archivo histórico y no se ejecutan.

## Stack, comandos y configuración

Node >= 22.22.0, npm >= 10, ES modules. Única dependencia de producción: `pg` 8.23.1.
ESLint y Prettier son herramientas de desarrollo, con versiones exactas.

- `npm ci`: instalación reproducible desde esta raíz.
- `npm run dev` / `npm start`: servidor con / sin recarga.
- `npm run db:setup`: migraciones y catálogo ficticio; requiere DATABASE_URL.
- `npm run db:migrate`, `npm run db:seed`: operaciones independientes con conexión.
- `npm run verify`: lint + formato + pruebas; no requiere build.
- `npm run test:coverage`: mínimo 70 % líneas, 70 % funciones y 60 % ramas.

`.env.example` documenta PORT, CORS_ORIGIN, DATABASE_URL, DATABASE_URL_TEST
y JWT_SECRET reservada.
No leer ni modificar `.env` reales, secretos ni bases de desarrollo sin autorización.
PostgreSQL se instala directamente en el equipo. La preparación manual del
usuario y las bases de desarrollo y pruebas se describe en `docs/PostgreSQL.md`.

CI usa Node 22.22.0 y PostgreSQL 16 instalado directamente en Ubuntu 24.04, con
una base propia, socket Unix y autenticación local sin contraseña. Las pruebas de integración y comandos
requieren DATABASE_URL_TEST con nombre de base terminado en _test; sin ella se
omiten explícitamente. Cada suite crea y elimina un esquema único, nunca public.
Las pruebas unitarias y HTTP no necesitan PostgreSQL. Ver `docs/cobertura.md`.

La prueba del servidor real valida la terminación por SIGTERM en Windows
(código null y señal SIGTERM). En Linux comprueba el cierre ordenado con código 0
y sin señal de terminación; Windows no acredita ese cierre ordenado.

## Integración y documentación

El frontend Vite vive por separado y aún usa su mock, sin consumir VITE_API_BASE_URL.
CORS permite por defecto http://localhost:5173. No hay importador de Mercado Público,
sesiones ni endpoints de escritura para usuarios, favoritos o aprobaciones.

`docs/README.md`, `PostgreSQL.md`, `ModeloDatos.md`, `api/` y `CONTRIBUTING.md`
describen operación, contratos y reglas. `SQLite.md` se identifica como guía histórica.
Los requisitos compartidos describen el producto completo, no funciones ya
implementadas en esta API. Las validaciones locales no acreditan CI remoto.

## Reglas de trabajo para futuras IAs

Aplicar AGENTS.md: pedir confirmación específica antes de cada comando Git/gh y
cada efecto externo. Editar archivos solo con autorización explícita. No tocar
secretos, `.env` reales ni decisiones de producción sin autorización humana.
Leer README, package.json y archivos afectados antes de editar. Mantener dos
espacios, comillas simples y código sin punto y coma. No editar migraciones ya
aplicadas; agregar nuevas a la línea activa. Actualizar este contexto cuando
cambie el estado técnico, sin añadir planificación privada. Ejecutar verify y
cobertura y revisar el diff antes de entregar.

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
