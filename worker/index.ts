/**
 * CuentIA Flow - Cobrador Autónomo IA
 * 
 * Punto de entrada del worker.
 * Inicia las sesiones de WhatsApp, el scheduler y el motor de IA.
 */
import 'dotenv/config';
import http from 'http';
import { getConnection, closeConnection } from './db.js';
import { initAllSessions, onIncomingMessage, closeAllSessions, sendWorkerMessage, sendWorkerDocument, phoneToJid, processIncomingMessage, resolveLidToPhone } from './whatsapp.js';
import { startScheduler, setAIComposer, isWithinWorkingHours, agentContactedToday } from './scheduler.js';
import { ejecutarCicloRefacturacion, ejecutarEmisionProgramada } from './refacturacion.js';
import { initAI, composeCollectionMessage, analyzeClientResponse, saveMessageAnalysis, sanitizeInput, analyzePaymentProof } from './ai/agent.js';
import axios from 'axios';
import { secureCompare, checkRateLimit, validateIncomingMessage, maskPhone, maskSecret, MAX_BODY_SIZE, REQUEST_TIMEOUT_MS, IDLE_TIMEOUT_MS } from './security.js';

const VERSION = '0.2.1';
const WORKER_PORT = parseInt(process.env.WORKER_PORT || '3847');
const WORKER_SECRET = process.env.WORKER_SECRET || '';

// ═══ SEGURIDAD: Verificar que WORKER_SECRET esté configurado ═══
if (!WORKER_SECRET || WORKER_SECRET.length < 32) {
  console.error('[SEGURIDAD] ✗ WORKER_SECRET no configurado o es muy corto (mínimo 32 caracteres).');
  console.error('[SEGURIDAD]   Configura WORKER_SECRET en .env para proteger el worker.');
  process.exit(1);
}

