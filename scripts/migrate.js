import { config } from '../src/config/env.js'
import { runMigrations } from '../src/db/migrator.js'
import { withDatabase } from '../src/db/connection.js'

try {
  await withDatabase(config.databasePath, async (db) => {
    const aplicadas = await runMigrations(db)
    console.log(
      aplicadas.length
        ? `Migraciones aplicadas: ${aplicadas.join(', ')}`
        : 'No hay migraciones pendientes',
    )
  })
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
