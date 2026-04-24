/**
 * Scheduler del Cobrador Autónomo
 * 
 * REGLAS DE OPERACIÓN:
 * - Activo de 7:00 AM a 6:00 PM, Lunes a Viernes
 * - Analiza facturas con AgenteIAActivo=1 y estado_factura_id != 6 (cancelada)
 * - Inicia cobranza 5 días ANTES del vencimiento
 * - Solo responde al cliente el MISMO DÍA que le envió mensaje (7am-6pm)
 * - Máximo 15 mensajes por cliente por día
 * - Protección contra prompt injection en respuestas
 */
import cron from 'node-cron';
import { getConnection } from './db.js';
import { sendWorkerMessage, getActiveSessions, phoneToJid } from './whatsapp.js';
import { ejecutarCicloRefacturacion, ejecutarEmisionProgramada } from './refacturacion.js';

const APP_BASE_URL = process.env.WORKER_API_BASE_URL || process.env.APP_INTERNAL_URL || process.env.APP_BASE_URL || 'http://localhost:5173';
const WORKER_SECRET = process.env.WORKER_SECRET || '';

// ═══════════════════════════════════════
// CONFIGURACIÓN
// ═══════════════════════════════════════
const CONFIG = {
  HORA_INICIO: 7,               // 7:00 AM
  HORA_FIN: 18,                 // 6:00 PM
  DIAS_ANTES_VENCIMIENTO: 5,    // Empezar a cobrar 5 días antes
  MAX_MENSAJES_DIA_CLIENTE: 15, // Rate limit por cliente por día
  MAX_LARGO_RESPUESTA: 500,     // Truncar respuestas del cliente (anti prompt injection)
  DELAY_MIN_MS: 3000,           // Delay mínimo entre mensajes
  DELAY_MAX_MS: 8000,           // Delay máximo entre mensajes
};

// Referencia al motor de IA (se inyecta desde index.ts)
let aiComposer: ((context: MessageContext) => Promise<string>) | null = null;

export interface MessageContext {
  clienteNombre: string;
  clienteTelefono: string;
  organizacionNombre: string;
  facturas: Array<{
    numero: string;
    total: number;
    fechaVencimiento: string;
    diasVencido: number;       // Negativo = faltan días, positivo = ya venció
  }>;
  totalDeuda: number;
  intentoNumero: number;
  ultimaRespuesta?: string;
  tienePromesaPago: boolean;
  promesaPagoFecha?: string;
  esPreVencimiento: boolean;    // true si aún no vence la factura
}

/**
 * Verifica si estamos dentro del horario laboral (L-V 7am-6pm)
 */
export function isWithinWorkingHours(): boolean {
  const now = new Date();
  const day = now.getDay(); // 0=Domingo, 6=Sábado
  const hour = now.getHours();
  return day >= 1 && day <= 5 && hour >= CONFIG.HORA_INICIO && hour < CONFIG.HORA_FIN;
}

/**
 * Inyecta el compositor de mensajes con IA
 */
export function setAIComposer(composer: (context: MessageContext) => Promise<string>): void {
  aiComposer = composer;
}

/**
 * Verifica si el agente envió un mensaje a este cliente HOY (ventana de escucha)
 */
export async function agentContactedToday(clientePhone: string, organizacionId: number): Promise<boolean> {
  const pool = await getConnection();
  const result = await pool.query(
			`
      SELECT COUNT(*) AS cnt
      FROM GestionesCobranza gc
      INNER JOIN Facturas f ON gc.facturaid = f.id
      INNER JOIN Clientes c ON f.clienteid = c.id
      WHERE REPLACE(REPLACE(REPLACE(REPLACE(c.telefonowhatsapp, ' ', ''), '-', ''), '(', ''), ')', '') 
            LIKE '%' || RIGHT($1, 10)
        AND c.organizacionid = $2
        AND gc.tipogestion IN ('recordatorio_automatico', 'seguimiento_promesa')
        AND gc.descripcion LIKE 'AGENTE_IA:%'
        AND CAST(gc.fechagestion AS DATE) = CAST(NOW() AS DATE)
    `,
			[clientePhone, organizacionId]
		);
  return parseInt(result.rows[0]?.cnt || '0', 10) > 0;
}

/**
 * Cuenta mensajes enviados hoy a un cliente (rate limit)
 */
