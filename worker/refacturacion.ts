/**
 * Worker de Refacturación - Genera facturas recurrentes automáticamente
 * 
 * LÓGICA:
 * 1. Busca facturas con RecurrenciaActiva=1 y FechaInicioRecurrencia <= HOY
 * 2. Calcula si hoy toca generar una nueva factura según el periodo configurado
 * 3. Copia conceptos+impuestos de la factura template → nueva factura
 * 4. Timbra automáticamente con Facturapi
 * 5. Verifica condiciones de finalización (nunca/fecha/ocurrencias)
 */
import { getConnection } from './db.js';
import { sendWorkerDocument, phoneToJid } from './whatsapp.js';
import axios from 'axios';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const EMAIL_FROM = process.env.EMAIL_FROM || process.env.RESEND_FROM || '';
const RECURRENCIA_TIMEZONE = process.env.WORKER_TIMEZONE || process.env.TZ || 'America/Mexico_City';

// ═══════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════
interface FacturaRecurrente {
  id: number;
  clienteid: number;
  montototal: number;
  metodopago: string;
  formapago: string;
  usocfdi: string;
  ordencompra: string | null;
  moneda: string;
  tipocambio: number;
  condicionespago: string | null;
  notascliente: string | null;
  notasinternas: string | null;
  desglosarimpuestos: boolean;
  identificador: string | null;
  usuariocreadorid: number | null;
  agenteiaactivo: boolean;
  // Recurrencia
  periodorecurrencia: string;
  diarecurrencia: string;
  cadarecurrencia: string;
  finrecurrencia: string;
  fechainiciorecurrencia: Date;
  fechaprimerafactura: Date;
  fechafinrecurrencia: Date | null;
  numeroocurrencias: number | null;
  ordenrecurrencia: string | null;
  identificadorrecurrencia: string | null;
  // Organización
  organizacionid: number;
  organizacionrfc: string;
  apikeyfacturaapi: string | null;
  // Tracking
  ultimafacturagenerada: Date | null;
  facturasgeneradas: number;
  numero_factura: string;
  // Envío
  enviarporcorreo: boolean;
  enviarporwhatsapp: boolean;
  // Plan
  planorganizacion: string;
}

interface ConceptoTemplate {
  Nombre: string;
  Descripcion: string | null;
  ClaveProdServ: string;
  UnidadMedida: string;
  Cantidad: number;
  PrecioUnitario: number;
  Subtotal: number;
  MonedaProducto: string;
  ObjetoImpuesto: string;
  TotalImpuestos: number;
  Total: number;
  ConceptoId: number;
}

interface ImpuestoTemplate {
  Tipo: string;
  Tasa: number;
  Monto: number;
}

// ═══════════════════════════════════════
// FUNCIONES AUXILIARES
// ═══════════════════════════════════════

/**
 * Normaliza una fecha (de SQL Server o Date) a medianoche LOCAL sin problemas de timezone
 * SQL Server devuelve fechas como UTC (2026-04-01T00:00:00.000Z) que al convertir
 * a local pueden caer en el día anterior. Esta función extrae año/mes/día y crea local.
 */
function fechaLocal(d: Date | string): Date {
  const fecha = new Date(d);
  return new Date(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate());
}

function obtenerHoyEnZona(timeZone: string): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const year = Number(parts.find((p) => p.type === 'year')?.value || '1970');
  const month = Number(parts.find((p) => p.type === 'month')?.value || '1');
  const day = Number(parts.find((p) => p.type === 'day')?.value || '1');
  return new Date(year, month - 1, day);
}

/**
 * Calcula si hoy toca generar una nueva factura recurrente
 */
