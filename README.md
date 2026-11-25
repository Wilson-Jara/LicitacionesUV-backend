# LicitacionesUV — Backend

API REST independiente con `node:http` y PostgreSQL 16 mediante `pg`.
Requiere Node.js >= 22.22.0 y npm >= 10. El frontend vive en
[LicitacionesUV](https://github.com/Wilson-Jara/LicitacionesUV); este proyecto
contiene su propio catálogo de seis licitaciones ficticias.

**Si es tu primera vez con el proyecto**, sigue este orden:
[Versiones del entorno](#versiones-del-entorno) →
[Instalación](#instalación-y-ejecución-rápida) →
[Ejemplo de ejecución](#ejemplo-de-ejecución-y-resultado-esperado) →
[Problemas frecuentes](#problemas-frecuentes) →
[Cómo extender y probar un cambio](#cómo-extender-y-probar-un-cambio). Las
evidencias están enlazadas en [Evidencias y documentación](#evidencias-y-documentación).

**Versión publicada:** <https://licitacionesuv-backend.onrender.com/api/health>
(Render, plan gratuito; ver [Despliegue](#integración-con-el-frontend-y-despliegue)).

## Versiones del entorno

| Herramienta  | Versión verificada                         | Notas                                                                                              |
| ------------ | ------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Node.js      | **22.22.0** (la que usa el CI)             | Mínimo `22.22.0`, declarado en `engines`. No hace falta compilar: Node ejecuta el código tal cual. |
| npm          | 10.x                                       | Viene con Node.js 22.                                                                              |
| PostgreSQL   | 16 (opcional)                              | Sin `DATABASE_URL`, la API usa el catálogo en memoria y no necesita base de datos.                 |
| Sistema      | Windows 10/11 (equipo) y Ubuntu 24.04 (CI) | Los comandos funcionan en PowerShell y en bash.                                                    |
| Dependencias | `pg` 8.23.1 (única de ejecución)           | Las de desarrollo (ESLint 10, Prettier 3) están fijadas en `package.json` y `package-lock.json`.   |

## Instalación y ejecución rápida

Desde la raíz de este repositorio:

```bash
npm ci
npm start
```

`npm ci` instala exactamente las versiones de `package-lock.json`. Repítelo después
de cada `git pull`: si cambió alguna dependencia y no lo haces, el servidor puede
fallar al arrancar (ver [Problemas frecuentes](#problemas-frecuentes)).

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
- `POST /api/auth/google`, `GET /api/auth/me`, `POST /api/auth/logout`: inicio de
  sesión con Google (ver [Inicio de sesión con Google](#inicio-de-sesión-con-google)).

Se conserva el contrato de datos (once campos, con `sector` y `etiquetas`) y la búsqueda literal sin distinguir
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

- **Contribución y revisión.** Los PR hacia `main` y `develop` requieren la aprobación de QA (@StelleC) y de otro integrante distinto del autor. Ver el procedimiento y los ajustes de GitHub en [CONTRIBUTING.md](CONTRIBUTING.md) y [docs/roles-equipo.md](docs/roles-equipo.md).
- **Configuración local:** copiar las claves documentadas desde [`.env.example`](.env.example) a un `.env` local no versionado y seguir [docs/PostgreSQL.md](docs/PostgreSQL.md) para migraciones, seed y base de pruebas (`_test`). La [guía de SQLite](docs/SQLite.md) se conserva únicamente como antecedente histórico.
- **Contribución y revisión:** seguir [CONTRIBUTING.md](CONTRIBUTING.md) y [docs/roles-equipo.md](docs/roles-equipo.md). [`.github/CODEOWNERS`](.github/CODEOWNERS) propone revisores del equipo al abrir PR hacia la rama base, pero exigir aprobaciones, checks obligatorios y secretos de Actions (`DEEPSEEK_API_KEY`) depende de la configuración efectiva del repositorio y sus ramas en GitHub, que debe comprobarse manualmente.
- **Gobernanza y pruebas:** consultar [docs/cobertura.md](docs/cobertura.md), [docs/api/README.md](docs/api/README.md) y [AGENTS.md](AGENTS.md).

## Ejemplo de ejecución y resultado esperado

Con `npm start` en marcha (sin `DATABASE_URL`), la terminal muestra:

```
DATABASE_URL no definida: la API usa el catálogo propio en memoria
API LicitacionesUV escuchando en http://localhost:3000
```

En el navegador, Thunder Client o `curl`:

| Petición                                 | Resultado esperado                                                                                                                                            |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/health`                        | `200` · `{"status":"ok","service":"licitacionesuv-backend","uptime":…,"timestamp":…}`                                                                         |
| `GET /api/licitaciones`                  | `200` · 6 licitaciones con 11 campos: `id`, `title`, `amount`, `currency`, `institution`, `closingDate`, `type`, `region`, `sector`, `etiquetas`, `sourceUrl` |
| `GET /api/licitaciones?keyword=software` | `200` · 1 licitación: `licitacion-005` «Renovación de licencias de software»                                                                                  |
| `GET /api/licitaciones/licitacion-002`   | `200` · «Adquisición de equipamiento tecnológico», `amount` 8700000 `CLP`                                                                                     |
| `GET /api/licitaciones/licitacion-999`   | `404` · `{"error":"Licitación no encontrada"}`                                                                                                                |

Las colecciones de [docs/thunder-client/](docs/thunder-client/) traen estos y
otros casos listos para ejecutar.

**Verificación completa:**

```bash
npm run verify
npm run test:coverage
```

Resultado esperado: ESLint y Prettier no informan problemas, el resumen de pruebas
termina en `# fail 0` y la cobertura no muestra `does not meet threshold`. Sin
`DATABASE_URL_TEST`, las pruebas de PostgreSQL se informan como omitidas
(`DATABASE_URL_TEST no definida`); no es un error.

## Integración con el frontend y despliegue

El frontend consume esta API: pide el catálogo y el detalle a la URL de su
variable `VITE_API_BASE_URL` (por defecto `http://localhost:3000/api`). Para
trabajar en local, ejecutar `npm start` aquí y, en otra terminal, `npm ci` y
`npm run dev` desde la raíz del frontend.

`CORS_ORIGIN` admite **un solo origen**. Por defecto es `http://localhost:5173`,
el de Vite; si Vite abre en otro puerto, hay que cambiarlo en el `.env` y
reiniciar la API.

**Versión publicada (Render):** <https://licitacionesuv-backend.onrender.com/api>,
usada por <https://licitacionesuv.vercel.app>. Por eso su `CORS_ORIGIN` es el
dominio de Vercel, y esa API no acepta peticiones desde `localhost`. En el plan
gratuito, el servicio se suspende tras un rato sin uso: la primera petición
responde `503` mientras arranca, y tarda alrededor de un minuto. Antes de una demo,
abrir `/api/health` hasta obtener `200`.

El consumo de la API de Mercado Público es una entrega posterior. No hay
importador, ticket configurado ni endpoints de escritura de favoritos o
aprobaciones implementados.

## Inicio de sesión con Google

El navegador obtiene un **ID token** de Google con Google Identity Services y lo
envía a la API. La API lo verifica con la librería oficial `google-auth-library`
(firma, emisor, audiencia = `GOOGLE_CLIENT_ID` y vencimiento), revisa
`email_verified` y responde un **token de sesión** propio: un JWT HS256 firmado
con `JWT_SECRET`. No se usa Client Secret ni redirección. Detalle completo en
[docs/api/auth-google.md](docs/api/auth-google.md).

### Variables

| Variable               | Obligatoria        | Uso                                                                 |
| ---------------------- | ------------------ | ------------------------------------------------------------------- |
| `GOOGLE_CLIENT_ID`     | Sí, para el login  | Audiencia esperada del ID token de Google (no es secreto)           |
| `JWT_SECRET`           | Sí, para el login  | Firma del token de sesión. Mínimo 32 caracteres aleatorios; secreto |
| `AUTH_TOKEN_TTL_HORAS` | No (por defecto 8) | Duración de la sesión en horas                                      |

Si falta `GOOGLE_CLIENT_ID` o `JWT_SECRET` (o tiene menos de 32 caracteres),
`/api/auth/google` y `/api/auth/me` responden `503` y el catálogo funciona igual.

### `POST /api/auth/google`

```http
POST /api/auth/google
Content-Type: application/json

{ "credential": "<ID token de Google>" }
```

```json
{
  "token": "<token de sesión firmado>",
  "expiresAt": "2026-11-25T18:00:00.000Z",
  "user": {
    "id": "google:1234567890",
    "name": "Ana Pérez",
    "email": "ana@gmail.com",
    "picture": "https://lh3.googleusercontent.com/..."
  }
}
```

Errores: `400 { "error": "Falta la credencial de Google" }`,
`401 { "error": "Credencial de Google inválida" }` y
`503 { "error": "Login con Google no configurado" }`.

### `GET /api/auth/me`

```http
GET /api/auth/me
Authorization: Bearer <token>
```

Responde `200 { "user": { ... } }` con la misma forma de usuario, o
`401 { "error": "Sesión inválida o expirada" }`.

### `POST /api/auth/logout`

Responde siempre `204` sin cuerpo. La sesión no se guarda en el servidor: cerrar
sesión es que el frontend borre su token. **Limitación:** un token robado sigue
sirviendo hasta que vence (`AUTH_TOKEN_TTL_HORAS`).

### Configurar en Render

1. En el servicio `LicitacionesUV-backend`, abrir **Environment**.
2. Agregar `GOOGLE_CLIENT_ID` con el Client ID web del proyecto en Google Cloud.
3. Generar un secreto en la terminal y agregarlo como `JWT_SECRET` (no copiarlo
   en el repositorio ni en el chat):
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```
4. Opcional: `AUTH_TOKEN_TTL_HORAS` (por defecto 8).
5. Guardar: Render vuelve a desplegar. Comprobar que
   `GET /api/auth/me` sin token responda `401` (no `503`).

## Problemas frecuentes

| Síntoma                                                                                        | Causa                                                                                     | Solución                                                                                                                        |
| ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'pg' imported from .../src/db/pool.js`      | `node_modules` desactualizado o sin instalar (aparece al usar `DATABASE_URL` o `db:*`).   | Ejecutar `npm ci` en la raíz de este repositorio.                                                                               |
| `listen EADDRINUSE: address already in use 0.0.0.0:3000`                                       | Ya hay otra API u otro programa usando el puerto 3000.                                    | Cerrar la otra terminal, o poner `PORT=3001` en `.env` (y en el frontend `VITE_API_BASE_URL=http://localhost:3001/api`).        |
| `npm run db:migrate` falla con `Falta DATABASE_URL: configúrala en .env (ver .env.example)`    | Los comandos `db:*` necesitan una base PostgreSQL; `npm start` no.                        | Copiar `.env.example` como `.env`, completar `DATABASE_URL` y seguir [docs/PostgreSQL.md](docs/PostgreSQL.md).                  |
| Las pruebas de PostgreSQL se omiten con `La base debe terminar en _test`                       | Protección para no usar la base de desarrollo en pruebas.                                 | Crear una base aparte cuyo nombre termine en `_test` y usarla en `DATABASE_URL_TEST`.                                           |
| El frontend dice «No se pudo cargar el catálogo» y la consola muestra `blocked by CORS policy` | El origen del frontend no coincide con `CORS_ORIGIN` (por ejemplo, Vite abrió en `5174`). | Usar el puerto `5173` o poner el origen exacto en `CORS_ORIGIN` del `.env` y reiniciar con `npm start`.                         |
| La versión publicada responde `503` o tarda en contestar                                       | **Render dormido:** el plan gratuito suspende el servicio sin uso.                        | Abrir <https://licitacionesuv-backend.onrender.com/api/health>, esperar el `200` y reintentar desde el frontend.                |
| `npm run format:check` marca con `[warn]` archivos que no modificaste (Windows)                | Fines de línea `CRLF`; Prettier y `.gitattributes` exigen `LF`.                           | `npm run format`, revisar con `git status`, y para el futuro `git config core.autocrlf false` y `"files.eol": "\n"` en VS Code. |

## Cómo extender y probar un cambio

### Dónde va cada cosa

El backend está organizado en capas: rutas HTTP (`src/routes/`), validación y
reglas compartidas (`src/lib/`), acceso a datos (`src/data/`, `src/db/`) y
arranque (`src/server.js`, `src/app.js`).

| Si quieres cambiar…                       | Edita                                                                              | Y prueba en                                                              |
| ----------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Cómo se interpretan los filtros de la URL | `src/lib/filtrosListado.js`                                                        | `tests/filtrosListado.test.js`                                           |
| Una ruta o su respuesta HTTP              | `src/routes/licitaciones.routes.js` (y su registro en `src/app.js`)                | `tests/licitaciones.test.js`, `tests/http.test.js`                       |
| La consulta de datos                      | `src/data/licitaciones.repository.js` (en memoria y PostgreSQL)                    | `tests/licitaciones.repository.test.js` y `tests/db.integration.test.js` |
| Montos y su precisión                     | `src/lib/montos.js`                                                                | `tests/montos.test.js`                                                   |
| El esquema de la base                     | Una migración **nueva** en `migrations/postgresql/` (nunca editar una ya aplicada) | `tests/db.test.js` y `tests/db.integration.test.js`                      |

Las pruebas HTTP crean la aplicación con `createApp()` y el repositorio en
memoria, así que no necesitan PostgreSQL. Para probar un caso especial se le puede
pasar un repositorio falso: `createApp({ licitacionesRepository: miRepositorio })`.

### Paso a paso

1. Rama desde `develop` actualizado: `git checkout develop`, `git pull`, `npm ci`,
   `git checkout -b feat/<numero-issue>-<descripcion-corta>`.
2. Escribir primero la prueba del comportamiento nuevo, con un caso válido, uno
   de límite y uno de error, y comprobar que falla:
   `node --test tests/licitaciones.test.js`.
3. Implementar el cambio hasta que la prueba pase.
4. Si cambia el contrato de la API, actualizar [docs/api/](docs/api/README.md), la
   colección de Thunder Client y avisar al frontend: su validación del contrato
   está en `src/features/licitaciones/contratoLicitaciones.js`.
5. Verificar: `npm run format`, `npm run verify` y `npm run test:coverage`.
6. Abrir el Pull Request hacia `develop` con la plantilla. El CI repite la suite con
   PostgreSQL 16 real y la cobertura; se necesita la aprobación de QA y de otro
   integrante ([CONTRIBUTING.md](CONTRIBUTING.md)).

**Ejemplo:** para agregar el filtro `?sector=` al listado, habría que aceptar la
clave en `normalizarFiltrosListado` (`src/lib/filtrosListado.js`), aplicarla en
`list()` de ambos repositorios y probarla en `tests/filtrosListado.test.js` y
`tests/licitaciones.test.js`. Como el frontend usa la misma regla de URL en
`sanitizeFilterParams`, conviene cambiar ambos en PR coordinados.

## Evidencias y documentación

| Tema                                             | Documento                                                                                                                                                                              |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Índice y alcance del backend                     | [docs/README.md](docs/README.md)                                                                                                                                                       |
| Arquitectura y modelo de datos                   | [docs/Arquitectura.md](docs/Arquitectura.md) · [docs/ModeloDatos.md](docs/ModeloDatos.md)                                                                                              |
| PostgreSQL (configuración, migraciones, pruebas) | [docs/PostgreSQL.md](docs/PostgreSQL.md)                                                                                                                                               |
| API y colecciones de Thunder Client              | [docs/api/](docs/api/README.md) · [docs/thunder-client/](docs/thunder-client/)                                                                                                         |
| Pruebas y cobertura                              | [docs/cobertura.md](docs/cobertura.md)                                                                                                                                                 |
| Intervención: migraciones concurrentes (#6)      | [docs/evidencia/migraciones-concurrentes.md](docs/evidencia/migraciones-concurrentes.md)                                                                                               |
| Criterios de aceptación y calidad                | [docs/CriteriosAceptacion.md](docs/CriteriosAceptacion.md) · [docs/ReqExtrafuncionales.md](docs/ReqExtrafuncionales.md) · [docs/PerfilMedidasCalidad.md](docs/PerfilMedidasCalidad.md) |
| Contribución, roles y reglas para IA             | [CONTRIBUTING.md](CONTRIBUTING.md) · [docs/roles-equipo.md](docs/roles-equipo.md) · [AGENTS.md](AGENTS.md) · [docs/AI_context.md](docs/AI_context.md)                                  |
| Frontend y sus evidencias                        | [LicitacionesUV](https://github.com/Wilson-Jara/LicitacionesUV#evidencias-y-documentación)                                                                                             |