async function contarMensajesHoyCliente(clienteId: number, organizacionId: number): Promise<number> {
  const pool = await getConnection();
  const result = await pool.query(
			`
      SELECT COUNT(*) AS total
      FROM GestionesCobranza gc
      INNER JOIN Facturas f ON gc.facturaid = f.id
      WHERE f.clienteid = $1 
        AND (SELECT c2.organizacionid FROM Clientes c2 WHERE c2.id = f.clienteid) = $2
        AND CAST(gc.fechagestion AS DATE) = CAST(NOW() AS DATE)
        AND gc.descripcion LIKE 'AGENTE_IA:%'
    `,
			[clienteId, organizacionId]
		);
  return parseInt(result.rows[0]?.total || '0', 10);
}

/**
 * Obtiene facturas elegibles para cobranza de una organización
 * - AgenteIAActivo = 1
 * - estado_factura_id != 6 (no canceladas)
 * - FechaVencimiento dentro de los próximos 5 días O ya vencida
 * - Cliente tiene teléfono
 */
async function getCuentasPendientes(organizacionId: number): Promise<any[]> {
  const pool = await getConnection();
  const result = await pool.query(
			`
      SELECT 
        c.id AS ClienteId,
        COALESCE(c.nombrecomercial, c.razonsocial) AS ClienteNombre,
        c.telefonowhatsapp AS ClienteTelefono,
        c.correoprincipal AS ClienteEmail,
        o.nombre AS OrganizacionNombre,
        f.id AS FacturaId,
        COALESCE(f.numero_factura, CAST(f.id AS TEXT)) AS NumeroFactura,
        f.montototal AS Total,
        f.saldopendiente,
        f.fechavencimiento,
        (NOW()::date - f.fechavencimiento::date) AS DiasVencido,
        (
          SELECT COUNT(*) 
          FROM GestionesCobranza gc 
          INNER JOIN Facturas f2 ON gc.facturaid = f2.id
          WHERE f2.clienteid = c.id 
            AND gc.descripcion LIKE 'AGENTE_IA:%'
            AND gc.tipogestion = 'recordatorio_automatico'
        ) AS RecordatoriosEnviados,
        (
          SELECT gc.descripcion
          FROM GestionesCobranza gc
          INNER JOIN Facturas f2 ON gc.facturaid = f2.id
          WHERE f2.clienteid = c.id 
            AND gc.tipogestion = 'respuesta_cliente'
          ORDER BY gc.fechagestion DESC
        ) AS UltimaRespuestaCliente,
        (
          SELECT gc.resultado
          FROM GestionesCobranza gc
          INNER JOIN Facturas f2 ON gc.facturaid = f2.id
          WHERE f2.clienteid = c.id 
          ORDER BY gc.fechagestion DESC
          LIMIT 1
        ) AS UltimoResultado,
        (
          SELECT gc.promesapagofecha
          FROM GestionesCobranza gc
          INNER JOIN Facturas f2 ON gc.facturaid = f2.id
          WHERE f2.clienteid = c.id 
            AND gc.resultado = 'promesa_pago'
          ORDER BY gc.fechagestion DESC
          LIMIT 1
        ) AS PromesaPagoFecha
      FROM Facturas f
      INNER JOIN Clientes c ON f.clienteid = c.id
      INNER JOIN Organizaciones o ON c.organizacionid = o.id
      WHERE c.organizacionid = $1
        AND COALESCE(f.agenteiaactivo, false) = true
        AND f.estado_factura_id NOT IN (3, 6)
        AND f.saldopendiente > 0
        AND c.telefonowhatsapp IS NOT NULL
        AND c.telefonowhatsapp != ''
        AND (f.fechavencimiento::date - NOW()::date) <= $2
      ORDER BY f.fechavencimiento ASC
				LIMIT 1
			`,
			[organizacionId, CONFIG.DIAS_ANTES_VENCIMIENTO]
		);

  return result.rows;
}

/**
 * Agrupa facturas por cliente
 */
function agruparPorCliente(facturas: any[]): Map<number, any[]> {
  const grupos = new Map<number, any[]>();
  for (const f of facturas) {
    const clienteId = f.clienteid;
    if (!grupos.has(clienteId)) {
      grupos.set(clienteId, []);
    }
    grupos.get(clienteId)!.push(f);
  }
  return grupos;
}

/**
 * Registra una gestión de cobranza en BD
 */
