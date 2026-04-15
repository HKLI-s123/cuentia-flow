import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { getConnection } from '$lib/server/db';
import axios from 'axios';
import { env } from '$env/dynamic/private';
import { hoyLocal } from '$lib/utils/date';
import { getUserFromRequest, unauthorizedResponse } from '$lib/server/auth';
import crypto from 'crypto';
import { validarAccesoFuncion } from '$lib/server/validar-plan';

function secureCompare(a: string, b: string): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a, 'utf-8');
  const bufB = Buffer.from(b, 'utf-8');
  if (bufA.length !== bufB.length) { crypto.timingSafeEqual(bufA, bufA); return false; }
  return crypto.timingSafeEqual(bufA, bufB);
}

/** Enviar mensaje WhatsApp al cliente vía el endpoint interno del worker */
async function enviarWhatsAppCliente(telefono: string, organizacionId: string, mensaje: string) {
  try {
    let clean = telefono.replace(/\D/g, '');
    if (clean.length === 10) clean = `521${clean}`;
    const jid = `${clean}@s.whatsapp.net`;
    const sessionName = `org_${organizacionId}_session`;

    const APP_BASE_URL = env.APP_BASE_URL || 'http://localhost:5173';
    const response = await fetch(`${APP_BASE_URL}/api/worker/send-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Worker-Secret': env.WORKER_SECRET || ''
      },
      body: JSON.stringify({ sessionName, jid, text: mensaje })
    });

    const result = await response.json();
    if (result.success) {
    } else {
      console.error('[COMPROBANTES] Error enviando WhatsApp:', result.error);
    }
    return result;
  } catch (err) {
    console.error('[COMPROBANTES] Error enviando WhatsApp:', err);
    return { success: false };
  }
}

/**
 * Resuelve organizacionId del usuario autenticado
 */
async function resolverOrganizacionId(locals: any, url: URL): Promise<string | null> {
  let organizacionId = url.searchParams.get('organizacionId');

  if (locals.user) {
    const pool = await getConnection();
    const usuarioOrgs = await pool.query(
			'SELECT uo.organizacionid FROM Usuario_Organizacion uo WHERE uo.usuarioid = $1',
			[locals.user.id]
		);

    if (usuarioOrgs.rows.length > 0) {
      let userOrgId = usuarioOrgs.rows[0].organizacionid;
      if (organizacionId && usuarioOrgs.rows.length > 1) {
        const parsedOrgId = parseInt(organizacionId);
        const orgEncontrada = usuarioOrgs.rows.find(
          (org: any) => org.organizacionid === parsedOrgId
        );
        if (orgEncontrada) userOrgId = parsedOrgId;
      }
      organizacionId = userOrgId.toString();
    }
  }

  return organizacionId;
}

/**
 * GET /api/cobrador-ia/comprobantes
 * Lista comprobantes de pago recibidos, con filtro por estado.
 * ?estado=pendiente|confirmado|rechazado (default: pendiente)
 */
export const GET: RequestHandler = async (event) => {
  const user = getUserFromRequest(event);
  if (!user) {
    return unauthorizedResponse('Token de autenticación requerido');
  }

  const organizacionId = await resolverOrganizacionId(event.locals, event.url);
  if (!organizacionId) {
    return json({ success: false, error: 'organizacionId es requerido' }, { status: 400 });
  }

  // Validar acceso Cobrador IA según plan
  const accesoIA = await validarAccesoFuncion(parseInt(organizacionId), 'agenteIA');
  if (!accesoIA.permitido) {
    return json({ success: false, error: accesoIA.mensaje }, { status: 403 });
  }

  const estado = event.url.searchParams.get('estado') || 'pendiente';
  const validEstados = ['pendiente', 'confirmado', 'rechazado'];
  if (!validEstados.includes(estado)) {
    return json({ success: false, error: 'estado inválido' }, { status: 400 });
  }

  try {
    const pool = await getConnection();
    const result = await pool.query(
			`
        SELECT
          cr.id,
          cr.facturaid,
          cr.montodetectado,
          cr.fechapagodetectada,
          cr.metodopagodetectado,
          cr.referenciabancaria,
          cr.bancoorigen,
          cr.bancodestino,
          cr.estado,
          cr.motivorechazo,
          cr.mensajetexto,
          cr.telefonocliente,
          cr.fecharecepcion,
          cr.fechaconfirmacion,
          cr.fecharechazo,
          cr.imagenmimetype,
          cr.datosextraidosjson,
          COALESCE(cr.recibidofueradeciclo, false) AS recibidofueradeciclo,
          f.numero_factura AS numerofactura,
          f.saldopendiente,
          f.montototal,
          c.razonsocial AS clientenombre,
          c.rfc AS clienterfc,
          c.telefonowhatsapp AS clientetelefono
        FROM ComprobantesRecibidos cr
        INNER JOIN Facturas f ON cr.facturaid = f.id
        INNER JOIN Clientes c ON f.clienteid = c.id
        WHERE cr.organizacionid = $1
          AND cr.estado = $2
        ORDER BY cr.fecharecepcion DESC
      `,
			[parseInt(organizacionId), estado]
		);

    return json({
      success: true,
      comprobantes: result.rows
    });
  } catch (error: any) {
    console.error('[COMPROBANTES] Error:', error);
    return json({ success: false, error: 'Error al obtener comprobantes' }, { status: 500 });
  }
};

/**
 * POST /api/cobrador-ia/comprobantes
 * Devuelve todas las facturas pendientes de un cliente dado un comprobanteId.
 * Body: { comprobanteId }
 */
export const POST: RequestHandler = async (event) => {
  const user = getUserFromRequest(event);
  if (!user) {
    return unauthorizedResponse('Token de autenticación requerido');
  }

  const organizacionId = await resolverOrganizacionId(event.locals, event.url);
  if (!organizacionId) {
    return json({ success: false, error: 'organizacionId es requerido' }, { status: 400 });
  }

  // Validar acceso Cobrador IA según plan
  const accesoIA = await validarAccesoFuncion(parseInt(organizacionId), 'agenteIA');
  if (!accesoIA.permitido) {
    return json({ success: false, error: accesoIA.mensaje }, { status: 403 });
  }

  try {
    const body = await event.request.json();
    const { comprobanteId } = body;

    if (!comprobanteId) {
      return json({ success: false, error: 'comprobanteId es requerido' }, { status: 400 });
    }

    const pool = await getConnection();

    // Obtener el comprobante y su cliente
    const compRes = await pool.query(
			`
        SELECT cr.facturaid, f.clienteid
        FROM ComprobantesRecibidos cr
        INNER JOIN Facturas f ON cr.facturaid = f.id
        WHERE cr.id = $1 AND cr.organizacionid = $2
      `,
			[comprobanteId, parseInt(organizacionId)]
		);

    if (!compRes.rows.length) {
      return json({ success: false, error: 'Comprobante no encontrado' }, { status: 404 });
    }

    const { clienteid } = compRes.rows[0];

    // Buscar TODAS las facturas pendientes del mismo cliente
    const facturasResult = await pool.query(
			`
        SELECT 
          f.id AS FacturaId,
          f.numero_factura,
          f.saldopendiente,
          f.montototal,
          f.fechavencimiento,
          f.uuidfacturapi,
          f.estado_factura_id
        FROM Facturas f
        INNER JOIN Clientes c ON f.clienteid = c.id
        WHERE f.clienteid = $1
          AND c.organizacionid = $2
          AND f.saldopendiente > 0
          AND f.estado_factura_id NOT IN (3, 6)
        ORDER BY f.fechavencimiento ASC
      `,
			[clienteid, parseInt(organizacionId)]
		);

    return json({
      success: true,
      facturas: facturasResult.rows
    });
  } catch (error: any) {
    console.error('[COMPROBANTES] Error obteniendo facturas del cliente:', error);
    return json({ success: false, error: 'Error al obtener facturas' }, { status: 500 });
  }
};

/**
 * GET /api/cobrador-ia/comprobantes?id=X&imagen=1
 * Returns the base64 image for a specific comprobante.
 * This is separate to avoid sending large images in the list.
 */

/**
 * PATCH /api/cobrador-ia/comprobantes
 * Confirma o rechaza un comprobante de pago.
 * Para confirmar con múltiples facturas:
 *   { comprobanteId, accion: 'confirmar', metodoPago?, fechaPago?,
 *     facturasSeleccionadas: [{ facturaId, monto }] }
 * Para confirmar con una sola factura (legacy):
 *   { comprobanteId, accion: 'confirmar', monto?, metodoPago?, fechaPago? }
 * Para rechazar:
 *   { comprobanteId, accion: 'rechazar', motivoRechazo? }
 */
export const PATCH: RequestHandler = async (event) => {
  const user = getUserFromRequest(event);
  if (!user) {
    return unauthorizedResponse('Token de autenticación requerido');
  }

  const organizacionId = await resolverOrganizacionId(event.locals, event.url);
  if (!organizacionId) {
    return json({ success: false, error: 'organizacionId es requerido' }, { status: 400 });
  }

  // Validar acceso Cobrador IA según plan
  const accesoIA = await validarAccesoFuncion(parseInt(organizacionId), 'agenteIA');
  if (!accesoIA.permitido) {
    return json({ success: false, error: accesoIA.mensaje }, { status: 403 });
  }

  try {
    const body = await event.request.json();
    const { comprobanteId, accion, motivoRechazo, monto, metodoPago, fechaPago } = body;

    if (!comprobanteId || !accion) {
      return json({ success: false, error: 'comprobanteId y accion son requeridos' }, { status: 400 });
    }

    if (!['confirmar', 'rechazar'].includes(accion)) {
      return json({ success: false, error: 'accion debe ser confirmar o rechazar' }, { status: 400 });
    }

    const pool = await getConnection();

    // Verificar que el comprobante pertenece a la organización y está pendiente
    const comprobanteResult = await pool.query(
			`
        SELECT
          cr.id, cr.facturaid, cr.montodetectado, cr.fechapagodetectada,
          cr.metodopagodetectado, cr.estado, cr.telefonocliente,
          f.saldopendiente, f.numero_factura, f.estado_factura_id,
          f.uuidfacturapi, f.usuariocreadorid,
          c.id AS ClienteId, c.razonsocial, c.rfc, c.idclientefacturaapi,
          c.correoprincipal, c.codigopostal,
          COALESCE(c.nombrecomercial, c.razonsocial) AS ClienteNombre,
          r.codigo as RegimenFiscalCodigo,
          o.apikeyfacturaapi, o.nombre AS OrgNombre
        FROM ComprobantesRecibidos cr
        INNER JOIN Facturas f ON cr.facturaid = f.id
        INNER JOIN Clientes c ON f.clienteid = c.id
        LEFT JOIN Regimen r ON c.regimenfiscalid = r.id_regimen
        INNER JOIN Organizaciones o ON cr.organizacionid = o.id
        WHERE cr.id = $1 AND cr.organizacionid = $2
      `,
			[comprobanteId, parseInt(organizacionId)]
		);

    if (!comprobanteResult.rows.length) {
      return json({ success: false, error: 'Comprobante no encontrado' }, { status: 404 });
    }

    const comprobante = comprobanteResult.rows[0];

    if (comprobante.estado !== 'pendiente') {
      return json({ success: false, error: `El comprobante ya fue ${comprobante.estado}` }, { status: 400 });
    }

    if (accion === 'rechazar') {
      // Rechazar el comprobante
      await pool.query(
			`
          UPDATE ComprobantesRecibidos
          SET Estado = 'rechazado',
              MotivoRechazo = $2,
              FechaRechazo = NOW(),
              UsuarioConfirmoId = $3,
              UpdatedAt = NOW()
          WHERE Id = $1
        `,
			[comprobanteId, motivoRechazo || 'Rechazado por el operador', user.id]
		);

      // Notificar al cliente por WhatsApp
      if (comprobante.telefonocliente) {
        let msgRechazo = `Hola ${comprobante.clientenombre}, revisamos el comprobante que nos enviaste para la factura ${comprobante.numero_factura}, pero no pudimos validarlo.\n\nMotivo: ${motivoRechazo || 'No se pudo verificar el comprobante'}\n\nPor favor envíanos nuevamente un comprobante válido. Si tienes dudas estamos para ayudarte.\n\n— ${comprobante.orgnombre}`;
        await enviarWhatsAppCliente(comprobante.telefonocliente, organizacionId, msgRechazo);
      }

      return json({
        success: true,
        message: 'Comprobante rechazado',
        comprobanteId
      });
    }

    // ═══ CONFIRMAR PAGO (multi-factura) ═══
    const { facturasSeleccionadas } = body;
    const metodo = body.metodoPago || comprobante.metodopagodetectado || '03';
    const fecha = body.fechaPago || comprobante.fechapagodetectada || hoyLocal();

    // Construir lista de facturas a pagar
    let facturasPagar: { facturaId: number; monto: number }[] = [];

    if (facturasSeleccionadas && Array.isArray(facturasSeleccionadas) && facturasSeleccionadas.length > 0) {
      // Multi-factura: validar cada entrada
      for (const fs of facturasSeleccionadas) {
        if (!fs.facturaId || !fs.monto || fs.monto <= 0) {
          return json({ success: false, error: 'Cada factura debe tener facturaId y un monto > 0' }, { status: 400 });
        }
        facturasPagar.push({ facturaId: parseInt(fs.facturaId), monto: parseFloat(fs.monto) });
      }
    } else {
      // Legacy: una sola factura
      const montoPago = body.monto || comprobante.montodetectado;
      if (!montoPago || montoPago <= 0) {
        return json({ success: false, error: 'Se requiere un monto válido' }, { status: 400 });
      }
      facturasPagar.push({ facturaId: comprobante.facturaid, monto: parseFloat(montoPago) });
    }

    // Validar que cada factura exista, pertenezca al mismo cliente, y el monto no exceda el saldo
    const resultados: any[] = [];

    // Prevención de duplicados: verificar que el comprobante no haya sido ya confirmado
    const dupCheck = await pool.query(
			`
          SELECT Id FROM ComprobantesRecibidos 
          WHERE Id = $1 AND Estado = 'confirmado'
				LIMIT 1
			`,
			[comprobanteId]
		);

    if (dupCheck.rows.length > 0) {
      return json({
        success: false,
        error: `Este comprobante ya fue confirmado.`
      }, { status: 409 });
    }

    for (const fp of facturasPagar) {
      const facCheck = await pool.query(
			`
          SELECT f.id, f.saldopendiente, f.numero_factura, f.uuidfacturapi, f.usuariocreadorid,
                 f.estado_factura_id
          FROM Facturas f
          WHERE f.id = $1 AND f.clienteid = $2
            AND f.saldopendiente > 0 AND f.estado_factura_id NOT IN (3, 6)
        `,
			[fp.facturaId, comprobante.clienteid]
		);

      if (!facCheck.rows.length) {
        return json({
          success: false,
          error: `Factura ${fp.facturaId} no encontrada, no pertenece al cliente, o ya está pagada`
        }, { status: 400 });
      }

      const fac = facCheck.rows[0];
      const saldo = parseFloat(fac.saldopendiente);
      const montoAplicar = Math.min(fp.monto, saldo);

      // Insertar pago
      const insertResult = await pool.query(
			`
          INSERT INTO Pagos (FacturaId, UsuarioId, Monto, FechaPago, Metodo, CreatedAt, UpdatedAt)
          VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
				RETURNING id as id
        `,
			[fp.facturaId, user.id, montoAplicar, fecha, metodo]
		);

      const pagoId = insertResult.rows[0]?.id;

      // Timbrar complemento en Facturapi
      let facturapiComplementoId: string | null = null;
      let uuidComplemento: string | null = null;

      const apiKey = comprobante.apikeyfacturaapi;
      const uuidFactura = fac.uuidfacturapi;

      if (apiKey && uuidFactura) {
        try {
          const conteoResult = await pool.query(
			'SELECT COUNT(*) as totalpagos FROM Pagos WHERE FacturaId = $1',
			[fp.facturaId]
		);
          const parcialidad = parseInt(conteoResult.rows[0]?.totalpagos || '1', 10);

          let customerPayload: any;
          if (comprobante.idclientefacturaapi) {
            customerPayload = comprobante.idclientefacturaapi;
          } else {
            const esPersonaFisica = comprobante.rfc && comprobante.rfc.length === 13;
            let legalName = comprobante.razonsocial.toUpperCase();
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
              email: comprobante.correoprincipal,
              tax_id: comprobante.rfc,
              tax_system: String(comprobante.regimenfiscalcodigo || '601'),
              address: { zip: comprobante.codigopostal || '00000' }
            };
          }

          const facturapiPayload = {
            type: 'P',
            customer: customerPayload,
            complements: [{
              type: 'pago',
              data: [{
                payment_form: metodo,
                date: new Date(fecha + 'T12:00:00').toISOString(),
                related_documents: [{
                  uuid: uuidFactura,
                  amount: montoAplicar,
                  installment: parcialidad,
                  last_balance: saldo,
                  taxes: [{
                    base: parseFloat((montoAplicar / 1.16).toFixed(2)),
                    type: 'IVA',
                    rate: 0.16
                  }]
                }]
              }]
            }]
          };

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
          await pool.query(
			`
              UPDATE Pagos
              SET FacturapiPagoId = $2, UUIDPago = $3, UpdatedAt = NOW()
              WHERE Id = $1
            `,
			[pagoId, facturapiComplementoId, uuidComplemento]
		);
        } catch (err: any) {
          console.error(`[COMPROBANTES] Error timbrado Facturapi para ${fac.numero_factura}:`, err.response?.data || err.message);
        }
      }

      // Actualizar saldo de la factura
      const nuevoSaldo = Math.max(saldo - montoAplicar, 0);
      await pool.query(
			`
          UPDATE Facturas
          SET SaldoPendiente = $2,
              estado_factura_id = CASE WHEN $2::numeric <= 0 THEN 3 ELSE estado_factura_id END
          WHERE Id = $1
        `,
			[fp.facturaId, nuevoSaldo]
		);

      // Marcar gestiones como PagoConfirmado
      await pool.query(
			`
          UPDATE GestionesCobranza
          SET PagoConfirmado = true
          WHERE FacturaId = $1
            AND COALESCE(ComprobantePagoRecibido, false) = true
            AND COALESCE(PagoConfirmado, false) = false
        `,
			[fp.facturaId]
		);

      resultados.push({
        facturaId: fp.facturaId,
        numeroFactura: fac.numero_factura,
        montoAplicado: montoAplicar,
        nuevoSaldo,
        pagoId,
        timbrado: !!facturapiComplementoId,
        facturapiComplementoId,
        uuidComplemento
      });
    }

    // Marcar comprobante como confirmado (con datos del primer pago para compatibilidad)
    const primerResultado = resultados[0];
    await pool.query(
			`
        UPDATE ComprobantesRecibidos
        SET Estado = 'confirmado',
            PagoId = $2,
            FacturapiComplementoId = $4,
            UUIDComplemento = $5,
            FechaConfirmacion = NOW(),
            UsuarioConfirmoId = $3,
            UpdatedAt = NOW()
        WHERE Id = $1
      `,
			[comprobanteId, primerResultado.pagoId, user.id, primerResultado.facturapiComplementoId, primerResultado.uuidComplemento]
		);

    // Notificar al cliente por WhatsApp
    if (comprobante.telefonocliente) {
      const montoTotal = resultados.reduce((s, r) => s + r.montoAplicado, 0);
      const montoStr = montoTotal.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
      const timbrados = resultados.filter(r => r.timbrado).length;

      let msgConfirm = `Hola ${comprobante.clientenombre}, confirmamos la recepción de tu pago de ${montoStr}`;

      if (resultados.length === 1) {
        const r = resultados[0];
        msgConfirm += ` para la factura ${r.numeroFactura}.`;
        if (r.nuevoSaldo > 0) {
          msgConfirm += `\n\nSaldo pendiente: $${r.nuevoSaldo.toLocaleString('es-MX', { minimumFractionDigits: 2 })}.`;
        } else {
          msgConfirm += `\n\nTu factura queda liquidada. 🎉`;
        }
      } else {
        msgConfirm += ` aplicado a ${resultados.length} facturas:`;
        for (const r of resultados) {
          const mStr = r.montoAplicado.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
          const saldoStr = r.nuevoSaldo > 0 ? `(saldo: $${r.nuevoSaldo.toLocaleString('es-MX', { minimumFractionDigits: 2 })})` : '✅ Liquidada';
          msgConfirm += `\n• ${r.numeroFactura}: ${mStr} ${saldoStr}`;
        }
      }

      if (timbrados > 0) {
        msgConfirm += `\n\n🧾 ${timbrados === 1 ? 'Complemento de pago timbrado' : `${timbrados} complementos de pago timbrados`} ante el SAT.`;
      }
      msgConfirm += `\n\n¡Gracias! — ${comprobante.orgnombre}`;
      await enviarWhatsAppCliente(comprobante.telefonocliente, organizacionId, msgConfirm);
    }

    return json({
      success: true,
      message: `Pago confirmado para ${resultados.length} factura${resultados.length > 1 ? 's' : ''}`,
      resultados,
      comprobanteId
    }, { status: 201 });

  } catch (error: any) {
    console.error('[COMPROBANTES] Error:', error);
    return json({ success: false, error: 'Error al procesar comprobante' }, { status: 500 });
  }
};