function evaluarRecurrenciaHoy(factura: FacturaRecurrente): { generar: boolean; motivo?: string } {
  const hoy = obtenerHoyEnZona(RECURRENCIA_TIMEZONE);

  const fechaInicio = fechaLocal(factura.fechainiciorecurrencia);

  // Si aún no llegamos a la fecha de inicio, no generar
  if (hoy < fechaInicio) {
    return { generar: false, motivo: `fecha inicio futura (${fechaInicio.toISOString().split('T')[0]})` };
  }

  // Si la última factura fue generada hoy, no duplicar
  if (factura.ultimafacturagenerada) {
    const ultimaGen = fechaLocal(factura.ultimafacturagenerada);
    if (ultimaGen.getTime() === hoy.getTime()) {
      return { generar: false, motivo: `ya generada hoy (${ultimaGen.toISOString().split('T')[0]})` };
    }
  }

  // Verificar condiciones de finalización
  if (factura.finrecurrencia === 'el-dia' && factura.fechafinrecurrencia) {
    const fechaFin = fechaLocal(factura.fechafinrecurrencia);
    if (hoy > fechaFin) {
      return { generar: false, motivo: `recurrencia finalizada por fecha (${fechaFin.toISOString().split('T')[0]})` };
    }
  }

  if (factura.finrecurrencia === 'despues-de' && factura.numeroocurrencias) {
    if (factura.facturasgeneradas >= factura.numeroocurrencias) {
      return { generar: false, motivo: `recurrencia finalizada por ocurrencias (${factura.facturasgeneradas}/${factura.numeroocurrencias})` };
    }
  }

  const periodo = factura.periodorecurrencia;
  const cada = parseInt(factura.cadarecurrencia) || 1;

  if (periodo === 'diario') {
    // Cada N días desde la fecha de inicio
    const diffDias = Math.floor((hoy.getTime() - fechaInicio.getTime()) / 86400000);
    const generar = diffDias % cada === 0;
    return generar
      ? { generar: true }
      : { generar: false, motivo: `periodo diario: hoy no coincide con intervalo cada ${cada} dia(s)` };
  }

  if (periodo === 'semanal') {
    // Cada N semanas desde la fecha de inicio
    const diffDias = Math.floor((hoy.getTime() - fechaInicio.getTime()) / 86400000);
    const diffSemanas = Math.floor(diffDias / 7);
    const diaSemanaInicio = fechaInicio.getDay();
    const generar = diffDias % 7 === 0 && diffSemanas % cada === 0 && hoy.getDay() === diaSemanaInicio;
    return generar
      ? { generar: true }
      : { generar: false, motivo: `periodo semanal: hoy no coincide con semana/dia configurado` };
  }

  if (periodo === 'mensual') {
    // Día específico del mes, cada N meses
    const diaDelMes = parseInt(factura.diarecurrencia) || 1;
    
    // Verificar que el día del mes coincida (ajustar para meses cortos)
    const ultimoDiaDelMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
    const diaEfectivo = Math.min(diaDelMes, ultimoDiaDelMes);
    
    if (hoy.getDate() !== diaEfectivo) {
      return { generar: false, motivo: `periodo mensual: dia esperado ${diaEfectivo}, hoy ${hoy.getDate()}` };
    }

    // Verificar que hayan pasado N meses desde el inicio
    const mesesDesdeInicio = (hoy.getFullYear() - fechaInicio.getFullYear()) * 12 + (hoy.getMonth() - fechaInicio.getMonth());
    const generar = mesesDesdeInicio >= 0 && mesesDesdeInicio % cada === 0;
    return generar
      ? { generar: true }
      : { generar: false, motivo: `periodo mensual: meses desde inicio ${mesesDesdeInicio}, intervalo cada ${cada}` };
  }

  if (periodo === 'personalizado') {
    // Día específico del mes, cada N meses (mismo que mensual pero con intervalo personalizado)
    const diaDelMes = parseInt(factura.diarecurrencia) || 1;
    const ultimoDiaDelMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
    const diaEfectivo = Math.min(diaDelMes, ultimoDiaDelMes);
    
    if (hoy.getDate() !== diaEfectivo) {
      return { generar: false, motivo: `periodo personalizado: dia esperado ${diaEfectivo}, hoy ${hoy.getDate()}` };
    }

    const mesesDesdeInicio = (hoy.getFullYear() - fechaInicio.getFullYear()) * 12 + (hoy.getMonth() - fechaInicio.getMonth());
    const generar = mesesDesdeInicio >= 0 && mesesDesdeInicio % cada === 0;
    return generar
      ? { generar: true }
      : { generar: false, motivo: `periodo personalizado: meses desde inicio ${mesesDesdeInicio}, intervalo cada ${cada}` };
  }

  return { generar: false, motivo: `periodo no soportado: ${periodo}` };
}

/**
 * Calcula la fecha de vencimiento basada en condiciones de pago
 */
function calcularFechaVencimiento(fechaEmision: string, condicionesPago: string | null): string {
  const diasMap: { [key: string]: number } = {
    'contado': 0, '7-dias': 7, '15-dias': 15, '30-dias': 30,
    '45-dias': 45, '60-dias': 60, '90-dias': 90,
    'De Contado': 0, '7 Días': 7, '15 Días': 15, '30 Días': 30,
    '45 Días': 45, '60 Días': 60, '90 Días': 90
  };
  const dias = condicionesPago ? (diasMap[condicionesPago] ?? 30) : 30;
  const fecha = new Date(fechaEmision);
  fecha.setDate(fecha.getDate() + dias);
  return fecha.toISOString().split('T')[0];
}

/**
 * Genera el próximo número de factura consecutivo para la organización
 */
