import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, getConnection } from '$lib/server/db';
import { getUserFromRequest, unauthorizedResponse, validateOrganizationAccess } from '$lib/server/auth';
import { validarLimiteFacturas, validarAccesoFuncion } from '$lib/server/validar-plan';
import { hoyLocal, fechaLocal } from '$lib/utils/date';

export const GET: RequestHandler = async (event) => {
  // Verificar autenticación
  const user = getUserFromRequest(event);
  if (!user) {
    return unauthorizedResponse('Token de autenticación requerido');
  }

  const { url } = event;
  try {
    const searchParams = url.searchParams;

    // Parámetros de filtrado
    const cliente = searchParams.get('cliente') || '';
    const estado = searchParams.get('estado') || '';
    const estados = searchParams.get('estados') || ''; // Múltiples estados separados por coma
    const fechaInicio = searchParams.get('fechaInicio') || '';
    const fechaFin = searchParams.get('fechaFin') || '';
    const montoMin = searchParams.get('montoMin') || '';
    const montoMax = searchParams.get('montoMax') || '';
    const diasVencidoMin = searchParams.get('diasVencidoMin') || '';
    const diasVencidoMax = searchParams.get('diasVencidoMax') || '';
    const prioridad = searchParams.get('prioridad') || '';
    const organizacionId = searchParams.get('organizacionId') || '';

    // Parámetros de paginación
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    // Parámetros de ordenamiento
    const ordenCampo = searchParams.get('ordenCampo') || 'FechaEmision';
    const ordenDireccion = searchParams.get('ordenDireccion') || 'DESC';

    // Validar ordenDireccion
    const direccion = ordenDireccion.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    // Mapeo de nombres de campo del frontend a nombres de BD
    const camposBD: { [key: string]: string } = {
      'numero_factura': 'f.numero_factura',
      'MontoTotal': 'f.montototal',
      'SaldoPendiente': 'f.saldopendiente',
      'CreatedAt': 'f.createdat',
      'FechaEmision': 'f.fechaemision',
      'FechaVencimiento': 'f.fechavencimiento',
      'DiasVencido': 'f.diasvencido',
      'Cliente': 'c.razonsocial'
    };

    // Obtener nombre del campo en BD (por defecto fechaemision)
    const campoOrden = camposBD[ordenCampo] || 'f.fechaemision';

    // Construir query base
    let whereConditions: string[] = [];
    let queryParams: any[] = [];
    let paramIndex = 1;

    // OBLIGATORIO: Filtrar por organización para sistema multi-tenant
    if (!organizacionId) {
      return json({
        success: false,
        error: 'organizacionId es requerido para sistema multi-tenant'
      }, { status: 400 });
    }

    // Validar acceso a la organización
    const orgValidation = await validateOrganizationAccess(event, organizacionId);
    if (!orgValidation.valid) {
      return orgValidation.error!;
    }

    // Filtrar por organización para sistema multi-tenant
    whereConditions.push(`c.organizacionid = $${paramIndex++}`);
    queryParams.push(organizacionId);

    // Agregar filtros dinámicamente
    if (cliente) {
      whereConditions.push(`(c.razonsocial ILIKE $${paramIndex} OR c.nombrecomercial ILIKE $${paramIndex + 1} OR c.rfc ILIKE $${paramIndex + 2} OR f.numero_factura ILIKE $${paramIndex + 3} OR f.identificador ILIKE $${paramIndex + 4})`);
      const clientePattern = `%${cliente}%`;
      queryParams.push(clientePattern, clientePattern, clientePattern, clientePattern, clientePattern);
      paramIndex += 5;
    }

    // Filtro por estado (único o múltiple)
    if (estados) {
      // Si viene el parámetro 'estados' con múltiples IDs separados por coma
      const estadosArray = estados.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      if (estadosArray.length > 0) {
        const placeholders = estadosArray.map(() => `$${paramIndex++}`).join(',');
        whereConditions.push(`f.estado_factura_id IN (${placeholders})`);
        queryParams.push(...estadosArray);
      }
    } else if (estado) {
      // Si viene el parámetro 'estado' con código de estado (compatibilidad hacia atrás)
      whereConditions.push(`ef.codigo = $${paramIndex++}`);
      queryParams.push(estado);
    }

    if (fechaInicio) {
      whereConditions.push(`f.fechaemision >= $${paramIndex++}`);
      queryParams.push(fechaInicio);
    }

    if (fechaFin) {
      whereConditions.push(`f.fechaemision <= $${paramIndex++}`);
      queryParams.push(fechaFin);
    }

    if (montoMin) {
      whereConditions.push(`f.montototal >= $${paramIndex++}`);
      queryParams.push(parseFloat(montoMin));
    }

    if (montoMax) {
      whereConditions.push(`f.montototal <= $${paramIndex++}`);
      queryParams.push(parseFloat(montoMax));
    }

    if (diasVencidoMin) {
      whereConditions.push(`f.diasvencido >= $${paramIndex++}`);
      queryParams.push(parseInt(diasVencidoMin));
    }

    if (diasVencidoMax) {
      whereConditions.push(`f.diasvencido <= $${paramIndex++}`);
      queryParams.push(parseInt(diasVencidoMax));
    }

    if (prioridad) {
      whereConditions.push(`pc.codigo = $${paramIndex++}`);
      queryParams.push(prioridad);
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

    // Query principal para obtener facturas con saldo calculado dinámicamente
    const facturaQuery = `
      SELECT
        f.id,
        f.clienteid,
        f.numero_factura,
        f.montototal,
        CASE
          WHEN LOWER(f.metodopago) = 'pue' THEN 0
          ELSE f.montototal - COALESCE(pagos.totalpagado, 0)
        END as saldopendientecalculado,
        f.fechaemision,
        f.fechavencimiento,
        f.diasvencido,
        f.ultimagestion,
        f.observaciones,
        f.createdat,
        f.timbrado,
        f.identificador,
        f.metodopago,
        COALESCE(f.recurrenciaactiva, false) as recurrenciaactiva,
        f.facturaorigenid,
        COALESCE(f.facturasgeneradas, 0) as facturasgeneradas,
        c.razonsocial as clienterazonsocial,
        c.nombrecomercial as clientenombrecomercial,
        c.rfc as clienterfc,
        c.correoprincipal as clienteemail,
        c.telefono as clientetelefono,
        c.telefonowhatsapp as clientetelefonowhatsapp,
        c.codigopais as clientecodigopais,
        ef.codigo as estadocodigo,
        ef.id as estadoid,
        pc.codigo as prioridadcodigo,
        pc.id as prioridadid
      FROM facturas f
      INNER JOIN clientes c ON f.clienteid = c.id
      LEFT JOIN estados_factura ef ON f.estado_factura_id = ef.id
      LEFT JOIN prioridades_cobranza pc ON f.prioridad_cobranza_id = pc.id
      LEFT JOIN (
        SELECT facturaid, SUM(monto) as totalpagado
        FROM pagos
        WHERE COALESCE(cancelado, false) = false
        GROUP BY facturaid
      ) pagos ON f.id = pagos.facturaid
      ${whereClause}
      ORDER BY ${campoOrden} ${direccion}, f.id DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    // Query para contar total de registros
    const countQuery = `
      SELECT COUNT(*) as total
      FROM facturas f
      INNER JOIN clientes c ON f.clienteid = c.id
      LEFT JOIN estados_factura ef ON f.estado_factura_id = ef.id
      LEFT JOIN prioridades_cobranza pc ON f.prioridad_cobranza_id = pc.id
      ${whereClause}
    `;

    // Ejecutar ambas queries
    const facturas = await db.query(facturaQuery, [...queryParams, limit, offset]);
    const countResult = await db.query(countQuery, queryParams);
    const total = countResult[0]?.total || 0;

    // Query para obtener resumen de aging
    const agingQuery = `
      SELECT
        COUNT(*) as totalfacturas,
        SUM(f.saldopendiente) as montototal,
        SUM(CASE WHEN f.diasvencido >= 0 AND f.diasvencido <= 30 THEN f.saldopendiente ELSE 0 END) as aging0_30,
        SUM(CASE WHEN f.diasvencido > 30 AND f.diasvencido <= 60 THEN f.saldopendiente ELSE 0 END) as aging31_60,
        SUM(CASE WHEN f.diasvencido > 60 AND f.diasvencido <= 90 THEN f.saldopendiente ELSE 0 END) as aging61_90,
        SUM(CASE WHEN f.diasvencido > 90 THEN f.saldopendiente ELSE 0 END) as aging91_mas,
        COUNT(CASE WHEN f.diasvencido >= 0 AND f.diasvencido <= 30 THEN 1 END) as count0_30,
        COUNT(CASE WHEN f.diasvencido > 30 AND f.diasvencido <= 60 THEN 1 END) as count31_60,
        COUNT(CASE WHEN f.diasvencido > 60 AND f.diasvencido <= 90 THEN 1 END) as count61_90,
        COUNT(CASE WHEN f.diasvencido > 90 THEN 1 END) as count91_mas
      FROM facturas f
      INNER JOIN clientes c ON f.clienteid = c.id
      ${whereClause}
    `;

    const agingResult = await db.query(agingQuery, queryParams);
    const aging = agingResult[0] || {};

    // Query para contar facturas por estado (sin filtros de estado para mostrar totales reales)
    const conteoEstadosQuery = `
      SELECT
        ef.id as estadoid,
        COUNT(*) as total
      FROM facturas f
      INNER JOIN clientes c ON f.clienteid = c.id
      LEFT JOIN estados_factura ef ON f.estado_factura_id = ef.id
      WHERE c.organizacionid = $1
      GROUP BY ef.id
    `;

    const conteoEstadosResult = await db.query(conteoEstadosQuery, [organizacionId]);
    const conteoEstados: { [key: number]: number } = {
      1: 0, // Pendiente
      3: 0, // Pagada
      4: 0, // Vencida
      6: 0  // Cancelada
    };

    conteoEstadosResult.forEach((row: any) => {
      if (row.estadoid in conteoEstados) {
        conteoEstados[row.estadoid as keyof typeof conteoEstados] = row.total;
      }
    });

    // Formatear respuesta
    const facturasFormateadas = facturas.map((factura: any) => ({
      id: factura.id,
      clienteId: factura.clienteid,
      numeroFactura: factura.numero_factura,
      montoTotal: parseFloat(factura.montototal || 0),
      saldoPendiente: parseFloat(factura.saldopendientecalculado || 0),
      fechaEmision: factura.fechaemision,
      fechaVencimiento: factura.fechavencimiento,
      diasVencido: factura.diasvencido || 0,
      ultimaGestion: factura.ultimagestion,
      observaciones: factura.observaciones,
      createdAt: factura.createdat,
      timbrado: factura.timbrado,
      identificador: factura.identificador || null,
      metodoPago: factura.metodopago || null,
      recurrenciaActiva: factura.recurrenciaactiva ? true : false,
      facturaOrigenId: factura.facturaorigenid || null,
      facturasGeneradas: factura.facturasgeneradas || 0,
      cliente: {
        id: factura.clienteid,
        razonSocial: factura.clienterazonsocial,
        nombreComercial: factura.clientenombrecomercial,
        rfc: factura.clienterfc,
        correo: factura.clienteemail,
        telefono: factura.clientetelefono,
        telefonoWhatsApp: factura.clientetelefonowhatsapp,
        codigoPais: factura.clientecodigopais
      },
      estado: {
        id: factura.estadoid,
        codigo: factura.estadocodigo
      },
      prioridad: {
        id: factura.prioridadid,
        codigo: factura.prioridadcodigo
      }
    }));

    return json({
      success: true,
      facturas: facturasFormateadas,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      aging: {
        totalFacturas: aging.totalfacturas || 0,
        montoTotal: parseFloat(aging.montototal || 0),
        rango0_30: {
          monto: parseFloat(aging.aging0_30 || 0),
          count: aging.count0_30 || 0
        },
        rango31_60: {
          monto: parseFloat(aging.aging31_60 || 0),
          count: aging.count31_60 || 0
        },
        rango61_90: {
          monto: parseFloat(aging.aging61_90 || 0),
          count: aging.count61_90 || 0
        },
        rango91_mas: {
          monto: parseFloat(aging.aging91_mas || 0),
          count: aging.count91_mas || 0
        }
      },
      conteoEstados
    });

  } catch (error) {
    return json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
};

export const POST: RequestHandler = async (event) => {
  // Verificar autenticación
  const user = getUserFromRequest(event);
  if (!user) {
    return unauthorizedResponse('Token de autenticación requerido');
  }

  const { request, fetch } = event;
  let client: any = null;

  try {
    const data = await request.json();

    // Validar límite de facturas del plan
    const orgId = (user as any).organizacion;
    if (orgId) {
      const limiteFacturas = await validarLimiteFacturas(orgId);
      if (!limiteFacturas.permitido) {
        return json({
          success: false,
          error: limiteFacturas.mensaje,
          limite: {
            facturas_mes: limiteFacturas.facturas_mes,
            facturas_max: limiteFacturas.facturas_max,
            plan: limiteFacturas.plan
          }
        }, { status: 429 });
      }
    }

    // Validaciones básicas
    if (!data.clienteId) {
      return json({ success: false, error: 'ClienteId es requerido' }, { status: 400 });
    }

    if (!data.conceptos || data.conceptos.length === 0) {
      return json({ success: false, error: 'Debe incluir al menos un concepto' }, { status: 400 });
    }

    // Validar que todos los conceptos tengan la misma moneda que la factura
    const monedaFactura = data.moneda || 'MXN';
    for (const concepto of data.conceptos) {
      const monedaConcepto = concepto.monedaProducto || 'MXN';
      if (monedaConcepto !== monedaFactura) {
        return json({
          success: false,
          error: `El concepto "${concepto.nombre}" está en ${monedaConcepto} pero la factura está en ${monedaFactura}. Todos los conceptos deben usar la misma moneda que la factura.`
        }, { status: 400 });
      }
    }

    // Validación PUE: condiciones de pago no deben exceder 30 días
    if (data.metodoPago === 'PUE' || data.metodoPago === '99') {
      const condicionesPago = data.condicionesPago;
      const diasMapPUE: { [key: string]: number } = {
        'contado': 0,
        '7-dias': 7,
        '15-dias': 15,
        '30-dias': 30,
        '45-dias': 45,
        '60-dias': 60,
        '90-dias': 90,
        'De Contado': 0,
        '7 Días': 7,
        '15 Días': 15,
        '30 Días': 30,
        '45 Días': 45,
        '60 Días': 60,
        '90 Días': 90
      };
      const dias = diasMapPUE[condicionesPago] || 0;
      if (dias > 30) {
        return json({
          success: false,
          error: 'Validación PUE (Pago Único) rechazada',
          detalles: `Las facturas con método de pago PUE (Pago Único) solo pueden tener condiciones de pago de hasta 30 días. Actualmente está configurado a ${dias} días. Esto es una restricción fiscal: una factura PUE indica que debe pagarse en un plazo que no exceda el mes de su emisión para ser válida fiscalmente.`,
          codigo_error: 'PUE_CONDICIONES_INVALIDAS'
        }, { status: 422 });
      }
    }

    const pool = await getConnection();
    client = await pool.connect();
    await client.query('BEGIN');

    // Obtener información del cliente para saber la organización
    const clienteQuery = `
      SELECT
        c.id,
        c.organizacionid,
        c.idclientefacturaapi,
        o.rfc as organizacionrfc
      FROM clientes c
      INNER JOIN organizaciones o ON c.organizacionid = o.id
      WHERE c.id = $1
    `;
    const clienteResult = await client.query(clienteQuery, [data.clienteId]);

    if (!clienteResult.rows || clienteResult.rows.length === 0) {
      throw new Error('Cliente no encontrado');
    }

    const clienteRow = clienteResult.rows[0];
    const organizacionId = clienteRow.organizacionid;
    const organizacionRFC = clienteRow.organizacionrfc || 'FAC';

    // Validar que el cliente esté registrado en FacturaAPI
    if (!clienteRow.idclientefacturaapi) {
      await client.query('ROLLBACK');
      client.release();
      client = null;
      return json({
        success: false,
        error: 'Cliente no registrado en FacturaAPI',
        detalles: `El cliente "${data.clienteId}" no está registrado en FacturaAPI. Para emitir una factura, el cliente debe estar previamente sincronizado con FacturaAPI. Verifica que el cliente fue creado correctamente.`,
        codigo_error: 'CLIENTE_SIN_FACTURAPI'
      }, { status: 422 });
    }

    // Crear prefijo desde las primeras 3 letras del RFC de la organización
    const prefijo = organizacionRFC
      .toUpperCase()
      .substring(0, 3);

    // Generar número de factura consecutivo
    const ultimoNumeroQuery = `
      SELECT
        numero_factura,
        CAST(SUBSTRING(numero_factura FROM POSITION('-' IN numero_factura) + 1) AS INTEGER) as numeroextraido
      FROM facturas f
      INNER JOIN clientes c ON f.clienteid = c.id
      WHERE c.organizacionid = $1
        AND numero_factura LIKE $2 || '-%'
      ORDER BY CAST(SUBSTRING(numero_factura FROM POSITION('-' IN numero_factura) + 1) AS INTEGER) DESC
      LIMIT 1
    `;

    const ultimoNumeroResult = await client.query(ultimoNumeroQuery, [organizacionId, prefijo]);

    let numeroConsecutivo = 1;
    if (ultimoNumeroResult.rows && ultimoNumeroResult.rows.length > 0) {
      const numeroExtraido = ultimoNumeroResult.rows[0].numeroextraido;
      if (numeroExtraido) {
        numeroConsecutivo = numeroExtraido + 1;
      }
    }

    const numeroFactura = `${prefijo}-${numeroConsecutivo}`;

    // Calcular totales correctamente desde los conceptos con impuestos
    let montoTotalFactura = 0;
    for (const concepto of data.conceptos) {
      const totalConceptoConIVA = parseFloat(concepto.total);
      montoTotalFactura += totalConceptoConIVA;
    }

    const fechaEmision = data.fechaEmision || hoyLocal();

    // Calcular fecha de vencimiento basada en condiciones de pago
    let fechaVencimiento = fechaEmision;
    if (data.condicionesPago) {
      const diasMap: { [key: string]: number } = {
        'contado': 0,
        '7-dias': 7,
        '15-dias': 15,
        '30-dias': 30,
        '45-dias': 45,
        '60-dias': 60,
        '90-dias': 90,
        // Compatibilidad con formato antiguo
        'De Contado': 0,
        '7 Días': 7,
        '15 Días': 15,
        '30 Días': 30,
        '45 Días': 45,
        '60 Días': 60,
        '90 Días': 90
      };
      const dias = diasMap[data.condicionesPago] || 30;
      const fecha = new Date(fechaEmision + 'T00:00:00');
      fecha.setDate(fecha.getDate() + dias);
      fechaVencimiento = fechaLocal(fecha);
    }

    // Campos de recurrencia
    const recurrencia = data.recurrencia;
    let recurrenciaActiva = false;
    if (recurrencia && data.recurrenciaActiva) {
      // Validar acceso a recurrencia según plan
      if (orgId) {
        const accesoRecurrencia = await validarAccesoFuncion(orgId, 'recurrencia');
        if (!accesoRecurrencia.permitido) {
          await client.query('ROLLBACK');
          client.release();
          client = null;
          return json({
            success: false,
            error: accesoRecurrencia.mensaje
          }, { status: 403 });
        }
      }
      recurrenciaActiva = true;
    }

    // Insertar factura principal
    const insertFacturaQuery = `
      INSERT INTO facturas (
        clienteid, montototal, saldopendiente, fechaemision, fechavencimiento,
        estado_factura_id, prioridad_cobranza_id, numero_factura,
        metodopago, formapago, usocfdi, ordencompra, moneda, tipocambio, condicionespago,
        notascliente, notasinternas, desglosarimpuestos, identificador,
        usuariocreadorid,
        recurrenciaactiva, ordenrecurrencia, identificadorrecurrencia,
        fechainiciorecurrencia, fechaprimerafactura, periodorecurrencia,
        diarecurrencia, cadarecurrencia, finrecurrencia,
        fechafinrecurrencia, numeroocurrencias,
        agenteiaactivo,
        enviarporcorreo, enviarporwhatsapp
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8,
        $9, $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19,
        $20,
        $21, $22, $23,
        $24, $25, $26,
        $27, $28, $29,
        $30, $31,
        $32,
        $33, $34
      ) RETURNING id
    `;

    const esPUE = (data.metodoPago || 'PUE') === 'PUE';

    const facturaParams = [
      data.clienteId,
      montoTotalFactura,
      esPUE ? 0 : montoTotalFactura,
      fechaEmision,
      fechaVencimiento,
      esPUE ? 3 : 1, // PUE = Pagada (3), PPD = Pendiente (1)
      2, // Media
      numeroFactura,
      data.metodoPago || 'PUE',
      data.formaPago || '99',
      data.usoCfdi || 'G03',
      data.ordenCompra || null,
      data.moneda || 'MXN',
      parseFloat(data.tipoCambio || '1.0000'),
      data.condicionesPago || null,
      data.notasCliente || null,
      data.notasInternas || null,
      data.desglosarImpuestos ? true : false,
      data.identificador || null,
      data.usuarioCreadorId || null,
      recurrenciaActiva,
      recurrenciaActiva ? recurrencia.orden || null : null,
      recurrenciaActiva ? recurrencia.identificador || null : null,
      recurrenciaActiva ? recurrencia.inicio || null : null,
      recurrenciaActiva ? recurrencia.fechaPrimeraFactura || null : null,
      recurrenciaActiva ? recurrencia.periodo || null : null,
      recurrenciaActiva ? recurrencia.dia || null : null,
      recurrenciaActiva ? recurrencia.cada || null : null,
      recurrenciaActiva ? recurrencia.fin || null : null,
      recurrenciaActiva ? recurrencia.fechaFin || null : null,
      recurrenciaActiva ? recurrencia.ocurrencias || null : null,
      data.agenteIAActivo ? true : false,
      data.enviarPorCorreo ? true : false,
      data.enviarPorWhatsApp ? true : false
    ];

    const facturaResult = await client.query(insertFacturaQuery, facturaParams);
    const facturaId = facturaResult.rows[0].id;

    // Validar conceptos antes de insertar
    for (const concepto of data.conceptos) {
      // Validar que tenga clave de producto/servicio
      if (!concepto.productoServicio || concepto.productoServicio.trim() === '') {
        await client.query('ROLLBACK');
        client.release();
        client = null;
        return json({
          success: false,
          error: `El concepto "${concepto.nombre}" no tiene una clave de producto/servicio SAT válida. Debe seleccionar una opción de la lista.`
        }, { status: 400 });
      }

      // Validar formato de clave (8 dígitos)
      if (!/^\d{8}$/.test(concepto.productoServicio)) {
        await client.query('ROLLBACK');
        client.release();
        client = null;
        return json({
          success: false,
          error: `El concepto "${concepto.nombre}" tiene una clave de producto/servicio inválida: "${concepto.productoServicio}". Debe ser de 8 dígitos.`
        }, { status: 400 });
      }
    }

    // Insertar conceptos e impuestos
    for (const concepto of data.conceptos) {
      let tasaIVA = 0;
      if (concepto.impuestos && concepto.impuestos.length > 0) {
        tasaIVA = parseFloat(concepto.impuestos[0].tasa) || 0;
      }

      const totalFinalConIVA = parseFloat(concepto.total);
      const cantidad = parseFloat(concepto.cantidad);
      const subtotal = totalFinalConIVA / (1 + tasaIVA);
      const precioUnitarioSinIVA = subtotal / cantidad;
      const totalImpuestos = subtotal * tasaIVA;
      const totalFinal = subtotal + totalImpuestos;

      const insertConceptoQuery = `
        INSERT INTO conceptosfactura (
          facturaid, nombre, descripcion, claveprodserv, unidadmedida, cantidad,
          preciounitario, subtotal, monedaproducto, objetoimpuesto, totalimpuestos, total
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12
        ) RETURNING id
      `;

      const conceptoResult = await client.query(insertConceptoQuery, [
        facturaId,
        concepto.nombre,
        concepto.descripcion || null,
        concepto.productoServicio || null,
        concepto.unidadMedida,
        concepto.cantidad,
        precioUnitarioSinIVA,
        subtotal,
        concepto.monedaProducto || 'MXN',
        concepto.objetoImpuesto || '02',
        totalImpuestos,
        totalFinal
      ]);

      const conceptoId = conceptoResult.rows[0].id;

      // Insertar impuestos del concepto
      if (concepto.impuestos && concepto.impuestos.length > 0) {
        for (const impuesto of concepto.impuestos) {
          const montoImpuesto = subtotal * parseFloat(impuesto.tasa);

          await client.query(`
            INSERT INTO impuestosconcepto (conceptoid, tipo, tasa, monto)
            VALUES ($1, $2, $3, $4)
          `, [conceptoId, impuesto.tipo, impuesto.tasa, montoImpuesto]);
        }
      }
    }

    await client.query('COMMIT');

    // Verificar si la fecha de emisión es la misma que la fecha actual
    const fechaActual = hoyLocal();
    const fechaEmisionFactura = fechaLocal(fechaEmision);
    const esMismaFecha = fechaEmisionFactura === fechaActual;

    // Si es recurrencia y la fecha de la primera factura es diferente a hoy, no timbrar
    const fechaPrimeraFacturaRec = data.recurrencia?.fechaPrimeraFactura;
    const saltarPorFechaPrimeraFactura = data.recurrenciaActiva && fechaPrimeraFacturaRec &&
      fechaLocal(fechaPrimeraFacturaRec) !== fechaActual;

    // Timbrar y enviar factura automáticamente SOLO si la fecha de emisión es HOY
    let resultadoTimbrado = null;
    if (esMismaFecha && !saltarPorFechaPrimeraFactura) {
      try {
        const csrfToken = event.cookies.get('csrf_token');
        const responseTimbrado = await fetch('/api/facturas/timbrar', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(csrfToken && { 'X-CSRF-Token': csrfToken })
          },
          body: JSON.stringify({ facturaId })
        });

        const timbradoData = await responseTimbrado.json();
        if (responseTimbrado.ok) {
          resultadoTimbrado = timbradoData;
        } else {
          resultadoTimbrado = { success: false, message: 'No se pudo timbrar automáticamente', details: timbradoData.details || timbradoData.error || 'Error desconocido' };
        }
      } catch (errorTimbrado) {
        // Si falla el timbrado, continuar sin error (la factura ya está guardada)
        console.error('Error al timbrar factura automáticamente:', errorTimbrado);
      }
    }

    const seTimbro = esMismaFecha && !saltarPorFechaPrimeraFactura;

    return json({
      success: true,
      message: seTimbro
        ? 'Factura creada exitosamente con conceptos e impuestos'
        : saltarPorFechaPrimeraFactura
          ? 'Factura creada exitosamente. No se timbró porque la fecha de la primer factura es diferente a hoy.'
          : 'Factura creada exitosamente. El timbrado automático solo se realiza para facturas con fecha de emisión actual.',
      facturaId,
      timbrado: seTimbro
        ? (resultadoTimbrado || { success: false, message: 'No se pudo timbrar automáticamente' })
        : { success: false, message: saltarPorFechaPrimeraFactura ? 'No se timbró automáticamente porque la fecha de la primer factura es diferente a hoy' : 'No se timbró automáticamente porque la fecha de emisión es diferente a la fecha actual' }
    }, { status: 201 });

  } catch (error) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
      }
    }

    console.error('Error al crear factura:', error);

    return json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  } finally {
    client?.release();
  }
};