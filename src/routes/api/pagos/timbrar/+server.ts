import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getConnection } from '$lib/server/db';
import axios from 'axios';
import { getUserFromRequest, unauthorizedResponse, validateOrganizationAccess } from '$lib/server/auth';
import { checkRateLimit, getClientIP } from '$lib/server/security';
import { validarAccesoFuncion } from '$lib/server/validar-plan';

export const POST: RequestHandler = async (event) => {
  const user = getUserFromRequest(event);
  if (!user) {
    return unauthorizedResponse('Token de autenticación requerido');
  }

  const { request, url } = event;
  const organizacionId = url.searchParams.get('organizacionId');

  if (!organizacionId) {
    return json({ success: false, error: 'organizacionId es requerido' }, { status: 400 });
  }

  // Validar acceso a la organización
  const orgValidation = await validateOrganizationAccess(event, organizacionId);
  if (!orgValidation.valid) {
    return orgValidation.error!;
  }

  // Validar acceso a complemento automático según plan
  const accesoComplemento = await validarAccesoFuncion(parseInt(organizacionId), 'complementoAutomatico');
  if (!accesoComplemento.permitido) {
    return json({ success: false, error: accesoComplemento.mensaje }, { status: 403 });
  }

  // Rate limit: máximo 10 timbrados de pago por usuario por hora
  const clientIP = getClientIP(event);
  const rateLimitKey = `timbrar_pago:${user.id}:${clientIP}`;
  const rateCheck = checkRateLimit(rateLimitKey, 10, 30);
  if (!rateCheck.allowed) {
    return json({
      success: false,
      error: 'Demasiados intentos de timbrado. Intente de nuevo más tarde.'
    }, { status: 429 });
  }

  try {
    const body = await request.json();
    const { clienteId, facturas, fechaPago, metodoPago } = body;

    // Validaciones
    if (!clienteId || !facturas?.length || !fechaPago || !metodoPago) {
      return json({
        success: false,
        error: 'Faltan campos requeridos: clienteId, facturas, fechaPago, metodoPago'
      }, { status: 400 });
    }

    if (!Array.isArray(facturas) || facturas.length === 0) {
      return json({ success: false, error: 'Debe incluir al menos una factura' }, { status: 400 });
    }

    // Validar que todos los montos son positivos
    for (const f of facturas) {
      if (!f.facturaId || !f.montoPago || f.montoPago <= 0) {
        return json({
          success: false,
          error: 'Cada factura debe tener facturaId y montoPago > 0'
        }, { status: 400 });
      }
    }

    const pool = await getConnection();

    // 1. Obtener datos del cliente y verificar que pertenece a la organización
    const clienteResult = await pool.query(
			`
        SELECT
          c.id,
          c.razonsocial,
          c.rfc,
          c.correoprincipal,
          c.codigopostal,
          c.idclientefacturaapi,
          r.codigo as RegimenFiscalCodigo
        FROM Clientes c
        LEFT JOIN Regimen r ON c.regimenfiscalid = r.id_regimen
        WHERE c.id = $1 AND c.organizacionid = $2
      `,
			[clienteId, parseInt(organizacionId)]
		);

    if (!clienteResult.rows.length) {
      return json({
        success: false,
        error: 'Cliente no encontrado o no pertenece a tu organización'
      }, { status: 404 });
    }

    const cliente = clienteResult.rows[0];

    // 2. Obtener API Key de la organización
    const orgResult = await pool.query(
			`
        SELECT ApiKeyFacturaAPI
        FROM Organizaciones
        WHERE Id = $1
      `,
			[parseInt(organizacionId)]
		);

    const apiKey = orgResult.rows[0]?.apikeyfacturaapi;
    if (!apiKey) {
      return json({
        success: false,
        error: 'La organización no tiene API Key de Facturapi configurada'
      }, { status: 400 });
    }

    // 3. Validar y obtener datos de cada factura + contar parcialidades
    const facturasData = [];
    for (const f of facturas) {
      const facturaResult = await pool.query(
			`
          SELECT
            f.id,
            f.numero_factura,
            f.uuidfacturapi as uuid,
            f.saldopendiente,
            f.montototal,
            f.estado_factura_id,
            f.metodopago
          FROM Facturas f
          INNER JOIN Clientes c ON f.clienteid = c.id
          WHERE f.id = $1 AND c.organizacionid = $2
        `,
			[f.facturaId, parseInt(organizacionId)]
		);

      if (!facturaResult.rows.length) {
        return json({
          success: false,
          error: `Factura ${f.facturaId} no encontrada o no pertenece a tu organización`
        }, { status: 404 });
      }

      const factura = facturaResult.rows[0];

      // No permitir pagos a facturas canceladas
      if (factura.estado_factura_id === 6) {
        return json({
          success: false,
          error: `La factura ${factura.numero_factura} está cancelada. No se pueden registrar pagos.`
        }, { status: 403 });
      }

      // No permitir complemento de pago para facturas PUE
      if (factura.metodopago === 'PUE') {
        return json({
          success: false,
          error: `La factura ${factura.numero_factura} es de tipo PUE (Pago en Una sola Exhibición). No se puede emitir un complemento de pago.`
        }, { status: 400 });
      }

      if (!factura.uuid) {
        return json({
          success: false,
          error: `La factura ${factura.numero_factura} no tiene UUID. Debe estar timbrada para registrar pagos.`
        }, { status: 400 });
      }

      // Validar que el monto no exceda el saldo
      const saldo = parseFloat(factura.saldopendiente);
      const montoPago = parseFloat(f.montoPago);
      if (montoPago > saldo + 0.01) { // tolerancia de centavo
        return json({
          success: false,
          error: `El monto de pago (${montoPago}) excede el saldo pendiente (${saldo}) de la factura ${factura.numero_factura}`
        }, { status: 400 });
      }

      // Contar pagos previos para parcialidad (solo pagos activos, excluyendo cancelados)
      const conteoResult = await pool.query(
			'SELECT COUNT(*) as totalpagos FROM Pagos WHERE FacturaId = $1 AND COALESCE(Cancelado, false) = false',
			[f.facturaId]
		);

      const parcialidad = (conteoResult.rows[0]?.totalpagos || 0) + 1;

      facturasData.push({
        ...factura,
        montoPago,
        parcialidad,
        saldoAnterior: saldo
      });
    }

    // 4. Construir payload de Facturapi (Complemento de Pago - tipo P)
    // Usar IdClienteFacturaAPI si existe, sino construir customer inline
    let customerPayload: any;
    if (cliente.idclientefacturaapi) {
      customerPayload = cliente.idclientefacturaapi;
    } else {
      // Fallback: construir objeto de cliente inline
      const esPersonaFisica = cliente.rfc && cliente.rfc.length === 13;
      let legalName = cliente.razonsocial.toUpperCase();
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
        email: cliente.correoprincipal,
        tax_id: cliente.rfc,
        tax_system: String(cliente.regimenfiscalcodigo || '601'),
        address: {
          zip: cliente.codigopostal || '00000'
        }
      };
    }

    const facturapiPayload = {
      type: 'P',
      customer: customerPayload,
      complements: [
        {
          type: 'pago',
          data: [
            {
              payment_form: metodoPago,
              date: new Date(fechaPago + 'T12:00:00').toISOString(),
              related_documents: facturasData.map(f => ({
                uuid: f.uuid,
                amount: f.montoPago,
                installment: f.parcialidad,
                last_balance: f.saldoAnterior,
                taxes: [
                  {
                    base: parseFloat((f.montoPago / 1.16).toFixed(2)),
                    type: 'IVA',
                    rate: 0.16
                  }
                ]
              }))
            }
          ]
        }
      ]
    };

    // 5. Llamar a Facturapi
    let invoice: any;
    try {
      const response = await axios.post(
        'https://www.facturapi.io/v2/invoices',
        facturapiPayload,
        {
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          auth: { username: apiKey, password: '' }
        }
      );
      invoice = response.data;
    } catch (err: any) {
      console.error('[TIMBRAR PAGO] Error Facturapi:', err.response?.data || err.message);
      return json({
        success: false,
        error: 'Error al timbrar el complemento de pago en Facturapi',
        details: err.response?.data?.message || err.message
      }, { status: 502 });
    }

    // 6. Guardar pagos en BD y actualizar saldos
    const pagosCreados = [];
    for (const f of facturasData) {
      // Insertar pago con referencia al complemento timbrado
      const insertResult = await pool.query(
			`
          INSERT INTO Pagos (FacturaId, UsuarioId, Monto, FechaPago, Metodo, FacturapiPagoId, UUIDPago, CreatedAt, UpdatedAt)
          VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
				RETURNING id as id
        `,
			[f.id, user.id, f.montoPago, fechaPago, metodoPago, invoice.id || null, invoice.uuid || null]
		);

      const pagoId = insertResult.rows[0]?.id;
      pagosCreados.push({ pagoId, facturaId: f.id, monto: f.montoPago });

      // Actualizar saldo pendiente
      const nuevoSaldo = Math.max(f.saldoAnterior - f.montoPago, 0);
      await pool.query(
			`
          UPDATE Facturas
          SET SaldoPendiente = $2,
              estado_factura_id = CASE WHEN $2::numeric <= 0 THEN 3 ELSE estado_factura_id END
          WHERE Id = $1
        `,
			[f.id, nuevoSaldo]
		);
    }

    return json({
      success: true,
      message: 'Complemento de pago timbrado y pagos registrados correctamente',
      facturapiId: invoice.id,
      uuid: invoice.uuid,
      pagos: pagosCreados,
      totalPagado: facturasData.reduce((sum, f) => sum + f.montoPago, 0)
    }, { status: 201 });

  } catch (error: any) {
    console.error('[TIMBRAR PAGO] Error general:', error);
    return json({
      success: false,
      error: 'Error al procesar el pago',
      details: error.message
    }, { status: 500 });
  }
};