async function generarNumeroFactura(pool: any, organizacionId: number, organizacionRFC: string): Promise<string> {
  const prefijo = organizacionRFC.toUpperCase().substring(0, 3);

  const result = await pool.query(
			`
      SELECT
        CAST(SPLIT_PART(numero_factura, '-', 2) AS INTEGER) as "NumeroExtraido"
      FROM Facturas f
      INNER JOIN Clientes c ON f.clienteid = c.id
      WHERE c.organizacionid = $1
        AND numero_factura LIKE $2 || '-%'
      ORDER BY CAST(SPLIT_PART(numero_factura, '-', 2) AS INTEGER) DESC
				LIMIT 1
			`,
			[organizacionId, prefijo]
		);

  let numero = 1;
  if (result.rows.length > 0 && result.rows[0].NumeroExtraido) {
    numero = result.rows[0].NumeroExtraido + 1;
  }

  return `${prefijo}-${numero}`;
}

/**
 * Timbra una factura con Facturapi (llamada directa, sin pasar por SvelteKit)
 */
async function timbrarFacturaDirecto(pool: any, facturaId: number): Promise<{ success: boolean; uuid?: string; error?: string; pdfBase64?: string; xmlBase64?: string }> {
  try {
    // Obtener datos completos de la factura
    const result = await pool.query(
			`
        SELECT
          f.id, f.numero_factura, f.montototal, f.fechaemision, f.metodopago,
          f.formapago, f.usocfdi, f.moneda, f.tipocambio, f.notascliente,
          c.razonsocial AS ClienteRazonSocial, c.rfc AS ClienteRFC,
          c.correoprincipal AS ClienteEmail, c.codigopostal AS ClienteCP,
          c.calle AS ClienteCalle, c.numeroexterior AS ClienteNumExt,
          c.numerointerior AS ClienteNumInt, c.colonia AS ClienteColonia,
          c.ciudad AS ClienteCiudad,
          e.nombreestado AS ClienteEstado,
          p.nombrepais AS ClientePais,
          r.codigo AS ClienteRegimenCodigo,
          o.apikeyfacturaapi AS FacturapiKey,
          o.rfc AS OrganizacionRFC
        FROM Facturas f
        INNER JOIN Clientes c ON f.clienteid = c.id
        INNER JOIN Organizaciones o ON c.organizacionid = o.id
        LEFT JOIN Regimen r ON c.regimenfiscalid = r.id_regimen
        LEFT JOIN Estados e ON c.estadoid = e.ID
        LEFT JOIN Paises p ON c.paisid = p.ID
        WHERE f.id = $1
      `,
			[facturaId]
		);

    if (result.rows.length === 0) {
      return { success: false, error: 'Factura no encontrada' };
    }

    const f = result.rows[0];

    if (!f.facturapikey) {
      return { success: false, error: 'Organización sin API key de Facturapi' };
    }

    if (!f.clienteemail) {
      return { success: false, error: 'Cliente sin correo electrónico' };
    }

    // Obtener conceptos
    const conceptosResult = await pool.query(
			`
        SELECT Id, Nombre, Descripcion, ClaveProdServ, UnidadMedida,
               Cantidad, PrecioUnitario, Subtotal, Total, ObjetoImpuesto
        FROM ConceptosFactura WHERE FacturaId = $1
      `,
			[facturaId]
		);

    if (conceptosResult.rows.length === 0) {
      return { success: false, error: 'Factura sin conceptos' };
    }

    // RFC genérico
    const esRFCGenerico = f.clienterfc === 'XAXX010101000';
    const regimenFiscal = esRFCGenerico ? '616' : f.clienteregimencodigo;

    if (!regimenFiscal && !esRFCGenerico) {
      return { success: false, error: 'Cliente sin régimen fiscal' };
    }

    // Limpiar razón social
    let razonSocial = f.clienterazonsocial.toUpperCase();
    if (f.clienterfc && f.clienterfc.length !== 13) {
      razonSocial = razonSocial
        .replace(/\s+S\.?\s?A\.?\s+(DE\s+)?C\.?\s?V\.?$/i, '')
        .replace(/\s+S\.?\s?DE\s+R\.?\s?L\.?(\s+DE\s+C\.?\s?V\.?)?$/i, '')
        .replace(/\s+S\.?\s?C\.?$/i, '')
        .replace(/\s+A\.?\s?C\.?$/i, '');
    }

    // Serie y folio
    let serie = '', folio = '';
    if (f.numero_factura) {
      const partes = f.numero_factura.split('-');
      if (partes.length === 2) {
        serie = partes[0];
        folio = partes[1];
      }
    }

    // Construir items para Facturapi
    const items = [];
    for (const concepto of conceptosResult.rows) {
      const impResult = await pool.query(
			'SELECT Tipo, Tasa FROM ImpuestosConcepto WHERE ConceptoId = $1',
			[concepto.id]
		);

      const taxes = impResult.rows.map((imp: any) => {
        let tipoImpuesto = 'IVA';
        if (imp.tipo.includes('ISR')) tipoImpuesto = 'ISR';
        else if (imp.tipo.includes('IEPS')) tipoImpuesto = 'IEPS';
        return {
          type: tipoImpuesto,
          rate: parseFloat(imp.tasa),
          withholding: imp.tipo.includes('Retenido'),
          factor: 'Tasa'
        };
      });

      const cantidad = parseFloat(concepto.cantidad);
      const subtotal = parseFloat(concepto.subtotal);
      const precioUnitarioSinIVA = subtotal / cantidad;

      items.push({
        product: {
          description: concepto.descripcion || concepto.nombre,
          product_key: concepto.claveprodserv,
          unit_key: concepto.unidadmedida,
          price: precioUnitarioSinIVA,
          tax_included: false,
          taxes: taxes.length > 0 ? taxes : undefined,
          taxability: concepto.objetoimpuesto || '02'
        },
        quantity: cantidad
      });
    }

    // Payload Facturapi
    const payload: any = {
      currency: f.moneda || 'MXN',
      exchange: f.moneda && f.moneda !== 'MXN' ? parseFloat(f.tipocambio) : 1,
      customer: {
        legal_name: razonSocial.trim(),
        tax_id: f.clienterfc,
        tax_system: String(regimenFiscal),
        email: f.clienteemail,
        address: {
          street: f.clientecalle || '',
          exterior: f.clientenumext || '',
          interior: f.clientenumint || '',
          neighborhood: f.clientecolonia || '',
          city: f.clienteciudad || '',
          municipality: f.clienteciudad || '',
          state: f.clienteestado || '',
          country: (f.clientepais === 'México' || f.clientepais === 'Mexico') ? 'MEX' : (f.clientepais || 'MEX'),
          zip: f.clientecp || '00000'
        }
      },
      items,
      payment_form: f.formapago,
      payment_method: f.metodopago,
      use: f.usocfdi,
      series: serie,
      folio_number: folio ? parseInt(folio) : undefined,
      ...(f.notascliente && { pdf_custom_section: f.notascliente })
    };

    if (esRFCGenerico) {
      const fechaEm = new Date(f.fechaemision);
      payload.global = {
        periodicity: 'day',
        months: fechaEm.getMonth() + 1,
        year: fechaEm.getFullYear()
      };
    }

    // Llamar a Facturapi
    const response = await axios.post('https://www.facturapi.io/v2/invoices', payload, {
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      auth: { username: f.facturapikey, password: '' }
    });
    const invoice = response.data;

    // Descargar PDF y XML
    const authConfig = { auth: { username: f.facturapikey, password: '' }, responseType: 'arraybuffer' as const };
    const [pdfRes, xmlRes] = await Promise.all([
      axios.get(`https://www.facturapi.io/v2/invoices/${invoice.id}/pdf`, authConfig),
      axios.get(`https://www.facturapi.io/v2/invoices/${invoice.id}/xml`, authConfig)
    ]);
    const pdfBase64 = Buffer.from(pdfRes.data).toString('base64');
    const xmlBase64 = Buffer.from(xmlRes.data).toString('base64');

    // Actualizar factura con datos del timbrado
    await pool.query(
			`
        UPDATE Facturas
        SET UUID = $2, UUIDFacturapi = $2, Timbrado = true, FechaTimbrado = NOW(),
            FacturapiId = $3, PDFUrl = $4, XMLUrl = $5,
            PDFBase64 = $6, XMLBase64 = $7
        WHERE Id = $1
      `,
			[facturaId, invoice.uuid, invoice.id, `https://www.facturapi.io/v2/invoices/${invoice.id}/pdf`, `https://www.facturapi.io/v2/invoices/${invoice.id}/xml`, pdfBase64, xmlBase64]
		);

    // Si la factura es PUE, marcarla como pagada (saldo 0)
    if (f.metodopago === 'PUE') {
      await pool.query(
        `UPDATE Facturas SET SaldoPendiente = 0, estado_factura_id = 3 WHERE Id = $1`,
        [facturaId]
      );
    }

    console.log(`[REFACT] ✅ Factura #${f.numero_factura} timbrada: UUID=${invoice.uuid}`);
    return { success: true, uuid: invoice.uuid, pdfBase64, xmlBase64 };

  } catch (err: any) {
    const details = err.response?.data?.message || err.message;
    console.error(`[REFACT] ❌ Error timbrado factura ${facturaId}:`, details);
    return { success: false, error: details };
  }
}

