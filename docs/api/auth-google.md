# Inicio de sesión con Google

> Extra del Hito 3 (no evaluado) · Backend: Benjamin Lazo (@lazo1838k)

El frontend muestra el botón «Sign in with Google», recibe un **ID token** de Google y lo envía a la API. La API lo verifica, registra o actualiza al usuario y deja la sesión en una **cookie HttpOnly**. El frontend nunca guarda tokens: el navegador envía la cookie en cada llamada.

## Rutas

| Método y ruta           | Cuerpo                           | Respuestas                                                                                                             |
| ----------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `POST /api/auth/google` | `{ "credential": "<ID token>" }` | `200 { usuario }` + `Set-Cookie`; `400` sin `credential`; `401` si el token no es válido; `503` si falta configuración |
| `GET /api/auth/me`      | —                                | `200 { usuario }` con sesión vigente; `401` sin sesión o con cookie alterada o vencida; `503` si falta configuración   |
| `POST /api/auth/logout` | —                                | `204` y la cookie se borra (`Max-Age=0`)                                                                               |

`usuario` tiene la forma `{ "id", "nombre", "email", "proveedor": "google" }`.

## Qué se verifica del ID token

`src/auth/googleIdToken.js`, sin librerías externas (`node:crypto`):

1. Formato JWT de tres partes y algoritmo `RS256`; se rechaza, por ejemplo, `alg: none`.
2. Firma con las claves públicas de Google (`https://www.googleapis.com/oauth2/v3/certs`). Se guardan en caché una hora; si llega una clave nueva (`kid`), se vuelven a descargar.
3. Emisor `accounts.google.com`.
4. Audiencia (`aud`) igual a `GOOGLE_CLIENT_ID`: un token emitido para otra aplicación no sirve.
5. Vigencia (`exp`), con 60 s de tolerancia de reloj.
6. `email_verified: true`.

## Sesión

- Cookie `licitacionesuv_sesion`, con duración de 8 horas y atributos `HttpOnly; Secure; SameSite=None; Path=/`.
  - **`HttpOnly`:** JavaScript no puede leerla, lo que protege contra robo por XSS.
  - **`Secure` y `SameSite=None`:** el frontend (`vercel.app`) y la API (`onrender.com`) están en dominios distintos. Para que el navegador envíe la cookie, tiene que ser solo HTTPS y permitir sitios cruzados.
- El contenido (id, correo, nombre y vencimiento) va firmado con HMAC-SHA256 usando `JWT_SECRET`. No hay sesiones guardadas en el servidor; si alguien modifica la cookie, la firma no coincide y la API responde `401`.
- CORS responde `Access-Control-Allow-Credentials: true` con el origen fijo de `CORS_ORIGIN`, nunca `*`.

## Usuarios

- **Con `DATABASE_URL`:** tabla `usuarios`, con la columna `google_sub` de la migración `005_usuarios_google.sql`. Primero se busca por `google_sub`, el identificador estable de la cuenta de Google. Si no existe, se vincula una cuenta previa con el mismo correo; si tampoco existe, se crea.
- **Sin base de datos:** repositorio en memoria, el mismo patrón que el catálogo. Los usuarios se pierden al reiniciar.

## Configuración

| Variable           | Dónde                   | Valor                                                                             |
| ------------------ | ----------------------- | --------------------------------------------------------------------------------- |
| `GOOGLE_CLIENT_ID` | Render (y `.env` local) | Client ID web creado en Google Cloud. No es secreto                               |
| `JWT_SECRET`       | Render (y `.env` local) | Secreto largo y aleatorio. **Es secreto:** no se versiona ni se comparte por chat |
| `CORS_ORIGIN`      | Render                  | `https://licitacionesuv.vercel.app` (ya configurada)                              |

Si falta `GOOGLE_CLIENT_ID` o `JWT_SECRET`, las rutas de login responden `503` y el resto de la API funciona igual.

## Uso desde el frontend

```js
// Después de que Google entregue `credential` al botón «Sign in with Google»
await fetch(`${API_BASE_URL}/auth/google`, {
  method: 'POST',
  credentials: 'include', // sin esto el navegador no guarda ni envía la cookie
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ credential }),
})

// Al cargar la app, para saber si hay sesión
const respuesta = await fetch(`${API_BASE_URL}/auth/me`, { credentials: 'include' })
```

## Pruebas

`tests/auth.test.js` usa un par de claves RSA generado en la prueba, que hace de Google sin red. Cubre:

- **ID token válido**, y que las claves se reutilicen desde la caché.
- **Ocho rechazos:** audiencia incorrecta, token expirado, correo no verificado, emisor ajeno, firma con otra clave, `kid` desconocido, `alg: none` y texto que no es un JWT.
- **Sesión:** se lee de vuelta, y se rechaza si está alterada, vencida o firmada con otro secreto.
- **Repositorios:** en memoria y PostgreSQL, este último con consultas parametrizadas.
- **Rutas:** ciclo login → me → logout, códigos 400/401/503 y CORS con credenciales.
