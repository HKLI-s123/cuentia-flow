/**
 * Ejecuta un ciclo de cobranza manual (para pruebas)
 */
import 'dotenv/config';
import { getConnection, closeConnection } from './db.js';
import { initAllSessions } from './whatsapp.js';
import { setAIComposer, ejecutarCicloCobranza } from './scheduler.js';
import { initAI, composeCollectionMessage } from './ai/agent.js';

async function main() {
  console.log('\n[MANUAL] Iniciando ciclo de cobranza manual...\n');

  // Conectar BD
  await getConnection();
  console.log('[MANUAL] ✓ BD conectada');

  // IA
  const aiReady = initAI();
  if (aiReady) {
    setAIComposer(composeCollectionMessage);
    console.log('[MANUAL] ✓ IA activa');
  } else {
    console.log('[MANUAL] ⚠ IA no disponible, se usarán templates');
  }

  // WhatsApp sessions
  await initAllSessions();
  console.log('[MANUAL] ✓ Sesiones cargadas');

  // Ejecutar ciclo
  console.log('[MANUAL] Ejecutando ciclo de cobranza...\n');
  await ejecutarCicloCobranza();

  // Cerrar
  await closeConnection();
  console.log('\n[MANUAL] Ciclo completado. Proceso terminado.');
  process.exit(0);
}

main().catch(err => {
  console.error('[MANUAL] Error fatal:', err);
  process.exit(1);
});