// ═══════════════════════════════════════
// ENVÍO POR CANALES (EMAIL / WHATSAPP)
// ═══════════════════════════════════════

/**
 * Envía una factura timbrada por los canales configurados (correo y/o WhatsApp)
 */
async function enviarFacturaPorCanales(pool: any, facturaId: number): Promise<void> {
  try {
    const result = await pool.query(
			`
        SELECT f.id, f.numero_factura, f.montototal, f.fechaemision, f.uuid,
               f.pdfbase64, f.xmlbase64, f.enviarporcorreo, f.enviarporwhatsapp,
               c.razonsocial AS ClienteRazonSocial, c.correoprincipal AS ClienteEmail,
               c.telefonowhatsapp AS ClienteTelefono, c.codigopais AS ClienteCodigoPais,
               o.razonsocial AS OrgRazonSocial, o.id AS OrganizacionId
        FROM Facturas f
        INNER JOIN Clientes c ON f.clienteid = c.id
        INNER JOIN Organizaciones o ON c.organizacionid = o.id
        WHERE f.id = $1
      `,
			[facturaId]
		);

    if (result.rows.length === 0) return;
    const f = result.rows[0];

    const enviarCorreo = f.enviarporcorreo && f.clienteemail && f.pdfbase64;
    const enviarWhatsApp = f.enviarporwhatsapp && f.clientetelefono && f.pdfbase64;

    if (!enviarCorreo && !enviarWhatsApp) return;

    // ── Enviar por Correo ──
    if (enviarCorreo) {
      try {
        if (!RESEND_API_KEY || !EMAIL_FROM) {
          console.warn(`[ENVIO] ⚠ Correo no configurado (RESEND_API_KEY/EMAIL_FROM faltante)`);
        } else {
          const fechaEmision = new Date(f.fechaemision);
          const fechaStr = `${String(fechaEmision.getUTCDate()).padStart(2, '0')}/${String(fechaEmision.getUTCMonth() + 1).padStart(2, '0')}/${fechaEmision.getUTCFullYear()}`;

          const emailPayload = {
            from: EMAIL_FROM,
            to: f.clienteemail,
            subject: `Factura ${f.numero_factura} - ${f.orgrazonsocial}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background-color: #f8f9fa; border-radius: 10px; padding: 30px; margin-bottom: 20px;">
                  <h2 style="color: #2563eb; margin-top: 0;">Factura Electrónica</h2>
                  <p>Estimado(a) <strong>${f.clienterazonsocial}</strong>,</p>
                  <p style="color: #555;">Le enviamos su factura electrónica.</p>
                </div>
                <div style="background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 20px; margin-bottom: 20px;">
                  <h3 style="color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">Detalles</h3>
                  <table style="width: 100%;">
                    <tr><td style="padding: 8px 0; color: #6b7280;"><strong>Folio:</strong></td><td style="text-align: right;">${f.numero_factura}</td></tr>
                    <tr><td style="padding: 8px 0; color: #6b7280;"><strong>UUID:</strong></td><td style="text-align: right; font-size: 12px;">${f.uuid}</td></tr>
                    <tr><td style="padding: 8px 0; color: #6b7280;"><strong>Fecha:</strong></td><td style="text-align: right;">${fechaStr}</td></tr>
                    <tr style="border-top: 2px solid #e5e7eb;"><td style="padding: 12px 0; font-size: 16px;"><strong>Total:</strong></td><td style="text-align: right; font-size: 18px; color: #2563eb; font-weight: bold;">$${parseFloat(f.montototal).toFixed(2)} MXN</td></tr>
                  </table>
                </div>
                <p style="font-size: 12px; color: #9ca3af; text-align: center;">Este es un correo automático. Archivos PDF y XML adjuntos.</p>
              </div>
            `,
            attachments: [
              { filename: `Factura_${f.numero_factura}.pdf`, content: f.pdfbase64, contentType: 'application/pdf' },
              { filename: `Factura_${f.numero_factura}.xml`, content: f.xmlbase64, contentType: 'application/xml' }
            ]
          };

          const resp = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(emailPayload)
          });

          if (resp.ok) {
              console.log(`[ENVIO] 📧 Factura #${f.numero_factura} enviada por correo a ${f.clienteemail}`);
          } else {
            const err = await resp.json().catch(() => ({}));
            console.error(`[ENVIO] ❌ Error enviando correo: ${JSON.stringify(err)}`);
          }
        }
      } catch (err) {
        console.error(`[ENVIO] ❌ Error correo factura #${f.numero_factura}:`, err);
      }
    }

    // ── Enviar por WhatsApp ──
    if (enviarWhatsApp) {
      try {
        const sessionName = `org_${f.organizacionid}_session`;
        const jid = phoneToJid(f.clientetelefono);
        const texto = `📄 *Factura ${f.numero_factura}*\n\nEstimado(a) ${f.clienterazonsocial},\n\nLe compartimos su factura por *$${parseFloat(f.montototal).toFixed(2)} MXN*.\n\nUUID: ${f.uuid}\n\n_${f.orgrazonsocial}_`;

        const waResult = await sendWorkerDocument(
          sessionName, jid, texto, f.pdfbase64,
          `Factura_${f.numero_factura}.pdf`, 'application/pdf'
        );

        if (waResult.success) {
          console.log(`[ENVIO] 💬 Factura #${f.numero_factura} enviada por WhatsApp a ${f.clientetelefono}`);
        } else {
          console.error(`[ENVIO] ❌ Error WhatsApp: ${waResult.error}`);
        }
      } catch (err) {
        console.error(`[ENVIO] ❌ Error WhatsApp factura #${f.numero_factura}:`, err);
      }
    }
  } catch (err) {
    console.error(`[ENVIO] ❌ Error obteniendo datos para envío factura ${facturaId}:`, err);
  }
}

