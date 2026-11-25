# Inicio de sesión con Google

> Contrato acordado con el frontend. No cambiar nombres ni formatos sin avisar.

El navegador obtiene un **ID token** de Google con Google Identity Services (campo `credential`) y lo envía a la API. La API lo verifica, revisa que el correo esté verificado y responde un **token de sesión** propio. El frontend envía ese token en `Authorization: Bearer <token>`. No se usa Client Secret ni flujo de redirección.

## Variables de entorno

| Variable               | Obligatoria        | Uso                                                                    |
| ---------------------- | ------------------ | ---------------------------------------------------------------------- |
| `GOOGLE_CLIENT_ID`     | Sí, para el login  | Audiencia esperada del ID token de Google. Es público, no es secreto   |
| `JWT_SECRET`           | Sí, para el login  | Firma del token de sesión. Mínimo 32 caracteres aleatorios. Es secreto |
| `AUTH_TOKEN_TTL_HORAS` | No (por defecto 8) | Duración de la sesión en horas                                         |

Si falta `GOOGLE_CLIENT_ID` o `JWT_SECRET`, o este tiene menos de 32 caracteres, `POST /api/auth/google` y `GET /api/auth/me` responden `503`. El catálogo (`/api/licitaciones`) funciona igual.

## Forma del usuario

Es la misma en todas las respuestas:

```json
{
  "id": "google:<sub del token de Google>",
  "name": "Nombre Apellido",
  "email": "correo@gmail.com",
  "picture": "https://lh3.googleusercontent.com/..."
}
```

`picture` puede ser `null`.

## Rutas

### `POST /api/auth/google`

```http
POST /api/auth/google
Content-Type: application/json

{ "credential": "<ID token de Google>" }
```

| Código | Cuerpo                                           | Cuándo                                                                                                                                |
| ------ | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `200`  | `{ "token", "expiresAt", "user" }`               | Credencial válida                                                                                                                     |
| `400`  | `{ "error": "Falta la credencial de Google" }`   | Cuerpo vacío, JSON inválido o `credential` que no es un texto no vacío                                                                |
| `401`  | `{ "error": "Credencial de Google inválida" }`   | Firma inválida, `aud` distinto de `GOOGLE_CLIENT_ID`, `iss` que no es de Google, token expirado o `email_verified` distinto de `true` |
| `503`  | `{ "error": "Login con Google no configurado" }` | Falta `GOOGLE_CLIENT_ID` o `JWT_SECRET`                                                                                               |

### `GET /api/auth/me`

```http
GET /api/auth/me
Authorization: Bearer <token>
```

| Código | Cuerpo                                           | Cuándo                                                                   |
| ------ | ------------------------------------------------ | ------------------------------------------------------------------------ |
| `200`  | `{ "user": { ... } }`                            | Token vigente                                                            |
| `401`  | `{ "error": "Sesión inválida o expirada" }`      | Sin encabezado, esquema distinto de `Bearer`, firma incorrecta o vencido |
| `503`  | `{ "error": "Login con Google no configurado" }` | Falta configuración                                                      |

### `POST /api/auth/logout`

Responde siempre `204` sin cuerpo, con o sin `Authorization` (es idempotente).

## Cómo funciona

- **ID token de Google** (`src/auth/googleVerifier.js`): usa `OAuth2Client#verifyIdToken({ idToken, audience: GOOGLE_CLIENT_ID })` de la librería oficial `google-auth-library`.
  - La librería descarga y guarda en caché las claves públicas de Google, y valida la firma, el emisor (`accounts.google.com`), la audiencia y el vencimiento.
  - La ruta revisa además `email_verified`.
  - El verificador se inyecta (`createApp({ googleVerifier })`); en las pruebas se usa uno falso.
- **Token de sesión** (`src/lib/sesion.js`): un JWT HS256 firmado con `JWT_SECRET` usando solo `node:crypto`.
  - Contiene `sub` (`google:<sub>`), `name`, `email`, `picture`, `iat` y `exp`.
  - `verificarSesion` compara la firma con `timingSafeEqual` y rechaza tokens alterados o vencidos.
- **Registros:** los tokens de Google y de sesión nunca se escriben en la consola. Cualquier rechazo del verificador se responde `401` sin detalle, porque algunos mensajes de error pueden incluir partes del token.

## Limitaciones

- **La sesión no se guarda en el servidor.** Cerrar sesión es que el frontend borre su token. Un token robado sigue sirviendo hasta que vence (`AUTH_TOKEN_TTL_HORAS`, 8 horas por defecto). Revocarlo antes exigiría una lista de tokens revocados o sesiones en la base.
- **Los usuarios no se guardan en la base.** La identidad viaja en el token. La columna `usuarios.google_sub` (migración 005) queda disponible para cuando se necesite persistir usuarios.
- El frontend debe guardar el token donde decida (por ejemplo, en memoria o en `sessionStorage`) y enviarlo en `Authorization`. Como no hay cookies, no aplica CSRF, pero sí hay que cuidar el XSS en el frontend.

## Uso desde el frontend

```js
const respuesta = await fetch(`${API_BASE_URL}/auth/google`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ credential }),
})
const { token, expiresAt, user } = await respuesta.json()

// Después, en cada consulta de sesión
await fetch(`${API_BASE_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
```

## Pruebas

`tests/auth.test.js` usa un verificador falso: nunca llama a Google ni a internet. Cubre:

- `firmarSesion`/`verificarSesion`: ida y vuelta, firma o contenido alterado, otro secreto y vencimiento.
- `createGoogleVerifier`: llama a `verifyIdToken` con la audiencia correcta.
- `POST /api/auth/google`:
  - `200` con la forma del contrato y `picture` nulo;
  - `400` sin credencial, vacía, no textual, con cuerpo vacío o con JSON inválido;
  - `401` cuando el verificador rechaza (sin registrar el token) y con `email_verified: false`;
  - `503` sin Client ID o con un secreto corto.
- `GET /api/auth/me`: `200` con el token emitido; `401` sin encabezado, con otro esquema, con firma alterada o con el token vencido (reloj inyectado).
- `POST /api/auth/logout`: `204` siempre.
- `/api/licitaciones` responde sin variables de autenticación.
