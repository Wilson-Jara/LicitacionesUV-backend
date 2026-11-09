# LicitacionesUV — Backend

API REST independiente con `node:http` y PostgreSQL 16 mediante `pg`.
Requiere Node.js >= 22.22.0 y npm >= 10. El frontend vive en otro repositorio;
este proyecto contiene su propio catálogo de seis licitaciones ficticias.

## Instalación y ejecución rápida

Desde la raíz de este repositorio:

```bash
npm ci
npm start
```

Sin `DATABASE_URL`, el servidor usa `src/data/licitaciones.mock.json` en memoria.
Esto conserva el comportamiento del backend original y permite probar la API sin
PostgreSQL. La API escucha por defecto en `http://localhost:3000`;
`npm run dev` agrega recarga automática.

## PostgreSQL y persistencia

1. Instalar e iniciar PostgreSQL 16 directamente en el equipo, usando el
   [instalador o paquete oficial](https://www.postgresql.org/download/).
2. Crear un usuario local y dos bases separadas, `licitaciones_db` para desarrollo
   y `licitaciones_test` para pruebas, con UTF-8 y un locale que convierta
   mayúsculas Unicode. Una persona configura `DATABASE_URL` y, opcionalmente,
   `DATABASE_URL_TEST` en su `.env` local usando `.env.example` como referencia.
   El archivo real no se versiona. Ver [configuración detallada](docs/PostgreSQL.md).
3. Aplicar el esquema y cargar exclusivamente datos de ejemplo:

   ```bash
   npm run db:setup
   npm start
   ```

`db:setup` equivale a `db:migrate` seguido de `db:seed`. Ambos comandos necesitan
`DATABASE_URL`; sin ella fallan con un mensaje y código de error. El servidor no
aplica migraciones ni ejecuta el seed al arrancar. Una base sin registros devuelve
un listado vacío. El seed hace upsert por identificador y actualiza registros:
no ejecutarlo sobre datos que deban conservarse sin revisar su efecto.

La línea activa es `migrations/postgresql/`. Cada migración y su registro se
aplican en una transacción. Las migraciones previas se conservan sin cambios en
`migrations/legacy-postgresql/` y `migrations/sqlite/` como archivo histórico; el
migrador no recorre esas carpetas. No hay conversión automática de archivos SQLite
ni se abre, borra o importa una base anterior. Ver [guía PostgreSQL](docs/PostgreSQL.md).

## Endpoints

- `GET /api/health`: estado del servicio.
- `GET /api/licitaciones`: filtros combinados `keyword` (solo título), `region` y `tipo`.
- `GET /api/licitaciones/:id`: detalle por identificador exacto o 404.

Se conserva el contrato de nueve campos y la búsqueda literal sin distinguir
mayúsculas; `%`, `_` y barras se buscan como texto. Los errores internos responden
un mensaje genérico. Ver [contratos y colecciones](docs/api/README.md).

## Pruebas y CI

```bash
npm run verify
npm run test:coverage
```

`verify` ejecuta lint, formato y pruebas. No hay build: Node ejecuta JavaScript
sin compilar. Las pruebas unitarias y HTTP usan el catálogo propio. Las de
integración y comandos PostgreSQL requieren `DATABASE_URL_TEST`, cuyo nombre de
base debe terminar en `_test`; sin esa configuración se informa su omisión.
Cada suite usa un esquema temporal propio y elimina solo ese esquema, nunca
`public`. La base de desarrollo no debe utilizarse para pruebas.

El workflow instala PostgreSQL 16 directamente en Ubuntu 24.04 y crea una base de
pruebas propia. Usa socket Unix y autenticación local, sin contraseñas publicadas.
Ejecuta toda la suite y cobertura. Su definición local no acredita que
el CI remoto haya pasado. Ver [cobertura](docs/cobertura.md).
### Revisión con DeepSeek

El workflow `ai-review` revisa PR e issues del equipo en español y permite pedir
otra revisión mediante la etiqueta `ai-review`. Una persona debe configurar
`DEEPSEEK_API_KEY` en los secretos de Actions del repositorio; sin esa clave la
revisión se omite. El script se ejecuta desde la rama base revisada, omite PR de
forks y borradores y limita la revisión automática de issues a colaboradores.
Debe estar integrado en la rama base para revisar PR y en la predeterminada para
revisar issues. La primera incorporación del script no se revisa a sí misma.

Se envían a la API oficial de DeepSeek la descripción, los cambios, los nombres
y resultados de los checks y documentación pública del repositorio, con redacción
de credenciales y exclusión de archivos sensibles. El límite es 75.000 caracteres
por archivo de contexto y 120.000 de cambios por PR. La revisión no aprueba ni
fusiona cambios; el equipo conserva la revisión y aprobación humanas.

## Operación

## Frontend e integración futura

Ejecutar `npm ci` y `npm run dev` desde la raíz del frontend, en otra terminal.
Vite usa por defecto `http://localhost:5173`, permitido por `CORS_ORIGIN` en la API.
El frontend sigue usando su mock; `VITE_API_BASE_URL` todavía no se consume.

El consumo de la API de Mercado Público y la conexión HTTP del frontend son
entregas posteriores. No hay importador, ticket configurado, sesiones ni endpoints
de escritura de favoritos o aprobaciones implementados.

Ver [índice de documentación](docs/README.md), [arquitectura](docs/Arquitectura.md),
[modelo de datos](docs/ModeloDatos.md), [CONTRIBUTING.md](CONTRIBUTING.md),
[AGENTS.md](AGENTS.md) y [contexto técnico](docs/AI_context.md).
