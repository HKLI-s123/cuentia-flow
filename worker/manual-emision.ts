/**
 * Ejecuta la emisión programada manualmente (para pruebas)
 * Timbra facturas cuya FechaEmision <= hoy que aún no han sido timbradas.
 * 
 * Uso: npx tsx worker/manual-emision.ts
 */
import 'dotenv/config';
import { getConnection, closeConnection } from './db.js';
import { ejecutarEmisionProgramada } from './refacturacion.js';

async function main() {
  console.log('\n[MANUAL-EMISION] Iniciando emisión programada manual...\n');

  await getConnection();
  console.log('[MANUAL-EMISION] ✓ BD conectada');

  await ejecutarEmisionProgramada();

  await closeConnection();
  console.log('\n[MANUAL-EMISION] Proceso terminado.');
  process.exit(0);
}

main().catch(err => {
  console.error('[MANUAL-EMISION] Error fatal:', err);
  process.exit(1);
});