// ═══════════════════════════════════════════════════════════════
// Procesamiento de comprobantes de pago (24/7, fuera o dentro de ciclo)
// ═══════════════════════════════════════════════════════════════
async function procesarComprobantePago(pool: any, message: any, fueraDeCiclo: boolean) {
  const replyJid = message.from || phoneToJid(message.fromPhone);

  // Buscar factura y cliente asociados al teléfono
  const facturaResult = await pool.query(
			`
      SELECT
        f.id AS FacturaId,
        f.saldopendiente,
        f.numero_factura,
        f.uuidfacturapi,
        f.usuariocreadorid,
        c.id AS ClienteId,
        COALESCE(c.nombrecomercial, c.razonsocial) AS ClienteNombre,
        c.razonsocial,
        c.rfc,
        c.idclientefacturaapi,
        c.correoprincipal,
        c.codigopostal,
        COALESCE(c.autocomplementopago, false) AS AutoComplementoPago,
        r.codigo AS RegimenFiscalCodigo,
        o.apikeyfacturaapi,
        o.nombre AS OrgNombre
      FROM Clientes c
      INNER JOIN Facturas f ON f.clienteid = c.id
      LEFT JOIN Regimen r ON c.regimenfiscalid = r.id_regimen
      INNER JOIN Organizaciones o ON c.organizacionid = o.id
      WHERE REPLACE(REPLACE(REPLACE(REPLACE(c.telefonowhatsapp, ' ', ''), '-', ''), '(', ''), ')', '') 
            LIKE '%' || RIGHT($1, 10)
        AND c.organizacionid = $2
        AND COALESCE(f.agenteiaactivo, false) = true
        AND f.estado_factura_id NOT IN (3, 6)
      ORDER BY f.fechavencimiento ASC
				LIMIT 1
			`,
			[message.fromPhone, message.organizacionId]
		);

  if (facturaResult.rows.length === 0) {
    console.log(`[Worker] 📸 Imagen recibida pero no se encontró factura activa para ${maskPhone(message.fromPhone)}`);
    return;
  }

  const fac = facturaResult.rows[0];

  // ═══ PREVENCIÓN DE DUPLICADOS: Solo bloquear si la factura ya está totalmente pagada ═══
  if (parseFloat(fac.saldopendiente) <= 0) {
    console.log(`[Worker] ⚠ Factura ${fac.numero_factura} ya está pagada (saldo=0). Ignorando comprobante duplicado.`);
    const dupMsg = `Hola ${fac.clientenombre}, la factura ${fac.numero_factura} ya está completamente pagada. Si tienes alguna duda, nuestro equipo te puede ayudar. ¡Gracias!`;
    await sendWorkerMessage(message.sessionName, replyJid, dupMsg);
    return;
  }

  // Analizar la imagen con OpenAI Vision
  const proofAnalysis = await analyzePaymentProof(
    message.imageBase64,
    message.imageMimetype,
    {
      clienteNombre: fac.clientenombre,
      montoEsperado: parseFloat(fac.saldopendiente)
    }
  );

  console.log(`[Worker] 📸 Resultado Vision: esComprobante=${proofAnalysis.esComprobantePago}, monto=${proofAnalysis.monto}, confianza=${proofAnalysis.confianza}`);

  if (!proofAnalysis.esComprobantePago) {
    console.log(`[Worker] 📸 La imagen NO es un comprobante de pago: ${proofAnalysis.resumen}`);
    return;
  }

  const saldo = parseFloat(fac.saldopendiente);
  const montoDetectado = proofAnalysis.monto || 0;
  const metodo = proofAnalysis.metodoPago || '03';
  const fechaPago = proofAnalysis.fechaPago || new Date().toISOString().split('T')[0];
  const montoCoincide = Math.abs(montoDetectado - saldo) <= 0.01 && montoDetectado > 0;
  // No auto-confirmar si fue recibido fuera de ciclo (requiere revisión manual)
  const autoConfirmar = montoCoincide && fac.autocomplementopago && !fueraDeCiclo;

  // Guardar comprobante en la tabla ComprobantesRecibidos
  const comprobanteInsert = await pool.query(
			`
      INSERT INTO ComprobantesRecibidos
        (FacturaId, OrganizacionId, ImagenBase64, ImagenMimetype,
         MontoDetectado, FechaPagoDetectada, MetodoPagoDetectado,
         ReferenciaBancaria, BancoOrigen, BancoDestino,
         DatosExtraidosJSON, MensajeTexto, TelefonoCliente,
         Estado, RecibidoFueraDeCiclo, FechaRecepcion, CreatedAt, UpdatedAt)
      VALUES
        ($1, $2, $3, $4,
         $5, $6, $7,
         $8, $9, $10,
         $11, $12, $13,
         $14, $15, NOW(), NOW(), NOW())
				RETURNING id as comprobanteId
    `,
			[fac.facturaid, message.organizacionId, message.imageBase64, message.imageMimetype, proofAnalysis.monto, proofAnalysis.fechaPago, proofAnalysis.metodoPago, proofAnalysis.referenciaBancaria, proofAnalysis.bancoOrigen, proofAnalysis.bancoDestino, JSON.stringify(proofAnalysis), message.text || null, message.fromPhone, autoConfirmar ? 'confirmado' : 'pendiente', fueraDeCiclo]
		);

  const comprobanteId = comprobanteInsert.rows[0]?.comprobanteId;

  // Marcar la gestión de cobranza como ComprobantePagoRecibido
  const usuarioId = fac.usuariocreadorid || 9;
  await pool.query(
			`
      INSERT INTO GestionesCobranza 
        (FacturaId, UsuarioId, TipoGestion, Descripcion, Resultado,
         FechaGestion, RequiereSeguimiento, ComprobantePagoRecibido,
         PromesaPagoMonto)
      VALUES 
        ($1, $2, 'respuesta_cliente',
         $3, 'confirma_pago',
         NOW(), true, true, $4)
    `,
			[fac.facturaid, usuarioId, `CLIENTE: [Comprobante de pago recibido${fueraDeCiclo ? ' - FUERA DE CICLO' : ''}] ${proofAnalysis.resumen}`, proofAnalysis.monto || 0]
		);

  // ═══ AUTO-CONFIRMACIÓN: Si monto coincide + AutoComplementoPago + dentro de ciclo ═══
  if (autoConfirmar) {
    console.log(`[Worker] 🤖 Monto coincide ($${montoDetectado} = saldo $${saldo}) + AutoComplemento activado. Auto-confirmando pago...`);

    try {
      // 1. Insertar pago
      const insertPago = await pool.query(
			`
          INSERT INTO Pagos (FacturaId, UsuarioId, Monto, FechaPago, Metodo, CreatedAt, UpdatedAt)
          VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
				RETURNING id as pagoId
        `,
			[fac.facturaid, usuarioId, montoDetectado, fechaPago, metodo]
		);
      const pagoId = insertPago.rows[0]?.pagoId;

      // 2. Actualizar saldo
      const nuevoSaldo = Math.max(saldo - montoDetectado, 0);
      await pool.query(
			`
          UPDATE Facturas
          SET SaldoPendiente = $2,
              estado_factura_id = CASE WHEN $2::numeric <= 0 THEN 3 ELSE estado_factura_id END
          WHERE Id = $1
        `,
			[fac.facturaid, nuevoSaldo]
		);

      // 3. Timbrar complemento en Facturapi
      let facturapiComplementoId: string | null = null;
      let uuidComplemento: string | null = null;
      const apiKey = fac.apikeyfacturaapi;
      const uuidFactura = fac.uuidfacturapi;

      if (apiKey && uuidFactura) {
        try {
          const conteoResult = await pool.query(
			'SELECT COUNT(*) as totalPagos FROM Pagos WHERE FacturaId = $1',
			[fac.facturaid]
		);
          const parcialidad = conteoResult.rows[0]?.totalPagos || 1;

          let customerPayload: any;
          if (fac.idclientefacturaapi) {
            customerPayload = fac.idclientefacturaapi;
          } else {
            const esPersonaFisica = fac.rfc && fac.rfc.length === 13;
            let legalName = fac.razonsocial.toUpperCase();
            if (!esPersonaFisica) {
              legalName = legalName
                .replace(/\s+S\.?\s?A\.?\s+(DE\s+)?C\.?\s?V\.?$/i, '')
                .replace(/\s+S\.?\s?DE\s+R\.?\s?L\.?(\s+DE\s+C\.?\s?V\.?)?$/i, '')
                .replace(/\s+S\.?\s?C\.?$/i, '')
                .replace(/\s+A\.?\s?C\.?$/i, '');
              legalName = legalName.trim();
            }
            customerPayload = {
              legal_name: legalName,
              email: fac.correoprincipal,
              tax_id: fac.rfc,
              tax_system: String(fac.regimenfiscalcodigo || '601'),
              address: { zip: fac.codigopostal || '00000' }
            };
          }

          const facturapiPayload = {
            type: 'P',
            customer: customerPayload,
            complements: [{
              type: 'pago',
              data: [{
                payment_form: metodo,
                date: new Date(fechaPago + 'T12:00:00').toISOString(),
                related_documents: [{
                  uuid: uuidFactura,
                  amount: montoDetectado,
                  installment: parcialidad,
                  last_balance: saldo,
                  taxes: [{
                    base: parseFloat((montoDetectado / 1.16).toFixed(2)),
                    type: 'IVA',
                    rate: 0.16
                  }]
                }]
              }]
            }]
          };

          console.log('[Worker] 🧾 Timbrado Facturapi payload:', JSON.stringify(facturapiPayload, null, 2));

          const response = await axios.post(
            'https://www.facturapi.io/v2/invoices',
            facturapiPayload,
            {
              headers: { 'Content-Type': 'application/json; charset=utf-8' },
              auth: { username: apiKey, password: '' }
            }
          );

          const invoice = response.data;
          facturapiComplementoId = invoice.id || null;
          uuidComplemento = invoice.uuid || null;
          console.log(`[Worker] ✅ Facturapi timbrado OK: id=${invoice.id}, uuid=${invoice.uuid}`);

          // Actualizar pago con datos del complemento
          await pool.query(
			`
              UPDATE Pagos
              SET FacturapiPagoId = $2,
                  UUIDPago = $3,
                  UpdatedAt = NOW()
              WHERE Id = $1
            `,
			[pagoId, facturapiComplementoId, uuidComplemento]
		);
        } catch (err: any) {
          console.error('[Worker] ❌ Error timbrado Facturapi:', err.response?.data || err.message);
        }
      }

      // 4. Actualizar comprobante como confirmado
      await pool.query(
			`
          UPDATE ComprobantesRecibidos
          SET PagoId = $2,
              FacturapiComplementoId = $3,
              UUIDComplemento = $4,
              FechaConfirmacion = NOW(),
              UpdatedAt = NOW()
          WHERE Id = $1
        `,
			[comprobanteId, pagoId, facturapiComplementoId, uuidComplemento]
		);

      // 5. Marcar gestiones como PagoConfirmado
      await pool.query(
			`
          UPDATE GestionesCobranza
          SET PagoConfirmado = true
          WHERE FacturaId = $1
            AND COALESCE(ComprobantePagoRecibido, false) = true
            AND COALESCE(PagoConfirmado, false) = false
        `,
			[fac.facturaid]
		);

      // 6. Enviar confirmación al cliente
      const montoStr = montoDetectado.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
      let confirmMsg = `¡Hola ${fac.clientenombre}! ✅ Confirmamos tu pago de ${montoStr} para la factura ${fac.numero_factura}.`;
      if (nuevoSaldo > 0) {
        confirmMsg += `\n\nTu saldo pendiente es de $${nuevoSaldo.toLocaleString('es-MX', { minimumFractionDigits: 2 })}.`;
      } else {
        confirmMsg += `\n\n🎉 ¡Tu factura queda completamente liquidada!`;
      }
      if (facturapiComplementoId) {
        confirmMsg += `\n🧾 Tu complemento de pago ya fue timbrado ante el SAT.`;
      }
      confirmMsg += `\n\n¡Gracias! — ${fac.orgnombre}`;
      await sendWorkerMessage(message.sessionName, replyJid, confirmMsg);
      console.log(`[Worker] ✅ Pago auto-confirmado y cliente notificado para factura ${fac.numero_factura}`);

    } catch (autoErr: any) {
      console.error('[Worker] ❌ Error en auto-confirmación:', autoErr.message || autoErr);
      await pool.query(
			`UPDATE ComprobantesRecibidos SET Estado = 'pendiente' WHERE Id = $1`,
			[comprobanteId]
		);
      const fallbackMsg = `¡Gracias por enviar su comprobante de pago! 📋 Lo hemos recibido y nuestro equipo lo revisará para confirmar la recepción del pago. Le notificaremos cuando sea procesado.`;
      await sendWorkerMessage(message.sessionName, replyJid, fallbackMsg);
    }
  } else {
    // Monto NO coincide, AutoComplemento desactivado, o fuera de ciclo → pendiente para revisión manual
    if (fueraDeCiclo) {
      console.log(`[Worker] ⚠ Comprobante recibido fuera de ciclo de cobranza. Queda pendiente para revisión manual.`);
    } else if (!fac.autocomplementopago) {
      console.log(`[Worker] ⚠ AutoComplementoPago desactivado para este cliente. Queda pendiente para revisión manual.`);
    } else {
      console.log(`[Worker] ⚠ Monto detectado ($${montoDetectado}) ≠ saldo pendiente ($${saldo}). Queda pendiente para revisión manual.`);
    }
    const montoStr = montoDetectado
      ? montoDetectado.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
      : '';
    const pendienteMsg = montoStr
      ? `¡Gracias por enviar tu comprobante de pago${montoStr ? ` por ${montoStr}` : ''}! 📋 Lo hemos recibido y nuestro equipo lo revisará para confirmar la recepción del pago. Te notificaremos cuando sea procesado.`
      : '¡Gracias por enviar tu comprobante! 📋 Lo hemos recibido y nuestro equipo lo revisará. Te notificaremos cuando sea procesado.';
    await sendWorkerMessage(message.sessionName, replyJid, pendienteMsg);
    console.log(`[Worker] Confirmación de recepción enviada a ${maskPhone(message.fromPhone)}`);
  }

  console.log(`[Worker] ✅ Comprobante de pago guardado para factura ${fac.numero_factura}${fueraDeCiclo ? ' [FUERA DE CICLO]' : ''}`);
}

