import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(currentDir, '../../.env')

if (existsSync(envPath)) {
  const content = readFileSync(envPath, 'utf8')
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const separator = trimmed.indexOf('=')
    if (separator === -1) continue
    const key = trimmed.slice(0, separator).trim()
    let value = trimmed.slice(separator + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (key && !(key in process.env)) process.env[key] = value
  }
}

function readPort() {
  const port = Number(process.env.PORT)
  return Number.isInteger(port) && port > 0 && port < 65536 ? port : 3000
}

function readTtlHoras() {
  const horas = Number(process.env.AUTH_TOKEN_TTL_HORAS)
  return Number.isFinite(horas) && horas > 0 ? horas : 8
}

/** Configuración local; las variables exportadas tienen prioridad sobre .env. */
export const config = {
  port: readPort(),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  databaseUrl: process.env.DATABASE_URL || '',
  // Firma el token de sesión del login con Google (32+ caracteres); sin él, /api/auth responde 503
  jwtSecret: process.env.JWT_SECRET || '',
  // Client ID web de Google («Sign in with Google»): audiencia del ID token; no es secreto
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  // Duración de la sesión en horas (por defecto 8)
  authTokenTtlHoras: readTtlHoras(),
}
