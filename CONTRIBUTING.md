# Instrucciones de trabajo — Backend

Adaptadas de las guías del proyecto LicitacionesUV. Para asistentes de IA son
obligatorios [AGENTS.md](AGENTS.md) y [docs/AI_context.md](docs/AI_context.md).

## Antes de implementar

- Leer [README.md](README.md), [docs/AI_context.md](docs/AI_context.md), el issue, [docs/api/README.md](docs/api/README.md) y los archivos afectados.
- Delimitar objetivo, criterios de aceptación, dependencias, responsable y estimación (DoR).
- Verificar el código existente; los requisitos del producto completo no describen necesariamente funciones implementadas en la API.
- Trabajar en una rama por tarea creada desde `develop` (rama de integración vigente). No asumir que existe protección de ramas activa sin comprobar la configuración efectiva del repositorio en GitHub.

## Implementación

JavaScript con módulos ES, dos espacios, comillas simples y sin punto y coma.
Mantener cambios pequeños, consultas preparadas con valores enlazados y el contrato HTTP documentado.
Añadir migraciones numeradas para cambios del esquema; no editar migraciones ya aplicadas.
Actualizar README y contexto técnico cuando cambien comandos, dependencias o arquitectura.

No versionar `.env` reales, secretos, datos personales, `node_modules` ni archivos
generados. `.env.example` contiene solo ejemplos públicos. Los cambios de permisos,
revisores, protección de ramas, merges y despliegues requieren decisión humana.

## Validación y entrega

```bash
npm run verify
npm run test:coverage
```

El backend no requiere build: Node ejecuta directamente el código. La integración PostgreSQL requiere `DATABASE_URL_TEST` con base terminada en `_test`;
CI la proporciona. Cada suite usa su propio esquema temporal. Seguir
[la guía PostgreSQL](docs/PostgreSQL.md) y [cobertura](docs/cobertura.md); no usar la base de desarrollo para pruebas. La guía [SQLite](docs/SQLite.md) se conserva solo como antecedente histórico y no corresponde a la operación vigente.

El PR debe describir problema, comportamiento final, pruebas, límites y el issue
correspondiente. Para issues del proyecto original usar la referencia completa
`Wilson-Jara/LicitacionesUV#numero`. Antes del merge se requieren dos aprobaciones
de personas distintas del autor, una de QA (@StelleC) y otra de un integrante
habilitado. GitHub solicita a QA mediante [`.github/CODEOWNERS`](.github/CODEOWNERS)
en la rama base. El autor solicita la segunda revisión en **Reviewers**.

Los rulesets de `main` y `develop` deben exigir dos aprobaciones, la revisión de
propietarios de código y el check `verify`. Cuando @StelleC prepara un cambio, otro
integrante abre el PR porque GitHub impide aprobar un PR propio. Ver
[docs/roles-equipo.md](docs/roles-equipo.md).
`Wilson-Jara/LicitacionesUV#numero`. No afirmar que un PR está aprobado antes de la
revisión de un par. [`.github/CODEOWNERS`](.github/CODEOWNERS) propone revisores
del equipo cuando está integrado en la rama base, pero exigir su aprobación o
bloquear merges depende de la configuración efectiva de protección de ramas en
GitHub (que debe comprobarse manualmente y requiere decisión humana; ver también
[docs/roles-equipo.md](docs/roles-equipo.md) y [docs/README.md](docs/README.md)).

## Definition of Done

- Objetivo y criterios cumplidos; regresiones relevantes verificadas.
- Lint, formato y pruebas aprobados; cobertura dentro de los umbrales.
- Documentación y contexto técnico actualizados.
- Cambios aprobados por QA (@StelleC) y por otro integrante distinto del autor antes de fusionar.
- Evidencia de validación registrada, incluidas pruebas omitidas o no ejecutadas.

Las IAs deben preguntar y obtener confirmación para cada comando Git/gh y cada
efecto externo según AGENTS.md. La petición de editar archivos no autoriza publicar.