async function registrarGestion(params: {
  facturaId: number;
  tipo: string;
  mensaje: string;
  resultado: string;
}): Promise<void> {
  const pool = await getConnection();
  // Obtener UsuarioCreadorId de la factura para cumplir FK
  const userResult = await pool.query(
			'SELECT UsuarioCreadorId FROM Facturas WHERE Id = $1',
			[params.facturaId]
		);
  const usuarioId = userResult.rows[0]?.usuariocreadorid || 9;

  await pool.query(
			`
      INSERT INTO GestionesCobranza 
        (FacturaId, UsuarioId, TipoGestion, Descripcion, Resultado, FechaGestion, RequiereSeguimiento)
      VALUES 
        ($1, $2, $3, $4, $5, NOW(), true)
    `,
			[params.facturaId, usuarioId, params.tipo, `AGENTE_IA: ${params.mensaje}`, params.resultado]
		);
}

/**
 * Ejecuta un ciclo de cobranza para todas las organizaciones activas
 */
export async function ejecutarCicloCobranza(): Promise<void> {
  // Verificar horario laboral
  if (!isWithinWorkingHours()) {
    console.log('[SCHEDULER] Fuera de horario laboral (L-V 7am-6pm). Saltando ciclo.');
    return;
  }

  console.log('\n[SCHEDULER] ======= INICIO CICLO DE COBRANZA =======');
  const allSessions = await getActiveSessions();
  const activeSessions = allSessions.filter(s => s.connected);

  if (activeSessions.length === 0) {
    console.log('[SCHEDULER] No hay sesiones de WhatsApp activas');
    return;
  }

  console.log(`[SCHEDULER] Procesando ${activeSessions.length} organizaciones`);

  for (const session of activeSessions) {
    try {
      console.log(`[SCHEDULER] --- Org ${session.organizacionId} (${session.sessionName}) ---`);
      
      const cuentas = await getCuentasPendientes(session.organizacionId);
      if (cuentas.length === 0) {
        console.log(`[SCHEDULER] Sin facturas elegibles para org ${session.organizacionId}`);
        continue;
      }

      const porCliente = agruparPorCliente(cuentas);
      console.log(`[SCHEDULER] ${cuentas.length} facturas de ${porCliente.size} clientes`);

      for (const [clienteId, facturas] of porCliente) {
        const cliente = facturas[0];

        // Rate-limit: máximo mensajes por día por cliente
        const mensajesHoy = await contarMensajesHoyCliente(clienteId, session.organizacionId);
        if (mensajesHoy >= CONFIG.MAX_MENSAJES_DIA_CLIENTE) {
          console.log(`[SCHEDULER] Cliente ${cliente.clientenombre} alcanzó límite diario (${mensajesHoy}/${CONFIG.MAX_MENSAJES_DIA_CLIENTE})`);
          continue;
        }

        // Verificar si ya se contactó hoy (no enviar más de 1 mensaje de cobranza por día)
        const pool = await getConnection();
        const hoy = await pool.query(
			`
            SELECT COUNT(*) AS contactosHoy
            FROM GestionesCobranza gc
            INNER JOIN Facturas f ON gc.facturaid = f.id
            WHERE f.clienteid = $1 
              AND CAST(gc.fechagestion AS DATE) = CAST(NOW() AS DATE)
              AND gc.descripcion LIKE 'AGENTE_IA:%'
              AND gc.tipogestion = 'recordatorio_automatico'
          `,
			[clienteId]
		);

        if (parseInt(hoy.rows[0]?.contactosHoy || '0', 10) > 0) {
          console.log(`[SCHEDULER] Cliente ${cliente.clientenombre} ya fue contactado hoy, saltando`);
          continue;
        }

        const totalDeuda = facturas.reduce((sum: number, f: any) => sum + (parseFloat(f.saldopendiente) || f.total), 0);
        const maxRecordatorios = Math.max(...facturas.map((f: any) => f.recordatoriosenviados));
        const minDiasVencido = Math.min(...facturas.map((f: any) => f.diasvencido));
        const esPreVencimiento = minDiasVencido < 0; // Negativo = aún no vence

        // Construir contexto para el mensaje
        const context: MessageContext = {
          clienteNombre: cliente.clientenombre,
          clienteTelefono: cliente.clientetelefono,
          organizacionNombre: cliente.organizacionnombre,
          facturas: facturas.map((f: any) => ({
            numero: f.numerofactura,
            total: parseFloat(f.saldopendiente) || f.total,
            fechaVencimiento: f.fechavencimiento?.toISOString?.() || '',
            diasVencido: f.diasvencido,
          })),
          totalDeuda,
          intentoNumero: maxRecordatorios + 1,
          ultimaRespuesta: cliente.ultimarespuestacliente || undefined,
          tienePromesaPago: cliente.ultimoresultado === 'promesa_pago',
          promesaPagoFecha: cliente.promesapagofecha?.toISOString?.(),
          esPreVencimiento,
        };

        // Generar mensaje con IA o usar template básico
        let mensaje: string;
        if (aiComposer) {
          mensaje = await aiComposer(context);
        } else {
          mensaje = generarMensajeBasico(context);
        }

        // Enviar WhatsApp
        const jid = phoneToJid(cliente.clientetelefono);
        const result = await sendWorkerMessage(session.sessionName, jid, mensaje);

        if (result.success) {
          console.log(`[SCHEDULER] ✅ Mensaje enviado a ${cliente.clientenombre} (${facturas.length} factura(s), ` +
            `${esPreVencimiento ? `vence en ${Math.abs(minDiasVencido)} días` : `vencida hace ${Math.abs(minDiasVencido)} días`})`);

          // Registrar gestión por cada factura del cliente
          for (const f of facturas) {
            await registrarGestion({
              facturaId: f.facturaid,
              tipo: 'recordatorio_automatico',
              mensaje,
              resultado: 'enviado',
            });
          }
        } else {
          console.error(`[SCHEDULER] ❌ Error enviando a ${cliente.clientenombre}: ${result.error}`);
        }

        // Esperar entre mensajes para no saturar WhatsApp
        await new Promise(r => setTimeout(r, CONFIG.DELAY_MIN_MS + Math.random() * (CONFIG.DELAY_MAX_MS - CONFIG.DELAY_MIN_MS)));
      }
    } catch (err) {
      console.error(`[SCHEDULER] Error procesando org ${session.organizacionId}:`, err);
    }
  }

  console.log('[SCHEDULER] ======= FIN CICLO DE COBRANZA =======\n');
}

