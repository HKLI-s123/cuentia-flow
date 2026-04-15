import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getConnection } from '$lib/server/db';
import { getUserFromRequest, unauthorizedResponse } from '$lib/server/auth';

export const GET: RequestHandler = async (event) => {
  // Verificar autenticación
  const user = getUserFromRequest(event);
  if (!user) {
    return unauthorizedResponse('Token de autenticación requerido');
  }

  const { params, url } = event;
  try {
    const { id } = params;
    const organizacionId = url.searchParams.get('organizacionId');

    if (!organizacionId) {
      return json({
        success: false,
        error: 'organizacionId es requerido'
      }, { status: 400 });
    }

    const pool = await getConnection();

    // Query para obtener la factura individual con saldo y días vencido calculados dinámicamente
    const facturaQuery = `
      SELECT
        f.id,
        f.clienteid,
        f.numero_factura,
        f.montototal,
        COALESCE(f.montototal - COALESCE(pagos.TotalPagado, 0), f.montototal) as SaldoPendiente,
        f.fechaemision,
        f.fechavencimiento,
        CASE WHEN f.estado_factura_id = 6 THEN NULL ELSE (f.fechavencimiento::date - CURRENT_DATE) END as DiasVencido,
        f.estado_factura_id,
        f.prioridad_cobranza_id,
        f.metodopago,
        f.formapago,
        f.condicionespago,
        f.uuid,
        f.timbrado,
        f.fechatimbrado,
        f.facturapiid,
        f.pdfurl,
        f.xmlurl,
        f.usuariocreadorid,
        f.ultimagestion,
        f.createdat,
        COALESCE(f.agenteiaactivo, false) as AgenteIAActivo,
        f.notascliente,
        f.notasinternas,
        f.ordencompra,
        f.identificador,
        c.razonsocial as ClienteRazonSocial,
        c.rfc as ClienteRFC,
        c.nombrecomercial as ClienteNombreComercial,
        c.correoprincipal as ClienteCorreo,
        c.telefono as ClienteTelefono,
        c.telefonowhatsapp as ClienteTelefonoWhatsApp,
        c.codigopais as ClienteCodigoPais,
        c.codigopostal as ClienteCodigoPostal,
        r.codigo as ClienteRegimenFiscalCodigo,
        r.descripcion as ClienteRegimenFiscalDescripcion,
        ef.codigo as EstadoCodigo,
        pc.codigo as PrioridadCodigo,
        u.correo as UsuarioCreadorCorreo,
        u.nombre as UsuarioCreadorNombre,
        u.apellido as UsuarioCreadorApellido,
        COALESCE(f.recurrenciaactiva, false) as RecurrenciaActiva,
        f.periodorecurrencia,
        f.diarecurrencia,
        f.finrecurrencia,
        f.numeroocurrencias,
        f.fechafinrecurrencia,
        COALESCE(f.facturasgeneradas, 0) as FacturasGeneradas,
        f.ultimafacturagenerada,
        f.ordenrecurrencia,
        f.identificadorrecurrencia,
        f.facturaorigenid,
        templateOrigen.numero_factura as TemplateOrigenNumero
      FROM Facturas f
      INNER JOIN Clientes c ON f.clienteid = c.id
      LEFT JOIN Regimen r ON c.regimenfiscalid = r.id_regimen
      LEFT JOIN estados_factura ef ON f.estado_factura_id = ef.id
      LEFT JOIN prioridades_cobranza pc ON f.prioridad_cobranza_id = pc.id
      LEFT JOIN Usuarios u ON f.usuariocreadorid = u.id
      LEFT JOIN Facturas templateOrigen ON f.facturaorigenid = templateOrigen.id
      LEFT JOIN (
        SELECT FacturaId, SUM(Monto) as TotalPagado
        FROM Pagos
        GROUP BY FacturaId
      ) pagos ON f.id = pagos.facturaid
      WHERE f.id = $1 AND c.organizacionid = $2
    `;

    const result = await pool.query(facturaQuery, [parseInt(id), parseInt(organizacionId)]);

    if (!result || !result.rows || result.rows.length === 0) {
      return json({
        success: false,
        error: 'Factura no encontrada'
      }, { status: 404 });
    }

    const row = result.rows[0];

    // Obtener conceptos de la factura
    const conceptosQuery = `
      SELECT
        Id,
        Nombre,
        Descripcion,
        ClaveProdServ,
        UnidadMedida,
        Cantidad,
        PrecioUnitario,
        Subtotal,
        MonedaProducto,
        ObjetoImpuesto,
        TotalImpuestos,
        Total
      FROM ConceptosFactura
      WHERE FacturaId = $1
      ORDER BY Id
    `;

    const conceptosResult = await pool.query(conceptosQuery, [parseInt(id)]);

    // Para cada concepto, obtener sus impuestos
    const conceptos = await Promise.all(
      conceptosResult.rows.map(async (concepto: any) => {
        const impuestosQuery = `
          SELECT Tipo, Tasa, Monto
          FROM ImpuestosConcepto
          WHERE ConceptoId = $1
        `;
        const impuestosResult = await pool.query(impuestosQuery, [concepto.id]);
        const impuestos = impuestosResult.rows;

        return {
          id: concepto.id,
          nombre: concepto.nombre,
          descripcion: concepto.descripcion,
          claveProdServ: concepto.claveprodserv,
          unidadMedida: concepto.unidadmedida,
          cantidad: parseFloat(concepto.cantidad) || 0,
          precioUnitario: parseFloat(concepto.preciounitario) || 0,
          subtotal: parseFloat(concepto.subtotal) || 0,
          monedaProducto: concepto.monedaproducto,
          objetoImpuesto: concepto.objetoimpuesto,
          totalImpuestos: parseFloat(concepto.totalimpuestos) || 0,
          total: parseFloat(concepto.total) || 0,
          impuestos: impuestos.map((imp: any) => ({
            tipo: imp.tipo,
            tasa: parseFloat(imp.tasa) || 0,
            monto: parseFloat(imp.monto) || 0
          }))
        };
      })
    );

    // Obtener pagos de la factura
    const pagosQuery = `
      SELECT
        p.id,
        p.monto,
        p.fechapago,
        p.metodo,
        p.facturapipagoid,
        p.uuidpago
      FROM Pagos p
      WHERE p.facturaid = $1
      ORDER BY p.fechapago ASC
    `;

    const pagosResult = await pool.query(pagosQuery, [parseInt(id)]);
    const pagos = pagosResult.rows.map((p: any) => ({
      id: p.id,
      monto: parseFloat(p.monto) || 0,
      fechaPago: p.fechapago,
      metodo: p.metodo,
      facturapiPagoId: p.facturapipagoid || null,
      uuidPago: p.uuidpago || null
    }));

    // Obtener facturas hijas (recurrentes)
    const hijasResult = await pool.query(
      `
        SELECT f.id, f.numero_factura, f.montototal, f.fechaemision, f.fechatimbrado,
               f.uuid, f.timbrado, f.estado_factura_id,
               ef.codigo as EstadoCodigo
        FROM Facturas f
        LEFT JOIN estados_factura ef ON f.estado_factura_id = ef.id
        WHERE f.facturaorigenid = $1
        ORDER BY f.fechaemision DESC
      `,
      [parseInt(id)]
    );

    const facturasHijas = hijasResult.rows.map((h: any) => ({
      id: h.id,
      numeroFactura: h.numero_factura,
      montoTotal: parseFloat(h.montototal) || 0,
      fechaEmision: h.fechaemision,
      fechaTimbrado: h.fechatimbrado,
      uuid: h.uuid,
      timbrado: h.timbrado ? true : false,
      estadoCodigo: h.estadocodigo
    }));

    const factura = {
      id: row.id,
      clienteId: row.clienteid,
      numero_factura: row.numero_factura,
      montoTotal: parseFloat(row.montototal) || 0,
      saldoPendiente: parseFloat(row.saldopendiente) || 0,
      fechaEmision: row.fechaemision,
      fechaVencimiento: row.fechavencimiento,
      diasVencido: row.diasvencido !== null && row.diasvencido !== undefined ? row.diasvencido : (row.estado_factura_id === 6 ? null : 0),
      estado_factura_id: row.estado_factura_id,
      prioridad_cobranza_id: row.prioridad_cobranza_id,
      metodoPago: row.metodopago,
      formaPago: row.formapago,
      condicionesPago: row.condicionespago,
      uuid: row.uuid,
      timbrado: row.timbrado,
      fechaTimbrado: row.fechatimbrado,
      facturapiId: row.facturapiid,
      pdfUrl: row.pdfurl,
      xmlUrl: row.xmlurl,
      usuarioCreadorId: row.usuariocreadorid,
      usuarioCreadorCorreo: row.usuariocreadorcorreo,
      usuarioCreadorNombre: row.usuariocreadornombre,
      usuarioCreadorApellido: row.usuariocreadorapellido,
      ultimaGestion: row.ultimagestion,
      createdAt: row.createdat,
      agenteIAActivo: row.agenteiaactivo ? true : false,
      notasCliente: row.notascliente || null,
      notasInternas: row.notasinternas || null,
      ordenCompra: row.ordencompra || null,
      identificador: row.identificador || null,
      recurrencia: {
        activa: row.recurrenciaactiva ? true : false,
        periodo: row.periodorecurrencia || null,
        dia: row.diarecurrencia || null,
        finRecurrencia: row.finrecurrencia || null,
        numeroOcurrencias: row.numeroocurrencias || null,
        fechaFinRecurrencia: row.fechafinrecurrencia || null,
        facturasGeneradas: row.facturasgeneradas || 0,
        ultimaFacturaGenerada: row.ultimafacturagenerada || null,
        orden: row.ordenrecurrencia || null,
        identificador: row.identificadorrecurrencia || null
      },
      facturaOrigenId: row.facturaorigenid || null,
      templateOrigenNumero: row.templateorigennumero || null,
      cliente: {
        id: row.clienteid,
        razonSocial: row.clienterazonsocial,
        rfc: row.clienterfc,
        nombreComercial: row.clientenombrecomercial,
        correo: row.clientecorreo,
        telefono: row.clientetelefono,
        telefonoWhatsApp: row.clientetelefonowhatsapp,
        codigoPais: row.clientecodigopais,
        codigoPostal: row.clientecodigopostal,
        regimenFiscal: row.clienteregimenfiscalcodigo ? `${row.clienteregimenfiscalcodigo} - ${row.clienteregimenfiscaldescripcion}` : null
      },
      estado: {
        id: row.estado_factura_id,
        codigo: row.estadocodigo
      },
      prioridad: {
        id: row.prioridad_cobranza_id,
        codigo: row.prioridadcodigo
      },
      conceptos,
      pagos,
      facturasHijas
    };

    return json({
      success: true,
      factura
    });

  } catch (error) {
    return json({
      success: false,
      error: 'Error al obtener factura: ' + (error as Error).message
    }, { status: 500 });
  }
};

