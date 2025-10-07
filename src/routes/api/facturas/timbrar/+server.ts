import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import axios from 'axios';

// Configuración de Facturapi
const FACTURAPI_KEY = 'REDACTED_FACTURAPI_TEST_KEY';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { facturaId } = await request.json();

    if (!facturaId) {
      return json({ success: false, error: 'facturaId es requerido' }, { status: 400 });
    }

    // Obtener información completa de la factura
    const facturaQuery = `
      SELECT
        f.Id,
        f.numero_factura,
        f.MontoTotal,
        f.FechaEmision,
        f.FechaVencimiento,
        f.MetodoPago,
        f.FormaPago,
        f.UsoCFDI,
        f.CondicionesPago,
        c.RazonSocial as ClienteRazonSocial,
        c.RFC as ClienteRFC,
        c.CorreoPrincipal as ClienteEmail,
        c.CodigoPostal as ClienteCP,
        c.RegimenFiscalId as ClienteRegimenFiscalId,
        r.Codigo as ClienteRegimenFiscalCodigo,
        o.RazonSocial as OrganizacionRazonSocial,
        o.RFC as OrganizacionRFC,
        rOrg.Codigo as OrganizacionRegimenFiscalCodigo
      FROM Facturas f
      INNER JOIN Clientes c ON f.ClienteId = c.Id
      INNER JOIN Organizaciones o ON c.OrganizacionId = o.Id
      LEFT JOIN Regimen r ON c.RegimenFiscalId = r.ID_Regimen
      LEFT JOIN configuracion_organizacion co ON o.Id = co.organizacion_id
      LEFT JOIN Regimen rOrg ON co.regimen_fiscal = rOrg.ID_Regimen
      WHERE f.Id = ?
    `;

    const facturaResult = await db.query(facturaQuery, [facturaId]);

    if (!facturaResult || facturaResult.length === 0) {
      return json({ success: false, error: 'Factura no encontrada' }, { status: 404 });
    }

    const factura = facturaResult[0];

    // Validaciones de datos requeridos
    if (!factura.ClienteEmail) {
      return json({
        success: false,
        error: 'El cliente no tiene correo electrónico configurado en CorreoPrincipal'
      }, { status: 400 });
    }

    if (!factura.MetodoPago) {
      return json({
        success: false,
        error: 'La factura no tiene método de pago (MetodoPago) configurado'
      }, { status: 400 });
    }

    if (!factura.FormaPago) {
      return json({
        success: false,
        error: 'La factura no tiene forma de pago (FormaPago) configurada'
      }, { status: 400 });
    }

    if (!factura.UsoCFDI) {
      return json({
        success: false,
        error: 'La factura no tiene uso de CFDI (UsoCFDI) configurado'
      }, { status: 400 });
    }

    // Obtener conceptos de la factura
    const conceptosQuery = `
      SELECT
        cf.Nombre,
        cf.Descripcion,
        cf.ClaveProdServ,
        cf.UnidadMedida,
        cf.Cantidad,
        cf.PrecioUnitario,
        cf.Subtotal,
        cf.Total,
        cf.ObjetoImpuesto,
        cf.Id as ConceptoId
      FROM ConceptosFactura cf
      WHERE cf.FacturaId = ?
    `;

    const conceptosResult = await db.query(conceptosQuery, [facturaId]);

    if (!conceptosResult || conceptosResult.length === 0) {
      return json({
        success: false,
        error: 'La factura no tiene conceptos asociados'
      }, { status: 400 });
    }

    // RFC genérico (público en general) SIEMPRE debe usar régimen 616
    const esRFCGenerico = factura.ClienteRFC === 'XAXX010101000';

    let regimenFiscal: string;

    if (esRFCGenerico) {
      // RFC genérico SIEMPRE usa régimen 616, sin importar lo que tenga el cliente
      regimenFiscal = '616';
    } else {
      // Usar el código del régimen fiscal directamente de la base de datos
      regimenFiscal = factura.ClienteRegimenFiscalCodigo;

      // Validar que el régimen fiscal exista
      if (!regimenFiscal) {
        return json({
          success: false,
          error: 'El cliente no tiene régimen fiscal configurado'
        }, { status: 400 });
      }
    }

    // Limpiar razón social para el SAT (CFDI 4.0)
    // - Convertir a mayúsculas
    // - Eliminar acentos
    // - Eliminar regímenes societarios SOLO para personas morales
    const limpiarRazonSocial = (razonSocial: string, rfc: string): string => {
      // Detectar si es persona física (RFC de 13 caracteres)
      const esPersonaFisica = rfc && rfc.length === 13;

      let resultado = razonSocial
        .toUpperCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // Eliminar acentos

      // Solo eliminar regímenes societarios si es persona moral
      if (!esPersonaFisica) {
        resultado = resultado
          .replace(/\s+S\.?\s?A\.?\s+(DE\s+)?C\.?\s?V\.?$/i, '') // S.A. DE C.V., SA DE CV, S.A. de C.V.
          .replace(/\s+S\.?\s?DE\s+R\.?\s?L\.?(\s+DE\s+C\.?\s?V\.?)?$/i, '') // S. DE R.L., S DE RL DE CV
          .replace(/\s+S\.?\s?C\.?$/i, '') // S.C.
          .replace(/\s+A\.?\s?C\.?$/i, ''); // A.C.
      }

      return resultado.trim();
    };

    // Construir payload para Facturapi según documentación
    const facturapiPayload: any = {
      customer: {
        legal_name: limpiarRazonSocial(factura.ClienteRazonSocial, factura.ClienteRFC),
        tax_id: factura.ClienteRFC,
        tax_system: String(regimenFiscal), // Convertir a string
        email: factura.ClienteEmail,
        address: {
          zip: factura.ClienteCP || '00000' // Código postal requerido, usar '00000' si no está disponible
        }
      },
      items: await Promise.all(conceptosResult.map(async (concepto: any) => {
        // Obtener impuestos del concepto desde la base de datos
        const impuestosQuery = `
          SELECT Tipo, Tasa
          FROM ImpuestosConcepto
          WHERE ConceptoId = ?
        `;
        const impuestosResult = await db.query(impuestosQuery, [concepto.ConceptoId]);

        // Convertir impuestos al formato de Facturapi
        const taxes = impuestosResult.map((imp: any) => {
          // Facturapi usa los nombres, no códigos: IVA, ISR, IEPS
          let tipoImpuesto: string;
          if (imp.Tipo.includes('IVA')) {
            tipoImpuesto = 'IVA';
          } else if (imp.Tipo.includes('ISR')) {
            tipoImpuesto = 'ISR';
          } else if (imp.Tipo.includes('IEPS')) {
            tipoImpuesto = 'IEPS';
          } else {
            tipoImpuesto = 'IVA'; // Default IVA
          }

          const isWithholding = imp.Tipo.includes('Retenido');

          return {
            type: tipoImpuesto,
            rate: parseFloat(imp.Tasa),
            withholding: isWithholding,
            factor: 'Tasa'
          };
        });

        return {
          product: {
            description: concepto.Descripcion || concepto.Nombre,
            product_key: concepto.ClaveProdServ,
            price: parseFloat(concepto.PrecioUnitario),
            taxes: taxes.length > 0 ? taxes : undefined,
            taxability: concepto.ObjetoImpuesto || '02'
          },
          quantity: parseFloat(concepto.Cantidad)
        };
      })),
      payment_form: factura.FormaPago,
      payment_method: factura.MetodoPago,
      use: factura.UsoCFDI,
      folio_number: factura.numero_factura
    };

    // Si es RFC genérico, agregar nodo global (Factura Global)
    if (esRFCGenerico) {
      facturapiPayload.global = {
        periodicity: 'day', // day, week, fortnight, month, two_months
        months: new Date(factura.FechaEmision).getMonth() + 1, // Mes actual (1-12)
        year: new Date(factura.FechaEmision).getFullYear()
      };
    }

    // Crear factura en Facturapi
    const { data: invoice } = await axios.post(
      'https://www.facturapi.io/v2/invoices',
      facturapiPayload,
      {
        auth: {
          username: FACTURAPI_KEY,
          password: ''
        }
      }
    );

    // Obtener URLs del PDF y XML desde Facturapi
    const pdfUrl = `https://www.facturapi.io/v2/invoices/${invoice.id}/pdf`;
    const xmlUrl = `https://www.facturapi.io/v2/invoices/${invoice.id}/xml`;

    // Guardar toda la información del timbrado en la base de datos
    await db.query(
      `UPDATE Facturas
       SET UUID = ?,
           UUIDFacturapi = ?,
           Timbrado = 1,
           FechaTimbrado = GETDATE(),
           FacturapiId = ?,
           PDFUrl = ?,
           XMLUrl = ?
       WHERE Id = ?`,
      [invoice.uuid, invoice.uuid, invoice.id, pdfUrl, xmlUrl, facturaId]
    );

    return json({
      success: true,
      message: 'Factura timbrada exitosamente',
      uuid: invoice.uuid,
      facturapiId: invoice.id,
      numeroFactura: factura.numero_factura,
      pdfUrl: pdfUrl,
      xmlUrl: xmlUrl
    });

  } catch (error: any) {
    console.error('Error al timbrar factura:', error);
    return json({
      success: false,
      error: 'Error al timbrar y enviar la factura',
      details: error.response?.data || error.message || 'Error desconocido'
    }, { status: 500 });
  }
};