/**
 * Genera un mensaje básico sin IA (fallback)
 */
function generarMensajeBasico(ctx: MessageContext): string {
  const formatMoney = (n: number) => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

  // Seguimiento de promesa de pago
  if (ctx.tienePromesaPago && ctx.promesaPagoFecha) {
    return `Hola ${ctx.clienteNombre}, le saludamos de ${ctx.organizacionNombre}. ` +
      `Nos comunicamos para dar seguimiento a su compromiso de pago. ` +
      `Tiene ${ctx.facturas.length} factura(s) pendiente(s) por un total de ${formatMoney(ctx.totalDeuda)}. ` +
      `¿Pudo realizar el pago o necesita algún apoyo? Estamos para ayudarle.`;
  }

  // PRE-VENCIMIENTO: la factura aún no vence
  if (ctx.esPreVencimiento) {
    const diasFaltan = Math.abs(Math.min(...ctx.facturas.map(f => f.diasVencido)));
    if (diasFaltan >= 4) {
      // -5 días: primer aviso amable
      return `Hola ${ctx.clienteNombre}, le saludamos de ${ctx.organizacionNombre}. ` +
        `Le recordamos que su factura por ${formatMoney(ctx.totalDeuda)} vence en ${diasFaltan} días. ` +
        `Si ya tiene programado su pago, no se preocupe. Si necesita su estado de cuenta, con gusto se lo enviamos.`;
    }
    // -2 a -1 días: vence pronto
    return `Hola ${ctx.clienteNombre}, de ${ctx.organizacionNombre}. ` +
      `Su factura por ${formatMoney(ctx.totalDeuda)} vence ${diasFaltan === 1 ? 'mañana' : `en ${diasFaltan} días`}. ` +
      `¿Ya tiene programado su pago? Si necesita datos bancarios o su estado de cuenta, estamos para ayudarle.`;
  }

  // POST-VENCIMIENTO: primer intento
  if (ctx.intentoNumero <= 1) {
    return `Hola ${ctx.clienteNombre}, le saludamos cordialmente de ${ctx.organizacionNombre}. ` +
      `Le recordamos que tiene ${ctx.facturas.length} factura(s) con saldo pendiente por ${formatMoney(ctx.totalDeuda)}. ` +
      `¿Desea que le enviemos su estado de cuenta o tiene alguna duda sobre estas facturas?`;
  }

  // Segundo intento
  if (ctx.intentoNumero <= 3) {
    const maxDias = Math.max(...ctx.facturas.map(f => f.diasVencido));
    return `Hola ${ctx.clienteNombre}, le contactamos nuevamente de ${ctx.organizacionNombre}. ` +
      `Su saldo pendiente de ${formatMoney(ctx.totalDeuda)} tiene ${maxDias} días de atraso. ` +
      `Nos gustaría acordar una fecha de pago. ¿Cuándo le sería posible liquidar? ` +
      `Puede responder a este mensaje para coordinar.`;
  }

  // Tercer+ intento: más firme
  const maxDias = Math.max(...ctx.facturas.map(f => f.diasVencido));
  return `Hola ${ctx.clienteNombre}, de ${ctx.organizacionNombre}. ` +
    `Su cuenta presenta un atraso de ${maxDias} días por ${formatMoney(ctx.totalDeuda)}. ` +
    `Es importante regularizar su situación a la brevedad. ` +
    `Por favor indíquenos cuándo puede realizar su pago o si necesita un plan de pagos.`;
}