export const PATCH: RequestHandler = async (event) => {
  const user = getUserFromRequest(event);
  if (!user) {
    return unauthorizedResponse('Token de autenticación requerido');
  }

  const { params } = event;
  try {
    const { id } = params;
    const body = await event.request.json();
    const { organizacionId, agenteIAActivo, recurrenciaActiva } = body;

    if (!organizacionId) {
      return json({ success: false, error: 'organizacionId es requerido' }, { status: 400 });
    }

    if (typeof agenteIAActivo !== 'boolean' && typeof recurrenciaActiva !== 'boolean') {
      return json({ success: false, error: 'Debe enviar agenteIAActivo o recurrenciaActiva' }, { status: 400 });
    }

    const pool = await getConnection();

    const check = await pool.query(
      `
        SELECT f.id, f.estado_factura_id, f.recurrenciaactiva FROM Facturas f
        INNER JOIN Clientes c ON f.clienteid = c.id
        WHERE f.id = $1 AND c.organizacionid = $2
      `,
      [parseInt(id), parseInt(organizacionId)]
    );

    if (!check.rows || check.rows.length === 0) {
      return json({ success: false, error: 'Factura no encontrada' }, { status: 404 });
    }

    const factura = check.rows[0];

    if (factura.estado_factura_id === 6) {
      return json({ success: false, error: 'Esta factura está cancelada. No se puede modificar.' }, { status: 403 });
    }

    if (typeof agenteIAActivo === 'boolean') {
      await pool.query(
        'UPDATE Facturas SET AgenteIAActivo = $1 WHERE Id = $2',
        [agenteIAActivo ? 1 : 0, parseInt(id)]
      );
      return json({
        success: true,
        message: `Agente IA ${agenteIAActivo ? 'activado' : 'desactivado'} para esta factura`
      });
    }

    if (typeof recurrenciaActiva === 'boolean' && recurrenciaActiva === false) {
      if (!factura.recurrenciaactiva) {
        return json({ success: false, error: 'La recurrencia ya está desactivada' }, { status: 400 });
      }

      await pool.query(
        'UPDATE Facturas SET RecurrenciaActiva = false WHERE Id = $1',
        [parseInt(id)]
      );
      return json({
        success: true,
        message: 'Recurrencia desactivada exitosamente'
      });
    }

    return json({ success: false, error: 'Operación no válida' }, { status: 400 });

  } catch (error) {
    return json({
      success: false,
      error: 'Error al actualizar factura: ' + (error as Error).message
    }, { status: 500 });
  }
};

