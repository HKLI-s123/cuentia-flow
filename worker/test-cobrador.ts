/**
 * Script de prueba del Cobrador IA
 * Envía un mensaje de cobranza a un cliente específico, sin validar horario ni días de vencimiento.
 * 
 * Uso: npx tsx worker/test-cobrador.ts
 */
import 'dotenv/config';
import { getConnection, closeConnection } from './db.js';
import { sendWorkerMessage, phoneToJid } from './whatsapp.js';
import { initAI, composeCollectionMessage } from './ai/agent.js';
import type { MessageContext } from './scheduler.js';

async function main() {
  console.log('\n═══════════════════════════════════════');
  console.log('  TEST: Cobrador IA - Envío directo');
  console.log('═══════════════════════════════════════\n');

  const pool = await getConnection();
  console.log('[TEST] ✓ BD conectada');

  // Inicializar IA
  const aiReady = initAI();
  if (aiReady) {
    console.log('[TEST] ✓ IA activa (OpenAI)');
  } else {
    console.log('[TEST] ⚠ IA no disponible, se usará mensaje template');
  }

  // Buscar facturas con AgenteIAActivo = true
  const result = await pool.query(`
    SELECT 
      c.id AS clienteid,
      COALESCE(c.nombrecomercial, c.razonsocial) AS clientenombre,
      c.telefonowhatsapp AS clientetelefono,
      o.nombre AS organizacionnombre,
      f.id AS facturaid,
      COALESCE(f.numero_factura, CAST(f.id AS TEXT)) AS numerofactura,
      f.montototal AS total,
      f.saldopendiente,
      f.fechavencimiento,
      (NOW()::date - f.fechavencimiento::date) AS diasvencido,
      obs.sessionname
    FROM Facturas f
    INNER JOIN Clientes c ON f.clienteid = c.id
    INNER JOIN Organizaciones o ON c.organizacionid = o.id
    INNER JOIN Organizaciones_BaileysSession obs ON c.organizacionid = obs.organizacionid AND obs.activo = true
    WHERE COALESCE(f.agenteiaactivo, false) = true
      AND f.estado_factura_id NOT IN (3, 6)
      AND f.saldopendiente > 0
      AND c.telefonowhatsapp IS NOT NULL
      AND c.telefonowhatsapp != ''
    ORDER BY f.fechavencimiento ASC
  `);

  if (result.rows.length === 0) {
    console.log('[TEST] ❌ No hay facturas con AgenteIA activo y cliente con WhatsApp');
    await closeConnection();
    process.exit(0);
  }

  console.log(`[TEST] Encontradas ${result.rows.length} factura(s) elegibles:\n`);

  // Agrupar por cliente
  const porCliente = new Map<number, any[]>();
  for (const f of result.rows) {
    const key = f.clienteid;
    if (!porCliente.has(key)) porCliente.set(key, []);
    porCliente.get(key)!.push(f);
  }

  for (const [clienteId, facturas] of porCliente) {
    const cliente = facturas[0];
    const totalDeuda = facturas.reduce((sum: number, f: any) => sum + (parseFloat(f.saldopendiente) || parseFloat(f.total)), 0);
    const minDiasVencido = Math.min(...facturas.map((f: any) => parseInt(f.diasvencido)));
    const esPreVencimiento = minDiasVencido < 0;

    console.log(`  📋 Cliente: ${cliente.clientenombre}`);
    console.log(`     Teléfono: ${cliente.clientetelefono}`);
    console.log(`     Org: ${cliente.organizacionnombre}`);
    console.log(`     Facturas: ${facturas.length}`);
    console.log(`     Total deuda: $${totalDeuda.toFixed(2)}`);
    console.log(`     ${esPreVencimiento ? `Vence en ${Math.abs(minDiasVencido)} días` : `Vencida hace ${Math.abs(minDiasVencido)} días`}`);
    console.log(`     Sesión WA: ${cliente.sessionname}`);
    console.log('');

    // Construir contexto
    const context: MessageContext = {
      clienteNombre: cliente.clientenombre,
      clienteTelefono: cliente.clientetelefono,
      organizacionNombre: cliente.organizacionnombre,
      facturas: facturas.map((f: any) => ({
        numero: f.numerofactura,
        total: parseFloat(f.saldopendiente) || parseFloat(f.total),
        fechaVencimiento: f.fechavencimiento?.toISOString?.() || String(f.fechavencimiento),
        diasVencido: parseInt(f.diasvencido),
      })),
      totalDeuda,
      intentoNumero: 1,
      tienePromesaPago: false,
      esPreVencimiento,
    };

    // Generar mensaje
    let mensaje: string;
    if (aiReady) {
      console.log('[TEST] 🤖 Generando mensaje con IA...');
      mensaje = await composeCollectionMessage(context);
    } else {
      const formatMoney = (n: number) => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
      mensaje = `Hola ${context.clienteNombre}, le saludamos de ${context.organizacionNombre}. ` +
        `Le recordamos que tiene ${context.facturas.length} factura(s) pendiente(s) por un total de ${formatMoney(context.totalDeuda)}. ` +
        `¿Desea que le enviemos su estado de cuenta o tiene alguna duda sobre estas facturas?`;
    }

    console.log(`\n[TEST] 💬 Mensaje generado:\n────────────────────────────────`);
    console.log(mensaje);
    console.log('────────────────────────────────\n');

    // Enviar por WhatsApp
    const jid = phoneToJid(cliente.clientetelefono);
    console.log(`[TEST] 📤 Enviando a JID: ${jid} via sesión ${cliente.sessionname}...`);

    const sendResult = await sendWorkerMessage(cliente.sessionname, jid, mensaje);

    if (sendResult.success) {
      console.log(`[TEST] ✅ Mensaje enviado exitosamente (messageId: ${sendResult.messageId})`);

      // Registrar gestión en BD
      const userResult = await pool.query(
        'SELECT UsuarioCreadorId FROM Facturas WHERE Id = $1',
        [facturas[0].facturaid]
      );
      const usuarioId = userResult.rows[0]?.usuariocreadorid || 9;

      for (const f of facturas) {
        await pool.query(`
          INSERT INTO GestionesCobranza 
            (FacturaId, UsuarioId, TipoGestion, Descripcion, Resultado, FechaGestion, RequiereSeguimiento)
          VALUES 
            ($1, $2, 'recordatorio_automatico', $3, 'enviado', NOW(), true)
        `, [f.facturaid, usuarioId, `AGENTE_IA: ${mensaje}`]);
      }
      console.log(`[TEST] ✅ Gestión registrada en BD`);
    } else {
      console.log(`[TEST] ❌ Error enviando: ${sendResult.error}`);
    }
  }

  await closeConnection();
  console.log('\n[TEST] Proceso terminado.');
  process.exit(0);
}

main().catch(err => {
  console.error('[TEST] Error fatal:', err);
  process.exit(1);
});