/**
 * Verifica que las sesiones de Baileys estén realmente conectadas.
 * Si no lo están, solicita auto-restore al servidor SvelteKit.
 */
async function verificarSaludBaileys(): Promise<void> {
  const sessions = await getActiveSessions();
  if (sessions.length === 0) {
    console.log('[HEALTH] No hay sesiones activas en BD');
    return;
  }

  for (const session of sessions) {
    try {
      const response = await fetch(`${APP_BASE_URL}/api/worker/health`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Worker-Secret': WORKER_SECRET,
        },
        body: JSON.stringify({
          sessionName: session.sessionName,
          autoRestore: true,
        }),
      });

      const raw = await response.text();
      let data: any = null;
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = { error: raw?.slice(0, 180) || 'Respuesta no JSON' };
      }

      if (!response.ok) {
        console.warn(`[HEALTH] ⚠ Health endpoint respondió HTTP ${response.status} para ${session.sessionName}: ${data?.error || 'sin detalle'}`);
        continue;
      }

      if (data.status === 'activo') {
        if (data.restored) {
          console.log(`[HEALTH] ✅ Sesión ${session.sessionName} restaurada automáticamente`);
        } else {
          console.log(`[HEALTH] ✅ Sesión ${session.sessionName} conectada (tel: ${data.telefono || 'N/A'})`);
        }
      } else {
        console.warn(`[HEALTH] ⚠ Sesión ${session.sessionName} NO está activa: ${data.status} - ${data.error || ''}`);
      }
    } catch (err) {
      console.error(`[HEALTH] ❌ Error verificando sesión ${session.sessionName}:`, err instanceof Error ? err.message : err);
    }
  }
}

/**
 * Inicia los cron jobs del scheduler
 */
export function startScheduler(): void {
  // Ciclo principal de cobranza: cada hora L-V de 7am a 5pm (el ciclo valida horario internamente)
  cron.schedule('0 7,9,11,14,16 * * 1-5', async () => {
    console.log(`[SCHEDULER] Disparando ciclo de cobranza (${new Date().toLocaleTimeString('es-MX')})`);
    // Verificar salud de Baileys antes de enviar mensajes
    await verificarSaludBaileys().catch(err => console.error('[HEALTH] Error pre-ciclo:', err));
    ejecutarCicloCobranza().catch(err => console.error('[SCHEDULER] Error:', err));
  });

  // Seguimiento de promesas de pago: L-V a las 10:00 AM
  cron.schedule('0 10 * * 1-5', () => {
    if (!isWithinWorkingHours()) return;
    console.log('[SCHEDULER] Revisando promesas de pago vencidas');
    ejecutarSeguimientoPromesas().catch(err => console.error('[SCHEDULER] Error promesas:', err));
  });

  // Health check de Baileys: cada 10 minutos L-V de 7am a 6pm
  cron.schedule('*/10 7-17 * * 1-5', () => {
    verificarSaludBaileys().catch(err => console.error('[HEALTH] Error:', err));
  });

  // Refacturación automática: todos los días a las 6:00 AM
  cron.schedule('0 6 * * *', async () => {
    console.log('[SCHEDULER] Disparando emisión programada + refacturación');
    // Primero: timbrar facturas con fecha de emisión que ya llegó
    await ejecutarEmisionProgramada().catch(err => console.error('[SCHEDULER] Error emisión programada:', err));
    // Después: generar nuevas facturas recurrentes
    await ejecutarCicloRefacturacion().catch(err => console.error('[SCHEDULER] Error refacturación:', err));
  });

  console.log('[SCHEDULER] Cron jobs iniciados');
  console.log(`[SCHEDULER]   → Horario activo: L-V ${CONFIG.HORA_INICIO}:00 AM - ${CONFIG.HORA_FIN}:00 PM`);
  console.log(`[SCHEDULER]   → Cobranza: 7am, 9am, 11am, 2pm, 4pm`);
  console.log(`[SCHEDULER]   → Cobro inicia: ${CONFIG.DIAS_ANTES_VENCIMIENTO} días antes del vencimiento`);
  console.log(`[SCHEDULER]   → Rate-limit: ${CONFIG.MAX_MENSAJES_DIA_CLIENTE} mensajes/día/cliente`);
  console.log(`[SCHEDULER]   → Promesas de pago: L-V 10:00 AM`);
  console.log(`[SCHEDULER]   → Health check Baileys: cada 10 min (L-V 7am-6pm)`);
  console.log(`[SCHEDULER]   → Refacturación: diario a las 6:00 AM`);

  // Health check inicial al arrancar (sin esperar al cron)
  setTimeout(() => {
    verificarSaludBaileys().catch(err => console.error('[HEALTH] Error en check inicial:', err));
  }, 5000);
}