export const DELETE: RequestHandler = async (event) => {
  const user = getUserFromRequest(event);
  if (!user) {
    return unauthorizedResponse('Token de autenticación requerido');
  }

  const { params, url } = event;
  try {
    const { id } = params;
    const organizacionId = url.searchParams.get('organizacionId');

    if (!organizacionId) {
      return json({ success: false, error: 'organizacionId es requerido' }, { status: 400 });
    }

    const pool = await getConnection();

    const check = await pool.query(
      `
        SELECT f.id, f.timbrado, f.numero_factura FROM Facturas f
        INNER JOIN Clientes c ON f.clienteid = c.id
        WHERE f.id = $1 AND c.organizacionid = $2
      `,
      [parseInt(id), parseInt(organizacionId)]
    );

    if (!check.rows || check.rows.length === 0) {
      return json({ success: false, error: 'Factura no encontrada' }, { status: 404 });
    }

    const factura = check.rows[0];

    if (factura.timbrado) {
      return json({ success: false, error: 'No se puede borrar una factura timbrada. Use la opción de cancelar.' }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const facturaIdParam = [parseInt(id)];
      await client.query(`
        DELETE FROM ImpuestosConcepto WHERE ConceptoId IN (
          SELECT Id FROM ConceptosFactura WHERE FacturaId = $1
        )
      `, facturaIdParam);
      await client.query('DELETE FROM ConceptosFactura WHERE FacturaId = $1', facturaIdParam);
      await client.query('DELETE FROM Pagos WHERE FacturaId = $1', facturaIdParam);
      await client.query('DELETE FROM Facturas WHERE Id = $1', facturaIdParam);

      await client.query('COMMIT');

      return json({
        success: true,
        message: `Factura ${factura.numero_factura || id} borrada exitosamente`
      });
    } catch (deleteError) {
      await client.query('ROLLBACK');
      throw deleteError;
    } finally {
      client.release();
    }

  } catch (error) {
    return json({
      success: false,
      error: 'Error al borrar factura: ' + (error as Error).message
    }, { status: 500 });
  }
};
