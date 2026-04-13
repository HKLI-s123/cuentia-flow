/**
 * Ejecuta un ciclo de refacturación manual (para pruebas)
 */
import 'dotenv/config';
import { getConnection, closeConnection } from './db.js';
import { ejecutarCicloRefacturacion } from './refacturacion.js';

async function main() {
  console.log('\n[TEST-REFACT] Iniciando ciclo de refacturación manual...\n');

  await getConnection();
  console.log('[TEST-REFACT] ✓ BD conectada');

  await ejecutarCicloRefacturacion();

  await closeConnection();
  console.log('\n[TEST-REFACT] Ciclo completado. Proceso terminado.');
  process.exit(0);
}

main().catch(err => {
  console.error('[TEST-REFACT] Error fatal:', err);
  process.exit(1);
});