/**
 * Revisa promesas de pago que ya vencieron y envía seguimiento
 */
async function ejecutarSeguimientoPromesas(): Promise<void> {
  if (!isWithinWorkingHours()) {
    console.log('[SCHEDULER] Fuera de horario laboral. Saltando seguimiento de promesas.');
    return;
  }

  console.log('[SCHEDULER] Revisando promesas de pago vencidas...');
  
  const pool = await getConnection();
  const result = await pool.query(`
    SELECT 
      f.clienteid, gc.facturaid,
      gc.promesapagofecha, gc.promesapagomonto,
      COALESCE(c.nombrecomercial, c.razonsocial) AS ClienteNombre, 
      c.telefonowhatsapp AS ClienteTelefono,
      o.nombre AS OrganizacionNombre,
      f.montototal AS Total, 
      COALESCE(f.numero_factura, CAST(f.id AS TEXT)) AS NumeroFactura,
      obs.sessionname
    FROM GestionesCobranza gc
    INNER JOIN Facturas f ON gc.facturaid = f.id
    INNER JOIN Clientes c ON f.clienteid = c.id
    INNER JOIN Organizaciones o ON c.organizacionid = o.id
    INNER JOIN Organizaciones_BaileysSession obs ON c.organizacionid = obs.organizacionid AND obs.activo = true
    WHERE gc.resultado = 'promesa_pago'
      AND gc.promesapagofecha IS NOT NULL
      AND gc.promesapagofecha < NOW()
      AND f.estado_factura_id != 6
      AND COALESCE(f.agenteiaactivo, false) = true
      AND NOT EXISTS (
        SELECT 1 FROM GestionesCobranza gc2
        WHERE gc2.facturaid = gc.facturaid
          AND gc2.fechagestion > gc.fechagestion
      )
  `);

  if (result.rows.length === 0) {
    console.log('[SCHEDULER] No hay promesas de pago vencidas');
    return;
  }

  console.log(`[SCHEDULER] ${result.rows.length} promesas vencidas encontradas`);

  for (const promesa of result.rows) {
    const formatMoney = (n: number) => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
    const mensaje = `Hola ${promesa.clientenombre}, le saludamos de ${promesa.organizacionnombre}. ` +
      `Nos comunicamos para dar seguimiento al pago que se comprometió a realizar. ` +
      `La factura ${promesa.numerofactura} por ${formatMoney(promesa.total)} continúa pendiente. ` +
      `¿Pudo realizar el pago? Si ya lo hizo, por favor envíenos su comprobante. Estamos para ayudarle.`;

    const jid = phoneToJid(promesa.clientetelefono);
    const result2 = await sendWorkerMessage(promesa.sessionname, jid, mensaje);

    if (result2.success) {
      await registrarGestion({
        facturaId: promesa.facturaid,
        tipo: 'seguimiento_promesa',
        mensaje,
        resultado: 'enviado',
      });
      console.log(`[SCHEDULER] ✅ Seguimiento enviado a ${promesa.clientenombre}`);
    }

    await new Promise(r => setTimeout(r, 3000 + Math.random() * 3000));
  }
}

/**
 * Ejecuta un ciclo manual (para testing)
 */
export async function ejecutarCicloManual(): Promise<void> {
  await ejecutarCicloCobranza();
}
