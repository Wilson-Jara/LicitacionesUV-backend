import { createServer } from 'node:http'
import { createApp } from './app.js'
import { config } from './config/env.js'
import { createPgLicitacionesRepository } from './data/licitaciones.repository.js'
import { loginConfigurado } from './routes/auth.routes.js'

async function createLicitacionesRepository() {
  if (!config.databaseUrl) {
    console.warn('DATABASE_URL no definida: la API usa el catálogo propio en memoria')
    return { repository: undefined, close: async () => {} }
  }
  // Carga diferida: pg solo se necesita cuando hay base de datos
  const { createPool } = await import('./db/pool.js')
  const pool = createPool(config.databaseUrl)
  return { repository: createPgLicitacionesRepository(pool), close: () => pool.end() }
}

if (!loginConfigurado(config)) {
  // No se muestran los valores: solo se avisa que falta configuración
  console.warn(
    'Login con Google no configurado (GOOGLE_CLIENT_ID y JWT_SECRET de 32+ caracteres): /api/auth responde 503',
  )
}

const { repository, close } = await createLicitacionesRepository()
const server = createServer(createApp({ licitacionesRepository: repository }))

server.listen(config.port, () => {
  console.log(`API LicitacionesUV escuchando en http://localhost:${config.port}`)
})

server.on('error', (error) => {
  console.error(error.message)
  close().finally(() => {
    process.exitCode = 1
  })
})

function shutdown() {
  server.close(() => {
    close().finally(() => process.exit(0))
  })
  // Cierra también las conexiones keep-alive para que close() termine de inmediato.
  server.closeAllConnections()
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