async function main() {
  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log(`  CuentIA Flow - Cobrador Autónomo IA v${VERSION}`);
  console.log('═══════════════════════════════════════════════');
  console.log('');

  // 1. Verificar conexión a la base de datos
  console.log('[Worker] Conectando a base de datos...');
  try {
    await getConnection();
    console.log('[Worker] ✓ Base de datos conectada');
  } catch (err) {
    console.error('[Worker] ✗ Error conectando a la base de datos:', err);
    process.exit(1);
  }

  // 2. Inicializar motor de IA
  console.log('[Worker] Inicializando motor de IA...');
  const aiReady = initAI();
  if (aiReady) {
    console.log('[Worker] ✓ Motor de IA activo (OpenAI GPT-4o-mini)');
    setAIComposer(composeCollectionMessage);
  } else {
    console.log('[Worker] ⚠ Motor de IA no disponible. Usando mensajes template.');
  }

  // 3. Inicializar sesiones de WhatsApp
  console.log('[Worker] Iniciando sesiones de WhatsApp...');
  try {
    await initAllSessions();
    console.log('[Worker] ✓ Sesiones de WhatsApp iniciadas');
  } catch (err) {
    console.error('[Worker] ✗ Error iniciando sesiones de WhatsApp:', err);
    console.log('[Worker] El worker continuará pero sin WhatsApp activo.');
  }

  // 4. Registrar handler para mensajes entrantes
  onIncomingMessage(async (message) => {
    // ═══ RESOLVER LID: WhatsApp usa Linked Identity en vez de teléfono ═══
    const originalFrom = message.from; // Guardar JID original para responder
    
    // ═══ RESOLVER LID: WhatsApp usa Linked Identity en vez de teléfono ═══
    // Detectar LID independientemente de lo que envíe baileys (isLid, @lid en from o fromPhone)
    const isLid = message.isLid || message.from?.endsWith('@lid') || message.fromPhone?.includes('@lid');
    if (isLid) {
      // Limpiar @lid de fromPhone si aún lo tiene
      message.fromPhone = message.fromPhone.replace('@lid', '');
      console.log(`[Worker] Mensaje de LID ${maskPhone(message.fromPhone)}, resolviendo teléfono real...`);
      const realPhone = await resolveLidToPhone(message.organizacionId);
      if (!realPhone) {
        console.log(`[Worker] No se pudo resolver LID a un teléfono de org ${message.organizacionId}. Ignorando.`);
        return;
      }
      console.log(`[Worker] LID resuelto → ${maskPhone(realPhone)}`);
      message.fromPhone = realPhone;
    }

    console.log(`[Worker] Mensaje entrante de ${message.pushName || maskPhone(message.fromPhone)} (org: ${message.organizacionId})`);
    console.log(`[Worker] Texto: "${message.text.substring(0, 60)}${message.text.length > 60 ? '...' : ''}"`);

    try {
      const pool = await getConnection();

      // ═══ AUDIOS / NOTAS DE VOZ: Responder pidiendo texto ═══
      if (message.isAudio && !message.text.trim() && !message.imageBase64) {
        console.log(`[Worker] 🎙️ Audio recibido de ${maskPhone(message.fromPhone)}, solicitando mensaje de texto.`);
        const replyJid = originalFrom || phoneToJid(message.fromPhone);
        console.log(`[Worker] 🎙️ Respondiendo a JID: ${replyJid}, sesión: ${message.sessionName}`);
        const result = await sendWorkerMessage(message.sessionName, replyJid, 'Hola, por el momento no podemos escuchar notas de voz 🙏 ¿Podrías escribirnos tu mensaje por texto? Así te podemos ayudar más rápido. ¡Gracias!');
        console.log(`[Worker] 🎙️ Resultado envío:`, JSON.stringify(result));
        return;
      }

      // ═══ COMPROBANTES DE PAGO: Se aceptan 24/7, independiente del horario o contacto previo ═══
      if (message.imageBase64 && message.imageMimetype) {
        console.log(`[Worker] 📸 Imagen recibida de ${maskPhone(message.fromPhone)}, procesando comprobante de pago...`);
        const fueraDeHorario = !isWithinWorkingHours();
        const contactadoHoy = await agentContactedToday(message.fromPhone, message.organizacionId);
        const fueraDeCiclo = fueraDeHorario || !contactadoHoy;

        if (fueraDeCiclo) {
          console.log(`[Worker] 📸 Comprobante recibido fuera de ciclo (horario=${!fueraDeHorario}, contactadoHoy=${contactadoHoy}). Se procesará igual.`);
        }

        await procesarComprobantePago(pool, message, fueraDeCiclo);

        // Si también hay texto y estamos en horario/ciclo, continuar al flujo normal de texto
        if (message.text.trim() && !fueraDeCiclo) {
          // Continuar abajo para procesar el texto
        } else {
          return;
        }
      }

      // ═══ REGLA: Solo "escuchar" dentro de horario laboral ═══
      if (!isWithinWorkingHours()) {
        console.log('[Worker] Fuera de horario laboral. Guardando mensaje sin responder.');
        await saveMessageAnalysis(message, {
          intent: 'no_relevante',
          confidence: 0,
          resumen: 'Mensaje recibido fuera de horario laboral',
          requiereHumano: false,
        });
        return;
      }

      // ═══ REGLA: Solo responder si el agente contactó al cliente HOY ═══
      const contactedToday = await agentContactedToday(message.fromPhone, message.organizacionId);
      if (!contactedToday) {
        console.log(`[Worker] El agente NO contactó a ${maskPhone(message.fromPhone)} hoy. Guardando sin responder.`);
        await saveMessageAnalysis(message, {
          intent: 'no_relevante',
          confidence: 0,
          resumen: 'Mensaje recibido sin contacto previo hoy, guardado para contexto futuro',
          requiereHumano: false,
        });
        return;
      }

      // ═══ RATE-LIMIT: Máximo 15 mensajes por cliente por día ═══
      const rateCheck = await pool.query(
			`
          SELECT COUNT(*) AS total
          FROM GestionesCobranza gc
          INNER JOIN Facturas f ON gc.facturaid = f.id
          INNER JOIN Clientes c ON f.clienteid = c.id
          WHERE REPLACE(REPLACE(REPLACE(REPLACE(c.telefonowhatsapp, ' ', ''), '-', ''), '(', ''), ')', '') 
                LIKE '%' || RIGHT($1, 10)
            AND c.organizacionid = $2
            AND gc.fechagestion::date = CURRENT_DATE
        `,
			[message.fromPhone, message.organizacionId]
		);

      const mensajesHoy = rateCheck.rows[0]?.total || 0;
      if (mensajesHoy >= 15) {
        console.log(`[Worker] Rate-limit alcanzado para ${maskPhone(message.fromPhone)} (${mensajesHoy}/15 hoy). No responder.`);
        return;
      }

      // ═══ SANITIZAR: Protección contra prompt injection ═══
      const sanitizedMessage = { ...message, text: sanitizeInput(message.text) };

      // Obtener nombre de la organización
      const orgResult = await pool.query(
			`SELECT Nombre FROM Organizaciones WHERE Id = $1`,
			[message.organizacionId]
		);

      const orgNombre = orgResult.rows[0]?.nombre || 'Empresa';

      // Buscar historial de conversación reciente (últimos 10 mensajes de hoy)
      const historialResult = await pool.query(
			`
          SELECT gc.descripcion, gc.usuarioid, gc.fechagestion, gc.tipogestion
          FROM GestionesCobranza gc
          INNER JOIN Facturas f ON gc.facturaid = f.id
          INNER JOIN Clientes c ON f.clienteid = c.id
          WHERE REPLACE(REPLACE(REPLACE(REPLACE(c.telefonowhatsapp, ' ', ''), '-', ''), '(', ''), ')', '') 
                LIKE '%' || RIGHT($1, 10)
            AND c.organizacionid = $2
            AND gc.fechagestion::date = CURRENT_DATE
          ORDER BY gc.fechagestion DESC
				LIMIT 10
			`,
			[message.fromPhone, message.organizacionId]
		);

      const historial = historialResult.rows.map((h: any) =>
        `[${h.descripcion?.startsWith('AGENTE_IA:') ? 'Agente' : 'Cliente'}]: ${h.descripcion?.replace(/^(AGENTE_IA|CLIENTE): /, '') || ''}`
      ).reverse();

      // Obtener facturas pendientes del cliente para dar contexto al análisis
      const facturasClienteResult = await pool.query(
			`
          SELECT f.numero_factura, f.saldopendiente, f.montototal, f.fechavencimiento,
                 (NOW()::date - f.fechavencimiento::date) AS DiasVencido,
                 ef.codigo AS EstadoCodigo
          FROM Facturas f
          INNER JOIN Clientes c ON f.clienteid = c.id
          INNER JOIN estados_factura ef ON f.estado_factura_id = ef.id
          WHERE REPLACE(REPLACE(REPLACE(REPLACE(c.telefonowhatsapp, ' ', ''), '-', ''), '(', ''), ')', '') 
                LIKE '%' || RIGHT($1, 10)
            AND c.organizacionid = $2
            AND COALESCE(f.agenteiaactivo, false) = true
            AND f.saldopendiente > 0
            AND f.estado_factura_id NOT IN (3, 5, 6)
          ORDER BY f.fechavencimiento ASC
        `,
			[message.fromPhone, message.organizacionId]
		);

      const formatMoney = (n: number) => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
      const facturasContext = facturasClienteResult.rows.length > 0
        ? facturasClienteResult.rows.map((f: any) => {
            const saldo = parseFloat(f.saldopendiente);
            const total = parseFloat(f.montototal);
            const parcial = saldo < total ? ` (pago parcial, total original: ${formatMoney(total)})` : '';
            return `- ${f.numero_factura}: ${formatMoney(saldo)}${parcial}, vence ${new Date(f.fechavencimiento).toISOString().split('T')[0]}`;
          }).join('\n')
        : 'No tiene facturas pendientes actualmente.';

      // Analizar intención del mensaje (con texto sanitizado)
      const analysis = await analyzeClientResponse(sanitizedMessage, orgNombre, historial, facturasContext);
      console.log(`[Worker] Intención: ${analysis.intent} (confianza: ${(analysis.confidence * 100).toFixed(0)}%)`);

      // ═══ VALIDAR PROMESA DE PAGO: Si la fecha es posterior al vencimiento, escalar ═══
      if (analysis.intent === 'promesa_pago' && analysis.fechaPago) {
        const fechaPromesa = new Date(analysis.fechaPago);
        const vencimientoResult = await pool.query(
			`
            SELECT f.fechavencimiento
            FROM Facturas f
            INNER JOIN Clientes c ON f.clienteid = c.id
            WHERE REPLACE(REPLACE(REPLACE(REPLACE(c.telefonowhatsapp, ' ', ''), '-', ''), '(', ''), ')', '') 
                  LIKE '%' || RIGHT($1, 10)
              AND c.organizacionid = $2
              AND COALESCE(f.agenteiaactivo, false) = true
            ORDER BY f.fechavencimiento ASC
				LIMIT 1
			`,
			[message.fromPhone, message.organizacionId]
		);

        const fechaVencimiento = vencimientoResult.rows[0]?.fechavencimiento;
        if (fechaVencimiento && fechaPromesa > new Date(fechaVencimiento)) {
          console.log(`[Worker] ⚠ Promesa de pago (${analysis.fechaPago}) es posterior al vencimiento (${new Date(fechaVencimiento).toISOString().split('T')[0]}). Escalando.`);
          analysis.requiereHumano = true;
          analysis.respuestaSugerida = 'Entendemos su situación. Permítanos revisarlo con nuestro equipo y en breve nos comunicamos con usted para encontrar la mejor solución. ¡Gracias por su respuesta!';
        }
      }

      // Guardar análisis en la BD
      await saveMessageAnalysis(sanitizedMessage, analysis);

      // Si requiere humano, enviar respuesta de cortesía y parar
      if (analysis.requiereHumano) {
        const replyJid = originalFrom || phoneToJid(message.fromPhone);
        if (analysis.respuestaSugerida) {
          await sendWorkerMessage(message.sessionName, replyJid, analysis.respuestaSugerida);
          console.log(`[Worker] Respuesta de escalamiento enviada a ${maskPhone(message.fromPhone)}`);
        }
        console.log(`[Worker] ⚠ Escalando a humano: ${analysis.resumen}`);
        return;
      }

      // Usar el JID original para responder (puede ser @lid o @s.whatsapp.net)
      const replyJid = originalFrom || phoneToJid(message.fromPhone);

      // Responder automáticamente si hay respuesta sugerida
      if (analysis.respuestaSugerida) {
        await sendWorkerMessage(message.sessionName, replyJid, analysis.respuestaSugerida);
        console.log(`[Worker] Respuesta enviada a ${maskPhone(message.fromPhone)}`);
      }

      // ═══ ENVIAR DOCUMENTOS: Si el cliente pidió PDF o XML ═══
      if (analysis.documentosSolicitados && analysis.documentosSolicitados.length > 0) {
        try {
          // Si el cliente mencionó un número de factura específico, buscar esa; si no, todas las pendientes
          const docParams: any[] = [message.fromPhone, message.organizacionId];
          let docQuery = `
              SELECT f.id, f.numero_factura, f.pdfbase64, f.xmlbase64
              FROM facturas f
              INNER JOIN clientes c ON f.clienteid = c.id
              WHERE REPLACE(REPLACE(REPLACE(REPLACE(c.telefonowhatsapp, ' ', ''), '-', ''), '(', ''), ')', '') 
                    LIKE '%' || RIGHT($1, 10)
                AND c.organizacionid = $2
                AND COALESCE(f.agenteiaactivo, false) = true
                AND f.estado_factura_id NOT IN (3, 6)
                AND f.saldopendiente > 0`;

          if (analysis.facturaNumeroSolicitada) {
            // Buscar por número de factura (coincidencia parcial, sin guiones)
            const numLimpio = analysis.facturaNumeroSolicitada.replace(/[-_ ]/g, '');
            docParams.push(`%${numLimpio}%`);
            docQuery += `\n                AND REPLACE(REPLACE(f.numero_factura, '-', ''), ' ', '') LIKE $${docParams.length}`;
          }
          docQuery += `\n              ORDER BY f.fechavencimiento ASC`;

          const docResult = await pool.query(docQuery, docParams);

          if (docResult.rows.length > 0) {
            for (const fac of docResult.rows) {
              const numFactura = fac.numero_factura || `FAC-${fac.id}`;

              for (const tipo of analysis.documentosSolicitados) {
                if (tipo === 'pdf' && fac.pdfbase64) {
                  await sendWorkerDocument(
                    message.sessionName, replyJid,
                    `📄 Factura ${numFactura} - PDF`,
                    fac.pdfbase64,
                    `${numFactura}.pdf`,
                    'application/pdf'
                  );
                  console.log(`[Worker] PDF de factura ${numFactura} enviado a ${maskPhone(message.fromPhone)}`);
                } else if (tipo === 'xml' && fac.xmlbase64) {
                  await sendWorkerDocument(
                    message.sessionName, replyJid,
                    `📋 Factura ${numFactura} - XML`,
                    fac.xmlbase64,
                    `${numFactura}.xml`,
                    'application/xml'
                  );
                  console.log(`[Worker] XML de factura ${numFactura} enviado a ${maskPhone(message.fromPhone)}`);
                } else {
                  console.log(`[Worker] No se encontró ${tipo.toUpperCase()} para factura ${numFactura}`);
                }
              }
            }
          } else {
            console.log(`[Worker] No se encontró factura con documentos para ${message.fromPhone}`);
          }
        } catch (docErr) {
          console.error('[Worker] Error enviando documentos:', docErr);
        }
      }
    } catch (err) {
      console.error('[Worker] Error procesando mensaje entrante:', err);
    }
  });

  // 5. Iniciar scheduler
  console.log('[Worker] Iniciando scheduler de cobranza...');
  startScheduler();
  console.log('[Worker] ✓ Scheduler activo');

  // 6. Iniciar servidor HTTP para recibir mensajes de la app web
  const server = http.createServer(async (req, res) => {
    const clientIP = req.socket.remoteAddress || 'unknown';

    // ═══ SEGURIDAD: Solo aceptar rutas válidas ═══
    const validRoutes = ['/incoming', '/refacturacion'];
    if (req.method !== 'POST' || !validRoutes.includes(req.url || '')) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }

    // ═══ SEGURIDAD: Rate limit por IP ═══
    if (!checkRateLimit(clientIP)) {
      console.warn(`[SEGURIDAD] Rate limit excedido para ${clientIP}`);
      res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': '60' });
      res.end(JSON.stringify({ error: 'Demasiadas solicitudes' }));
      return;
    }

    // ═══ SEGURIDAD: Validar secreto con timing-safe comparison ═══
    const incomingSecret = req.headers['x-worker-secret'];
    if (!secureCompare(String(incomingSecret || ''), WORKER_SECRET)) {
      console.warn(`[SEGURIDAD] Autenticación fallida desde ${clientIP}`);
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'No autorizado' }));
      return;
    }

    // ═══ POST /refacturacion — Trigger manual del ciclo ═══
    if (req.url === '/refacturacion') {
      console.log('[Worker] Trigger manual de refacturación recibido');
      (async () => {
        await ejecutarEmisionProgramada();
        await ejecutarCicloRefacturacion();
      })()
        .then(() => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, message: 'Emisión programada + refacturación ejecutados' }));
        })
        .catch((err) => {
          console.error('[Worker] Error en refacturación manual:', err);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Error ejecutando refacturación' }));
        });
      return;
    }

    // ═══ POST /incoming — Mensajes entrantes ═══
    // ═══ SEGURIDAD: Validar Content-Type ═══
    const contentType = req.headers['content-type'];
    if (!contentType || !contentType.includes('application/json')) {
      res.writeHead(415, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Content-Type debe ser application/json' }));
      return;
    }

    // ═══ SEGURIDAD: Leer body con límite de tamaño ═══
    let body = '';
    let bodySize = 0;
    let aborted = false;

    req.on('data', (chunk) => {
      bodySize += chunk.length;
      if (bodySize > MAX_BODY_SIZE) {
        aborted = true;
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Payload demasiado grande' }));
        req.destroy();
        return;
      }
      body += chunk;
    });

    req.on('end', async () => {
      if (aborted) return;
      try {
        const message = JSON.parse(body);

        // ═══ SEGURIDAD: Validar estructura del payload ═══
        const validationError = validateIncomingMessage(message);
        if (validationError) {
          console.warn(`[SEGURIDAD] Payload inválido desde ${clientIP}: ${validationError}`);
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: validationError }));
          return;
        }

        await processIncomingMessage(message);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        if (err instanceof SyntaxError) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'JSON inválido' }));
        } else {
          console.error('[Worker HTTP] Error procesando request');
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Error interno' }));
        }
      }
    });
  });

  // ═══ SEGURIDAD: Timeouts para prevenir slowloris ═══
  server.requestTimeout = REQUEST_TIMEOUT_MS;
  server.headersTimeout = REQUEST_TIMEOUT_MS;
  server.keepAliveTimeout = IDLE_TIMEOUT_MS;

  // ═══ SEGURIDAD: Bind SOLO a localhost (127.0.0.1) ═══
  server.listen(WORKER_PORT, '127.0.0.1', () => {
    console.log(`[Worker] ✓ Servidor HTTP escuchando en 127.0.0.1:${WORKER_PORT} (solo local)`);
  });

  console.log('');
  console.log('[Worker] ═══════════════════════════════════════');
  console.log('[Worker]   Cobrador Autónomo IA en ejecución');
  console.log(`[Worker]   API: http://localhost:${WORKER_PORT}`);
  console.log('[Worker]   Presiona Ctrl+C para detener');
  console.log('[Worker] ═══════════════════════════════════════');
  console.log('');
}

// Graceful shutdown
async function shutdown() {
  console.log('\n[Worker] Deteniendo cobrador autónomo...');

  try {
    await closeAllSessions();
    console.log('[Worker] ✓ Sesiones de WhatsApp cerradas');
  } catch (err) {
    console.error('[Worker] Error cerrando sesiones:', err);
  }

  try {
    await closeConnection();
    console.log('[Worker] ✓ Conexión a BD cerrada');
  } catch (err) {
    console.error('[Worker] Error cerrando BD:', err);
  }

  console.log('[Worker] Cobrador autónomo detenido.');
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('uncaughtException', (err) => {
  console.error('[Worker] Error no capturado:', err);
  // Salir porque el proceso está en estado desconocido
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  console.error('[Worker] Promesa rechazada no manejada:', reason);
});

main().catch((err) => {
  console.error('[Worker] Error fatal:', err);
  process.exit(1);
});
