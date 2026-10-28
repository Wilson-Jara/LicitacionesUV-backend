import { createServer } from 'node:http'
import { createApp } from './app.js'
import { config } from './config/env.js'
import { createSqliteLicitacionesRepository } from './data/licitaciones.repository.js'
import { openDatabase } from './db/connection.js'
import { runMigrations } from './db/migrator.js'

const db = openDatabase(config.databasePath)
try {
  await runMigrations(db)
} catch (error) {
  db.close()
  throw error
}
const server = createServer(
  createApp({
    licitacionesRepository: createSqliteLicitacionesRepository(db),
  }),
)
server.listen(config.port, () => {
  console.log(`API LicitacionesUV escuchando en http://localhost:${config.port}`)
})
server.on('error', (error) => {
  console.error(error.message)
  db.close()
  process.exitCode = 1
})
function shutdown() {
  server.close(() => {
    db.close()
    process.exit(0)
  })
  server.closeAllConnections()
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