// ═══════════════════════════════════════
// CICLO PRINCIPAL DE REFACTURACIÓN
// ═══════════════════════════════════════
export async function ejecutarCicloRefacturacion(): Promise<void> {
  console.log('[REFACT] ═══ Iniciando ciclo de refacturación ═══');

  try {
    const pool = await getConnection();

    // Obtener facturas con recurrencia activa cuya fecha de inicio ya pasó
    // SEGURIDAD: Excluir organizaciones con plan gratuito (free/canceled/unpaid/sin suscripción)
    const result = await pool.query(`
      SELECT
        f.id, f.clienteid, f.montototal, f.metodopago, f.formapago, f.usocfdi,
        f.ordencompra, f.moneda, f.tipocambio, f.condicionespago,
        f.notascliente, f.notasinternas, f.desglosarimpuestos, f.identificador,
        f.usuariocreadorid, COALESCE(f.agenteiaactivo, false) AS agenteiaactivo,
        f.periodorecurrencia, f.diarecurrencia, f.cadarecurrencia,
        f.finrecurrencia, f.fechainiciorecurrencia, f.fechaprimerafactura,
        f.fechafinrecurrencia, f.numeroocurrencias,
        f.ordenrecurrencia, f.identificadorrecurrencia,
        f.ultimafacturagenerada, COALESCE(f.facturasgeneradas, 0) AS facturasgeneradas,
        f.numero_factura,
        COALESCE(f.enviarporcorreo, false) AS enviarporcorreo,
        COALESCE(f.enviarporwhatsapp, false) AS enviarporwhatsapp,
        c.organizacionid, o.rfc AS organizacionrfc, o.apikeyfacturaapi,
        COALESCE(s.planseleccionado, 'free') AS planorganizacion
      FROM Facturas f
      INNER JOIN Clientes c ON f.clienteid = c.id
      INNER JOIN Organizaciones o ON c.organizacionid = o.id
      LEFT JOIN Suscripciones s ON s.organizacionid = c.organizacionid
        AND s.estado NOT IN ('canceled', 'unpaid')
      WHERE f.recurrenciaactiva = true
        AND f.fechainiciorecurrencia <= ((NOW() AT TIME ZONE $1)::date)
        AND f.estado_factura_id != 6
      ORDER BY f.id
    `, [RECURRENCIA_TIMEZONE]);

    const facturasRecurrentes: FacturaRecurrente[] = result.rows;
    console.log(`[REFACT] Encontradas ${facturasRecurrentes.length} facturas con recurrencia activa (tz=${RECURRENCIA_TIMEZONE})`);

    let generadas = 0;
    let timbradas = 0;
    let errores = 0;

    for (const template of facturasRecurrentes) {
      try {
        const evaluacion = evaluarRecurrenciaHoy(template);
        if (!evaluacion.generar) {
          console.log(`[REFACT] ⏭ Template #${template.numero_factura} (ID: ${template.id}) omitida: ${evaluacion.motivo || 'hoy no corresponde'}`);
          continue;
        }

        console.log(`[REFACT] 📄 Generando factura recurrente desde template #${template.numero_factura} (ID: ${template.id})`);

        // SEGURIDAD: Verificar límite de facturas mensuales del plan
        // Nota: si BD quedó desincronizada (ej. webhook Stripe fallido) y marca free,
        // no bloqueamos recurrencia activa; usamos Basico como fallback operativo.
        const planRaw = String((template as any).planorganizacion || 'free').toLowerCase();
        const planAplicado = planRaw === 'free' ? 'basico' : planRaw;
        if (planRaw === 'free') {
          console.warn(`[REFACT] ⚠ Org ${template.organizacionid} con plan=free en BD pero recurrencia activa; aplicando fallback=basico`);
        }
        const planLimites: Record<string, number> = {
          'free': 3, 'basico': 50, 'pro': 200, 'enterprise': 999999
        };
        const maxFacturas = planLimites[planAplicado] || 50;
        const conteoMes = await pool.query(
			`
            SELECT COUNT(*) as total FROM Facturas f
            INNER JOIN Clientes c ON f.clienteid = c.id
            WHERE c.organizacionid = $1
              AND EXTRACT(MONTH FROM f.fechaemision) = EXTRACT(MONTH FROM NOW())
              AND EXTRACT(YEAR FROM f.fechaemision) = EXTRACT(YEAR FROM NOW())
          `,
			[template.organizacionid]
		);
        const facturasMes = parseInt(conteoMes.rows[0]?.total || '0', 10);
        if (facturasMes >= maxFacturas) {
          console.warn(`[REFACT] ⚠ Template #${template.numero_factura} omitida: org ${template.organizacionid} alcanzó límite mensual (${facturasMes}/${maxFacturas})`);
          continue;
        }

        // Generar número de factura
        const nuevoNumero = await generarNumeroFactura(pool, template.organizacionid, template.organizacionrfc);
        const fechaEmisionHoy = new Date().toISOString().split('T')[0];
        const fechaVencimiento = calcularFechaVencimiento(fechaEmisionHoy, template.condicionespago);

        // Crear transacción
        const client = await pool.connect();
        let nuevaFacturaId: number;

        try {
          await client.query('BEGIN');

          // 1. Insertar nueva factura (sin recurrencia, es una copia)
          const insertResult = await client.query(`
              INSERT INTO Facturas (
                ClienteId, MontoTotal, SaldoPendiente, FechaEmision, FechaVencimiento,
                estado_factura_id, prioridad_cobranza_id, numero_factura,
                MetodoPago, FormaPago, UsoCFDI, OrdenCompra, Moneda, TipoCambio, CondicionesPago,
                NotasCliente, NotasInternas, DesglosarImpuestos, Identificador,
                UsuarioCreadorId, AgenteIAActivo,
                RecurrenciaActiva, EnviarPorCorreo, EnviarPorWhatsApp,
                FacturaOrigenId
              ) VALUES (
                $1, $2, $3, $4, $5,
                1, 2, $6,
                $7, $8, $9, $10, $11, $12, $13,
                $14, $15, $16, $17,
                $18, $19,
                false, $20, $21,
                $22
              )
              RETURNING id
            `, [
              template.clienteid, template.montototal, template.montototal,
              fechaEmisionHoy, fechaVencimiento, nuevoNumero,
              template.metodopago || 'PUE', template.formapago || '99', template.usocfdi || 'G03',
              template.ordencompra, template.moneda || 'MXN', template.tipocambio || 1,
              template.condicionespago, template.notascliente, template.notasinternas,
              template.desglosarimpuestos, template.identificador,
              template.usuariocreadorid, template.agenteiaactivo,
              template.enviarporcorreo, template.enviarporwhatsapp,
              template.id
            ]);

          nuevaFacturaId = insertResult.rows[0].id;

          // 2. Copiar conceptos de la factura template
          const conceptos = await client.query(`
              SELECT Nombre, Descripcion, ClaveProdServ, UnidadMedida, Cantidad,
                     PrecioUnitario, Subtotal, MonedaProducto, ObjetoImpuesto,
                     TotalImpuestos, Total, Id AS conceptoid
              FROM ConceptosFactura WHERE FacturaId = $1
            `, [template.id]);

          for (const concepto of conceptos.rows) {
            const conceptoResult = await client.query(`
                INSERT INTO ConceptosFactura (
                  FacturaId, Nombre, Descripcion, ClaveProdServ, UnidadMedida, Cantidad,
                  PrecioUnitario, Subtotal, MonedaProducto, ObjetoImpuesto, TotalImpuestos, Total
                ) VALUES (
                  $1, $2, $3, $4, $5, $6,
                  $7, $8, $9, $10, $11, $12
                )
                RETURNING id
              `, [
                nuevaFacturaId, concepto.nombre, concepto.descripcion,
                concepto.claveprodserv, concepto.unidadmedida, concepto.cantidad,
                concepto.preciounitario, concepto.subtotal, concepto.monedaproducto,
                concepto.objetoimpuesto, concepto.totalimpuestos, concepto.total
              ]);

            const nuevoConceptoId = conceptoResult.rows[0].id;

            // 3. Copiar impuestos del concepto
            const impuestos = await client.query(
              'SELECT Tipo, Tasa, Monto FROM ImpuestosConcepto WHERE ConceptoId = $1',
              [concepto.conceptoid]
            );

            for (const imp of impuestos.rows) {
              await client.query(
                'INSERT INTO ImpuestosConcepto (ConceptoId, Tipo, Tasa, Monto) VALUES ($1, $2, $3, $4)',
                [nuevoConceptoId, imp.tipo, imp.tasa, imp.monto]
              );
            }
          }

          // 4. Actualizar template: tracking
          await client.query(`
              UPDATE Facturas
              SET UltimaFacturaGenerada = NOW(),
                  FacturasGeneradas = COALESCE(FacturasGeneradas, 0) + 1
              WHERE Id = $1
            `, [template.id]);

          await client.query('COMMIT');
        } catch (innerErr) {
          await client.query('ROLLBACK');
          throw innerErr;
        } finally {
          client.release();
        }

        generadas++;
        console.log(`[REFACT] ✅ Factura ${nuevoNumero} creada (ID: ${nuevaFacturaId!}) desde template #${template.numero_factura}`);

        // 5. Timbrar la nueva factura (fuera de la transacción)
        if (template.apikeyfacturaapi) {
          const timbradoResult = await timbrarFacturaDirecto(pool, nuevaFacturaId!);
          if (timbradoResult.success) {
            timbradas++;
            // Enviar por canales configurados
            await enviarFacturaPorCanales(pool, nuevaFacturaId!);
          } else {
            console.warn(`[REFACT] ⚠ Factura ${nuevoNumero} creada pero no se pudo timbrar: ${timbradoResult.error}`);
          }
        } else {
          console.warn(`[REFACT] ⚠ Factura ${nuevoNumero} creada sin timbrar (org sin API key Facturapi)`);
        }

        // 6. Verificar si se debe desactivar la recurrencia
        const nuevasGeneradas = template.facturasgeneradas + 1;
        let desactivar = false;

        if (template.finrecurrencia === 'despues-de' && template.numeroocurrencias && nuevasGeneradas >= template.numeroocurrencias) {
          desactivar = true;
          console.log(`[REFACT] 🏁 Recurrencia completada para template #${template.numero_factura} (${nuevasGeneradas}/${template.numeroocurrencias} ocurrencias)`);
        }

        if (template.finrecurrencia === 'el-dia' && template.fechafinrecurrencia) {
          const hoy = new Date();
          const fechaFin = fechaLocal(template.fechafinrecurrencia);
          // Si la siguiente ejecución caería después de la fecha fin, desactivar
          if (hoy >= fechaFin) {
            desactivar = true;
            console.log(`[REFACT] 🏁 Recurrencia finalizada por fecha para template #${template.numero_factura}`);
          }
        }

        if (desactivar) {
          await pool.query(
            'UPDATE Facturas SET RecurrenciaActiva = false WHERE Id = $1',
            [template.id]
          );
        }

      } catch (err) {
        errores++;
        console.error(`[REFACT] ❌ Error procesando template ${template.id} (#${template.numero_factura}):`, err);
      }
    }

    console.log(`[REFACT] ═══ Ciclo completado: ${generadas} generadas, ${timbradas} timbradas, ${errores} errores ═══`);

  } catch (err) {
    console.error('[REFACT] ❌ Error fatal en ciclo de refacturación:', err);
  }
}

