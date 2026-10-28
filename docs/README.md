# Documentación y alcance del backend

## Qué pertenece a este repositorio

| Elemento                                                       | Motivo                                                            |
| -------------------------------------------------------------- | ----------------------------------------------------------------- |
| `src/`                                                         | Servidor, rutas HTTP, validación, repositorios y acceso a SQLite. |
| `src/data/licitaciones.mock.json`                              | Catálogo de ejemplo propio para ejecución en memoria y seed.      |
| `migrations/` y `scripts/`                                     | Esquema SQL versionado, aplicación de migraciones y seed.         |
| `tests/`                                                       | Pruebas unitarias, HTTP e integración con SQLite.                 |
| `package.json`, `package-lock.json` y configuración de calidad | Instalación y validaciones independientes del frontend.           |
| `.github/workflows/verify.yml`                                 | CI con SQLite temporal para toda la suite.                        |
| `.github/ISSUE_TEMPLATE/` y plantilla de PR                    | Forma de describir trabajo, DoR, DoD y evidencia.                 |
| `AGENTS.md`, `CONTRIBUTING.md` y `docs/`                       | Reglas de trabajo y contexto técnico y funcional.                 |
| `.env.example` y `.gitignore`                                  | Configuración de ejemplo y exclusión de archivos locales.         |

React, Vite, páginas, CSS, exportación PDF en navegador y persistencia en
`localStorage` pertenecen al frontend. `node_modules` se instala localmente y no
se publica. Tampoco se publican `.env` reales, claves ni datos personales.

## Guías técnicas

- [README del backend](../README.md): instalación, ejecución y endpoints.
- [Arquitectura](Arquitectura.md): módulos y flujo de datos.
- [SQLite](SQLite.md): archivo local, migraciones, persistencia y pruebas.
- [Modelo de datos](ModeloDatos.md): ocho entidades, relaciones y límites reales.
- [API](api/README.md): contratos y colecciones de Thunder Client.
- [Cobertura](cobertura.md): qué prueba cada suite y qué queda fuera de la medición.
- [Contexto para IA](AI_context.md) y [AGENTS.md](../AGENTS.md): instrucciones obligatorias.
- [Contribución](../CONTRIBUTING.md): flujo de trabajo y validaciones del backend.

## Referencias compartidas del proyecto

Se incorporan desde LicitacionesUV conservando allí los originales, porque ambos
repositorios necesitan el contexto funcional. Las copias se identifican como
referencias del producto completo; no son un inventario de endpoints implementados.
Los números de issues y PR históricos pertenecen a `Wilson-Jara/LicitacionesUV`.

- [Requisitos extrafuncionales](ReqExtrafuncionales.md).
- [Criterios de aceptación](CriteriosAceptacion.md).
- [Perfil de calidad](PerfilMedidasCalidad.md), orientado a la interfaz cliente.
- [Roles y coordinación](roles-equipo.md), sin efecto sobre colaboradores o permisos.

Las guías de depuración, fichas de ejercicios, imágenes de evidencia y documentos
centrados en React siguen en el frontend. Los contratos y pruebas propios de la API
están aquí en `docs/api/` y `tests/`; no requieren copiar toda la documentación del cliente.

## Estado funcional comprobado

Existen salud, listado filtrado y detalle de licitaciones, con SQLite persistente; el repositorio en memoria se conserva para pruebas.
El frontend aún consume su mock local. La API no implementa login, sesiones,
endpoints de favoritos, perfiles, alertas, aprobaciones o subrogancias, aunque el
esquema contenga varias de sus tablas. No se consideran funciones terminadas por
aparecer en los requisitos compartidos.
