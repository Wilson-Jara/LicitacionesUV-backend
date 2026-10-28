import { config } from '../src/config/env.js'
import { loadMockLicitaciones } from '../src/data/mockLicitaciones.js'
import { withDatabase } from '../src/db/connection.js'
import { seedLicitaciones } from '../src/db/seed.js'
import { runMigrations } from '../src/db/migrator.js'

try {
  await withDatabase(config.databasePath, async (db) => {
    await runMigrations(db)
    console.log(`Seed cargado: ${await seedLicitaciones(db, loadMockLicitaciones())} licitaciones`)
  })
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