// ═══════════════════════════════════════
// EMISIÓN PROGRAMADA
// ═══════════════════════════════════════
/**
 * Busca facturas con FechaEmision <= hoy que no han sido timbradas
 * y las timbra automáticamente.
 * 
 * Cubre dos casos:
 * 1. Facturas simples con fecha de emisión futura (no recurrentes)
 * 2. La primera factura de una serie recurrente cuya FechaPrimeraFactura llegó
 */
export async function ejecutarEmisionProgramada(): Promise<void> {
  console.log('[EMISION] ═══ Buscando facturas programadas pendientes de timbrado ═══');

  try {
    const pool = await getConnection();

    const result = await pool.query(`
      SELECT
        f.id, f.numero_factura, f.fechaemision,
        o.apikeyfacturaapi
      FROM Facturas f
      INNER JOIN Clientes c ON f.clienteid = c.id
      INNER JOIN Organizaciones o ON c.organizacionid = o.id
      WHERE f.timbrado = false
        AND CAST(f.fechaemision AS DATE) <= CAST(NOW() AS DATE)
        AND f.estado_factura_id != 6
        AND f.facturapiid IS NULL
        AND f.uuid IS NULL
      ORDER BY f.fechaemision ASC
    `);

    const pendientes = result.rows;
    console.log(`[EMISION] Encontradas ${pendientes.length} facturas pendientes de timbrado`);

    let timbradas = 0;
    let errores = 0;

    for (const factura of pendientes) {
      try {
        if (!factura.apikeyfacturaapi) {
          console.warn(`[EMISION] ⚠ Factura #${factura.numero_factura} (ID: ${factura.id}) — org sin API key, omitida`);
          continue;
        }

        console.log(`[EMISION] 📄 Timbrando factura programada #${factura.numero_factura} (ID: ${factura.id}, emisión: ${new Date(factura.fechaemision).toISOString().split('T')[0]})`);

        const resultado = await timbrarFacturaDirecto(pool, factura.id);
        if (resultado.success) {
          timbradas++;
          console.log(`[EMISION] ✅ Factura #${factura.numero_factura} timbrada: UUID=${resultado.uuid}`);
          // Enviar por canales configurados
          await enviarFacturaPorCanales(pool, factura.id);
        } else {
          errores++;
          console.error(`[EMISION] ❌ Factura #${factura.numero_factura}: ${resultado.error}`);
        }
      } catch (err) {
        errores++;
        console.error(`[EMISION] ❌ Error procesando factura ${factura.id}:`, err);
      }
    }

    console.log(`[EMISION] ═══ Completado: ${timbradas} timbradas, ${errores} errores ═══`);

  } catch (err) {
    console.error('[EMISION] ❌ Error fatal en emisión programada:', err);
  }
}
