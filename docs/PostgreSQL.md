# PostgreSQL: configuración, migraciones y pruebas

## Motor y arranque

La API usa PostgreSQL 16 con `pg` cuando se define `DATABASE_URL`. Sin ella sirve
el catálogo propio en memoria, sin persistencia y sin abrir archivos SQLite.
El driver se carga al seleccionar PostgreSQL. Los scripts de base de datos sí
exigen conexión y fallan si no está configurada.

`.env.example` contiene nombres y ejemplos públicos; la configuración real es
local y no se versiona. `DATABASE_URL` debe coincidir con el usuario, contraseña,
puerto y base de desarrollo elegidos por una persona.

## Instalación local directa

Instalar e iniciar PostgreSQL 16 mediante el paquete o instalador correspondiente
al sistema operativo. La [página oficial de descargas](https://www.postgresql.org/download/)
contiene las opciones para Windows, Linux y macOS.

Una persona crea un usuario propio y las bases independientes `licitaciones_db`
y `licitaciones_test`, usando pgAdmin, psql o createdb. Por ejemplo, con un usuario
`licitaciones` previamente creado y acceso administrativo configurado:

```text
createdb --owner=licitaciones --encoding=UTF8 --template=template0 licitaciones_db
createdb --owner=licitaciones --encoding=UTF8 --template=template0 licitaciones_test
```

Son ejemplos de preparación manual; no forman parte del arranque de la aplicación.
Configurar las conexiones locales en `.env` a partir de `.env.example`, apuntando
al usuario, puerto y base elegidos. No copiar credenciales reales a la documentación.
Después, desde la raíz del backend:

```bash
npm ci
npm run db:setup
npm start
```

La base debe usar UTF-8 y un locale con conversión Unicode de mayúsculas, por
ejemplo ICU `es-CL` o un locale UTF-8 del sistema. El locale ASCII `C` no convierte
algunas letras acentuadas y no cumple las pruebas de búsqueda en español.

## Migraciones y seed

```bash
npm run db:migrate
npm run db:seed
```

`db:setup` ejecuta ambos comandos. La línea activa es `migrations/postgresql/`;
el migrador solo acepta archivos `NNN_nombre.sql` en esa carpeta y registra los
aplicados en `schema_migrations`. Cada archivo y su registro comparten transacción;
si falla, revierte esa migración y no aplica las siguientes. No editar migraciones
ya aplicadas: añadir otra numerada.

El seed carga los seis ejemplos de `src/data/licitaciones.mock.json` en una
transacción. Repetirlo no duplica identificadores, pero actualiza sus datos.
El arranque del servidor no ejecuta estos comandos automáticamente.

## Pruebas independientes

Una persona configura `DATABASE_URL_TEST` con una base desechable cuyo nombre
termine en `_test`, separada de desarrollo. Las suites de integración y comandos
crean esquemas `uv_test_...` únicos y eliminan solo sus propios esquemas. No borran
`public`, no comparten datos entre suites y no migran la base de desarrollo.

```bash
npm run verify
npm run test:coverage
```

Sin conexión de prueba, las suites que requieren PostgreSQL informan su omisión.
CI instala PostgreSQL 16 como servicio nativo de Ubuntu 24.04 y crea la base de
pruebas. El rol coincide con el usuario del agente; la conexión usa un socket Unix
y autenticación local peer, sin contraseña. La URL se define solo durante ese job.
El usuario de prueba necesita permiso para crear y eliminar sus esquemas.

## Datos anteriores

Las carpetas `migrations/sqlite/` y `migrations/legacy-postgresql/` son históricas.
No se ejecutan ni se alteran sus archivos. La línea PostgreSQL activa conserva el
esquema original, con los mismos nombres de migración. Para reutilizar una base
PostgreSQL previa, una persona debe comprobar sus registros y respaldos antes de
configurar la conexión. No existe un importador automático desde SQLite.

Los archivos SQLite y sus auxiliares siguen excluidos de Git. Esta separación no
los elimina ni copia datos reales al catálogo de ejemplo.
