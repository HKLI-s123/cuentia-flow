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
        o.RFC as OrganizacionRFC
      FROM Facturas f
      INNER JOIN Clientes c ON f.ClienteId = c.Id
      INNER JOIN Organizaciones o ON c.OrganizacionId = o.Id
      LEFT JOIN Regimen r ON c.RegimenFiscalId = r.ID_Regimen
      WHERE f.Id = ?
    `;

    const facturaResult = await db.query(facturaQuery, [facturaId]);

    if (!facturaResult || facturaResult.length === 0) {
      return json({ success: false, error: 'Factura no encontrada' }, { status: 404 });
    }

    const factura = facturaResult[0];

    if (!factura.ClienteEmail) {
      return json({
        success: false,
        error: 'El cliente no tiene correo electrónico configurado en CorreoPrincipal'
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
      // Detectar si es persona física o moral basándose en el RFC
      // RFC Persona Física: 13 caracteres (AAAA######XXX)
      // RFC Persona Moral: 12 caracteres (AAA######XXX)
      const esPersonaFisica = factura.ClienteRFC && factura.ClienteRFC.length === 13;

      // Regímenes fiscales válidos según tipo de persona
      const regimenesPersonasFisicas = ['605', '606', '608', '610', '611', '612', '614', '615', '616', '621', '625', '626'];
      const regimenesPersonasMorales = ['601', '603', '607', '609', '620', '622', '623', '624'];

      // Usar el código del régimen fiscal de la tabla Regimen
      regimenFiscal = factura.ClienteRegimenFiscalCodigo;

      if (regimenFiscal) {
        // Validar que el régimen fiscal coincida con el tipo de persona
        if (esPersonaFisica && !regimenesPersonasFisicas.includes(regimenFiscal)) {
          // Régimen inválido para persona física, usar default
          regimenFiscal = '612'; // 612 = Personas Físicas con Actividades Empresariales y Profesionales
        } else if (!esPersonaFisica && !regimenesPersonasMorales.includes(regimenFiscal)) {
          // Régimen inválido para persona moral, usar default
          regimenFiscal = '601'; // 601 = General de Ley Personas Morales
        }
      } else {
        // Si no hay régimen fiscal, usar default según tipo de persona
        regimenFiscal = esPersonaFisica ? '612' : '601';
      }
    }

    // Construir payload para Facturapi según documentación
    const facturapiPayload: any = {
      customer: {
        legal_name: factura.ClienteRazonSocial,
        tax_id: factura.ClienteRFC,
        tax_system: regimenFiscal,
        email: factura.ClienteEmail,
        address: {
          zip: factura.ClienteCP || '00000' // Código postal requerido, usar '00000' si no está disponible
        }
      },
      items: conceptosResult.map((concepto: any) => ({
        product: {
          description: concepto.Descripcion || concepto.Nombre,
          product_key: concepto.ClaveProdServ || '01010101',
          price: parseFloat(concepto.PrecioUnitario)
        },
        quantity: parseFloat(concepto.Cantidad)
      })),
      payment_form: factura.FormaPago || '99',
      use: factura.UsoCFDI || 'G03',
      folio_number: factura.numero_factura // Usar el número de factura como folio
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

    // Guardar UUID del timbrado en la base de datos
    await db.query(
      `UPDATE Facturas
       SET UUID = ?,
           Timbrado = 1,
           FechaTimbrado = GETDATE(),
           FacturapiId = ?
       WHERE Id = ?`,
      [invoice.uuid, invoice.id, facturaId]
    );

    return json({
      success: true,
      message: 'Factura timbrada exitosamente',
      uuid: invoice.uuid,
      facturapiId: invoice.id,
      numeroFactura: factura.numero_factura
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
