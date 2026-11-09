# Instrucciones de trabajo — Backend

Adaptadas de las guías del proyecto LicitacionesUV. Para asistentes de IA son
obligatorios [AGENTS.md](AGENTS.md) y [docs/AI_context.md](docs/AI_context.md).

## Antes de implementar

- Leer README, contexto técnico, issue, contratos y archivos afectados.
- Delimitar objetivo, criterios de aceptación, dependencias, responsable y estimación (DoR).
- Verificar el código existente; los requisitos del producto completo no describen necesariamente funciones implementadas en la API.
- Trabajar en una rama por tarea. El flujo del equipo usa `develop` como integración; si todavía no existe en el nuevo repositorio, acordar su creación antes de usarla. No asumir que hay protección de ramas configurada.

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

El backend no requiere build: Node ejecuta directamente el código. La integración PostgreSQL requiere DATABASE_URL_TEST con base terminada en _test;
CI la proporciona. Cada suite usa su propio esquema temporal. Seguir
[la guía PostgreSQL](docs/PostgreSQL.md); no usar la base de desarrollo para pruebas.

El PR debe describir problema, comportamiento final, pruebas, límites y el issue
correspondiente. Para issues del proyecto original usar la referencia completa
`Wilson-Jara/LicitacionesUV#numero`. No afirmar que un PR está aprobado antes de la
revisión de un par. Estas instrucciones no configuran CODEOWNERS ni permisos.

## Definition of Done

- Objetivo y criterios cumplidos; regresiones relevantes verificadas.
- Lint, formato y pruebas aprobados; cobertura dentro de los umbrales.
- Documentación y contexto técnico actualizados.
- Cambios revisados y aprobados por una persona distinta del autor antes de fusionar.
- Evidencia de validación registrada, incluidas pruebas omitidas o no ejecutadas.

Las IAs deben preguntar y obtener confirmación para cada comando Git/gh y cada
efecto externo según AGENTS.md. La petición de editar archivos no autoriza publicar.
