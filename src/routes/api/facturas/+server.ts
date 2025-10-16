import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, getConnection } from '$lib/server/db';
import sql from 'mssql';
import { getUserFromRequest, unauthorizedResponse } from '$lib/server/auth';

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
      'MontoTotal': 'f.MontoTotal',
      'SaldoPendiente': 'f.SaldoPendiente',
      'CreatedAt': 'f.CreatedAt',
      'FechaEmision': 'f.FechaEmision',
      'FechaVencimiento': 'f.FechaVencimiento',
      'DiasVencido': 'f.DiasVencido'
    };

    // Obtener nombre del campo en BD (por defecto FechaEmision)
    const campoOrden = camposBD[ordenCampo] || 'f.FechaEmision';

    // Construir query base
    let whereConditions: string[] = [];
    let queryParams: any[] = [];

    // OBLIGATORIO: Filtrar por organización para sistema multi-tenant
    if (!organizacionId) {
      return json({
        success: false,
        error: 'organizacionId es requerido para sistema multi-tenant'
      }, { status: 400 });
    }

    // Filtrar por organización para sistema multi-tenant
    whereConditions.push('c.OrganizacionId = ?');
    queryParams.push(organizacionId);

    // Agregar filtros dinámicamente
    if (cliente) {
      whereConditions.push('(c.RazonSocial LIKE ? OR c.NombreComercial LIKE ? OR c.RFC LIKE ?)');
      const clientePattern = `%${cliente}%`;
      queryParams.push(clientePattern, clientePattern, clientePattern);
    }

    if (estado) {
      whereConditions.push('ef.codigo = ?');
      queryParams.push(estado);
    }

    if (fechaInicio) {
      whereConditions.push('f.FechaEmision >= ?');
      queryParams.push(fechaInicio);
    }

    if (fechaFin) {
      whereConditions.push('f.FechaEmision <= ?');
      queryParams.push(fechaFin);
    }

    if (montoMin) {
      whereConditions.push('f.MontoTotal >= ?');
      queryParams.push(parseFloat(montoMin));
    }

    if (montoMax) {
      whereConditions.push('f.MontoTotal <= ?');
      queryParams.push(parseFloat(montoMax));
    }

    if (diasVencidoMin) {
      whereConditions.push('f.DiasVencido >= ?');
      queryParams.push(parseInt(diasVencidoMin));
    }

    if (diasVencidoMax) {
      whereConditions.push('f.DiasVencido <= ?');
      queryParams.push(parseInt(diasVencidoMax));
    }

    if (prioridad) {
      whereConditions.push('pc.codigo = ?');
      queryParams.push(prioridad);
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

    // Query principal para obtener facturas con saldo calculado dinámicamente
    const facturaQuery = `
      SELECT
        f.Id,
        f.ClienteId,
        f.numero_factura,
        f.MontoTotal,
        f.MontoTotal - ISNULL(pagos.TotalPagado, 0) as SaldoPendienteCalculado,
        f.FechaEmision,
        f.FechaVencimiento,
        f.DiasVencido,
        f.UltimaGestion,
        f.Observaciones,
        f.CreatedAt,
        c.RazonSocial as ClienteRazonSocial,
        c.NombreComercial as ClienteNombreComercial,
        c.RFC as ClienteRFC,
        c.CorreoPrincipal as ClienteEmail,
        c.Telefono as ClienteTelefono,
        ef.codigo as EstadoCodigo,
        ef.id as EstadoId,
        pc.codigo as PrioridadCodigo,
        pc.id as PrioridadId
      FROM Facturas f
      INNER JOIN Clientes c ON f.ClienteId = c.Id
      LEFT JOIN estados_factura ef ON f.estado_factura_id = ef.id
      LEFT JOIN prioridades_cobranza pc ON f.prioridad_cobranza_id = pc.id
      LEFT JOIN (
        SELECT FacturaId, SUM(Monto) as TotalPagado
        FROM Pagos
        GROUP BY FacturaId
      ) pagos ON f.Id = pagos.FacturaId
      ${whereClause}
      ORDER BY ${campoOrden} ${direccion}, f.Id DESC
      OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
    `;

    // Query para contar total de registros
    const countQuery = `
      SELECT COUNT(*) as total
      FROM Facturas f
      INNER JOIN Clientes c ON f.ClienteId = c.Id
      LEFT JOIN estados_factura ef ON f.estado_factura_id = ef.id
      LEFT JOIN prioridades_cobranza pc ON f.prioridad_cobranza_id = pc.id
      ${whereClause}
    `;

    // Ejecutar ambas queries
    const facturas = await db.query(facturaQuery, [...queryParams, offset, limit]);
    const countResult = await db.query(countQuery, queryParams);
    const total = countResult[0]?.total || 0;

    // Query para obtener resumen de aging
    const agingQuery = `
      SELECT
        COUNT(*) as totalFacturas,
        SUM(f.SaldoPendiente) as montoTotal,
        SUM(CASE WHEN f.DiasVencido >= 0 AND f.DiasVencido <= 30 THEN f.SaldoPendiente ELSE 0 END) as aging0_30,
        SUM(CASE WHEN f.DiasVencido > 30 AND f.DiasVencido <= 60 THEN f.SaldoPendiente ELSE 0 END) as aging31_60,
        SUM(CASE WHEN f.DiasVencido > 60 AND f.DiasVencido <= 90 THEN f.SaldoPendiente ELSE 0 END) as aging61_90,
        SUM(CASE WHEN f.DiasVencido > 90 THEN f.SaldoPendiente ELSE 0 END) as aging91_mas,
        COUNT(CASE WHEN f.DiasVencido >= 0 AND f.DiasVencido <= 30 THEN 1 END) as count0_30,
        COUNT(CASE WHEN f.DiasVencido > 30 AND f.DiasVencido <= 60 THEN 1 END) as count31_60,
        COUNT(CASE WHEN f.DiasVencido > 60 AND f.DiasVencido <= 90 THEN 1 END) as count61_90,
        COUNT(CASE WHEN f.DiasVencido > 90 THEN 1 END) as count91_mas
      FROM Facturas f
      INNER JOIN Clientes c ON f.ClienteId = c.Id
      ${whereClause}
    `;

    const agingResult = await db.query(agingQuery, queryParams);
    const aging = agingResult[0] || {};

    // Formatear respuesta
    const facturasFormateadas = facturas.map(factura => ({
      id: factura.Id,
      clienteId: factura.ClienteId,
      numeroFactura: factura.numero_factura,
      montoTotal: parseFloat(factura.MontoTotal || 0),
      saldoPendiente: parseFloat(factura.SaldoPendienteCalculado || 0),
      fechaEmision: factura.FechaEmision,
      fechaVencimiento: factura.FechaVencimiento,
      diasVencido: factura.DiasVencido || 0,
      ultimaGestion: factura.UltimaGestion,
      observaciones: factura.Observaciones,
      createdAt: factura.CreatedAt,
      cliente: {
        id: factura.ClienteId,
        razonSocial: factura.ClienteRazonSocial,
        nombreComercial: factura.ClienteNombreComercial,
        rfc: factura.ClienteRFC,
        email: factura.ClienteEmail,
        telefono: factura.ClienteTelefono
      },
      estado: {
        id: factura.EstadoId,
        codigo: factura.EstadoCodigo
      },
      prioridad: {
        id: factura.PrioridadId,
        codigo: factura.PrioridadCodigo
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
        totalFacturas: aging.totalFacturas || 0,
        montoTotal: parseFloat(aging.montoTotal || 0),
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
      }
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
  let transaction: sql.Transaction | null = null;

  try {
    const data = await request.json();

    // Validaciones básicas
    if (!data.clienteId) {
      return json({ success: false, error: 'ClienteId es requerido' }, { status: 400 });
    }

    if (!data.conceptos || data.conceptos.length === 0) {
      return json({ success: false, error: 'Debe incluir al menos un concepto' }, { status: 400 });
    }

    const pool = await getConnection();
    transaction = new sql.Transaction(pool);
    await transaction.begin();

    // Obtener información del cliente para saber la organización
    const clienteQuery = `
      SELECT c.OrganizacionId, o.RFC as OrganizacionRFC
      FROM Clientes c
      INNER JOIN Organizaciones o ON c.OrganizacionId = o.Id
      WHERE c.Id = @ClienteId
    `;
    const clienteResult = await pool.request()
      .input('ClienteId', sql.Int, data.clienteId)
      .query(clienteQuery);

    if (!clienteResult.recordset || clienteResult.recordset.length === 0) {
      throw new Error('Cliente no encontrado');
    }

    const organizacionId = clienteResult.recordset[0].OrganizacionId;
    const organizacionRFC = clienteResult.recordset[0].OrganizacionRFC || 'FAC';

    // Crear prefijo desde las primeras 3 letras del RFC de la organización
    const prefijo = organizacionRFC
      .toUpperCase()
      .substring(0, 3);

    // Generar número de factura consecutivo
    const ultimoNumeroQuery = `
      SELECT TOP 1
        numero_factura,
        TRY_CAST(SUBSTRING(numero_factura, CHARINDEX('-', numero_factura) + 1, LEN(numero_factura)) AS INT) as NumeroExtraido
      FROM Facturas f
      INNER JOIN Clientes c ON f.ClienteId = c.Id
      WHERE c.OrganizacionId = @OrganizacionId
        AND numero_factura LIKE @Prefijo + '-%'
      ORDER BY TRY_CAST(SUBSTRING(numero_factura, CHARINDEX('-', numero_factura) + 1, LEN(numero_factura)) AS INT) DESC
    `;

    const ultimoNumeroResult = await pool.request()
      .input('OrganizacionId', sql.Int, organizacionId)
      .input('Prefijo', sql.NVarChar(10), prefijo)
      .query(ultimoNumeroQuery);

    let numeroConsecutivo = 1;
    if (ultimoNumeroResult.recordset && ultimoNumeroResult.recordset.length > 0) {
      const numeroExtraido = ultimoNumeroResult.recordset[0].NumeroExtraido;
      if (numeroExtraido) {
        numeroConsecutivo = numeroExtraido + 1;
      }
    }

    const numeroFactura = `${prefijo}-${numeroConsecutivo}`;

    // Calcular totales correctamente desde los conceptos con impuestos
    // El total de la factura es la suma de los totales de cada concepto
    // Cada concepto.total ya viene con IVA incluido
    let montoTotalFactura = 0;
    for (const concepto of data.conceptos) {
      const totalConceptoConIVA = parseFloat(concepto.total);
      montoTotalFactura += totalConceptoConIVA;
    }

    const fechaEmision = data.fechaEmision || new Date().toISOString().split('T')[0];

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
      const fecha = new Date(fechaEmision);
      fecha.setDate(fecha.getDate() + dias);
      fechaVencimiento = fecha.toISOString().split('T')[0];
    }

    // Insertar factura principal
    const insertFacturaQuery = `
      INSERT INTO Facturas (
        ClienteId, MontoTotal, SaldoPendiente, FechaEmision, FechaVencimiento,
        estado_factura_id, prioridad_cobranza_id, numero_factura,
        MetodoPago, FormaPago, UsoCFDI, OrdenCompra, Moneda, TipoCambio, CondicionesPago,
        NotasCliente, NotasInternas, DesglosarImpuestos, Identificador,
        UsuarioCreadorId,
        RecurrenciaActiva, OrdenRecurrencia, IdentificadorRecurrencia,
        FechaInicioRecurrencia, FechaPrimeraFactura, PeriodoRecurrencia,
        DiaRecurrencia, CadaRecurrencia, FinRecurrencia,
        FechaFinRecurrencia, NumeroOcurrencias
      )
      OUTPUT INSERTED.Id
      VALUES (
        @ClienteId, @MontoTotal, @SaldoPendiente, @FechaEmision, @FechaVencimiento,
        @EstadoId, @PrioridadId, @NumeroFactura,
        @MetodoPago, @FormaPago, @UsoCFDI, @OrdenCompra, @Moneda, @TipoCambio, @CondicionesPago,
        @NotasCliente, @NotasInternas, @DesglosarImpuestos, @Identificador,
        @UsuarioCreadorId,
        @RecurrenciaActiva, @OrdenRecurrencia, @IdentificadorRecurrencia,
        @FechaInicioRecurrencia, @FechaPrimeraFactura, @PeriodoRecurrencia,
        @DiaRecurrencia, @CadaRecurrencia, @FinRecurrencia,
        @FechaFinRecurrencia, @NumeroOcurrencias
      )
    `;

    const facturaRequest = new sql.Request(transaction)
      .input('ClienteId', sql.Int, data.clienteId)
      .input('MontoTotal', sql.Decimal(18, 2), montoTotalFactura)
      .input('SaldoPendiente', sql.Decimal(18, 2), montoTotalFactura)
      .input('FechaEmision', sql.Date, fechaEmision)
      .input('FechaVencimiento', sql.Date, fechaVencimiento)
      .input('EstadoId', sql.Int, 1) // Pendiente
      .input('PrioridadId', sql.Int, 2) // Media
      .input('NumeroFactura', sql.NVarChar(100), numeroFactura)
      .input('MetodoPago', sql.NVarChar(10), data.metodoPago || 'PUE')
      .input('FormaPago', sql.NVarChar(10), data.formaPago || '99')
      .input('UsoCFDI', sql.NVarChar(10), data.usoCfdi || 'G03')
      .input('OrdenCompra', sql.NVarChar(100), data.ordenCompra || null)
      .input('Moneda', sql.NVarChar(10), data.moneda || 'MXN')
      .input('TipoCambio', sql.Decimal(10, 4), parseFloat(data.tipoCambio || '1.0000'))
      .input('CondicionesPago', sql.NVarChar(50), data.condicionesPago || null)
      .input('NotasCliente', sql.NVarChar(sql.MAX), data.notasCliente || null)
      .input('NotasInternas', sql.NVarChar(sql.MAX), data.notasInternas || null)
      .input('DesglosarImpuestos', sql.Bit, data.desglosarImpuestos ? 1 : 0)
      .input('Identificador', sql.NVarChar(100), data.identificador || null)
      .input('UsuarioCreadorId', sql.Int, data.usuarioCreadorId || null);

    // Campos de recurrencia
    const recurrencia = data.recurrencia;
    if (recurrencia && data.recurrenciaActiva) {
      facturaRequest
        .input('RecurrenciaActiva', sql.Bit, 1)
        .input('OrdenRecurrencia', sql.NVarChar(50), recurrencia.orden || null)
        .input('IdentificadorRecurrencia', sql.NVarChar(100), recurrencia.identificador || null)
        .input('FechaInicioRecurrencia', sql.Date, recurrencia.inicio || null)
        .input('FechaPrimeraFactura', sql.Date, recurrencia.fechaPrimeraFactura || null)
        .input('PeriodoRecurrencia', sql.NVarChar(20), recurrencia.periodo || null)
        .input('DiaRecurrencia', sql.NVarChar(10), recurrencia.dia || null)
        .input('CadaRecurrencia', sql.NVarChar(20), recurrencia.cada || null)
        .input('FinRecurrencia', sql.NVarChar(20), recurrencia.fin || null)
        .input('FechaFinRecurrencia', sql.Date, recurrencia.fechaFin || null)
        .input('NumeroOcurrencias', sql.Int, recurrencia.ocurrencias || null);
    } else {
      facturaRequest
        .input('RecurrenciaActiva', sql.Bit, 0)
        .input('OrdenRecurrencia', sql.NVarChar(50), null)
        .input('IdentificadorRecurrencia', sql.NVarChar(100), null)
        .input('FechaInicioRecurrencia', sql.Date, null)
        .input('FechaPrimeraFactura', sql.Date, null)
        .input('PeriodoRecurrencia', sql.NVarChar(20), null)
        .input('DiaRecurrencia', sql.NVarChar(10), null)
        .input('CadaRecurrencia', sql.NVarChar(20), null)
        .input('FinRecurrencia', sql.NVarChar(20), null)
        .input('FechaFinRecurrencia', sql.Date, null)
        .input('NumeroOcurrencias', sql.Int, null);
    }

    const facturaResult = await facturaRequest.query(insertFacturaQuery);
    const facturaId = facturaResult.recordset[0].Id;

    // Validar conceptos antes de insertar
    for (const concepto of data.conceptos) {
      // Validar que tenga clave de producto/servicio
      if (!concepto.productoServicio || concepto.productoServicio.trim() === '') {
        await transaction.rollback();
        return json({
          success: false,
          error: `El concepto "${concepto.nombre}" no tiene una clave de producto/servicio SAT válida. Debe seleccionar una opción de la lista.`
        }, { status: 400 });
      }

      // Validar formato de clave (8 dígitos)
      if (!/^\d{8}$/.test(concepto.productoServicio)) {
        await transaction.rollback();
        return json({
          success: false,
          error: `El concepto "${concepto.nombre}" tiene una clave de producto/servicio inválida: "${concepto.productoServicio}". Debe ser de 8 dígitos.`
        }, { status: 400 });
      }
    }

    // Insertar conceptos e impuestos
    for (const concepto of data.conceptos) {
      // Calcular valores correctamente según SAT México:
      // El 'total' que viene del frontend es el precio TOTAL FINAL con IVA incluido (para todas las unidades)
      // Necesitamos calcular el precio unitario SIN IVA (ValorUnitario del SAT)
      // Fórmula: Subtotal = Total / (1 + tasa_iva)
      //          IVA = Subtotal × tasa_iva

      let tasaIVA = 0;
      if (concepto.impuestos && concepto.impuestos.length > 0) {
        // Obtener la tasa del primer impuesto (generalmente IVA)
        tasaIVA = parseFloat(concepto.impuestos[0].tasa) || 0;
      }

      // Total FINAL con IVA incluido (para todas las unidades)
      const totalFinalConIVA = parseFloat(concepto.total);
      const cantidad = parseFloat(concepto.cantidad);

      // Calcular subtotal (sin IVA) según fórmula del SAT
      // Subtotal = Total / (1 + tasa)
      const subtotal = totalFinalConIVA / (1 + tasaIVA);

      // Calcular precio unitario SIN IVA (ValorUnitario según SAT)
      const precioUnitarioSinIVA = subtotal / cantidad;

      // Calcular total de impuestos
      // IVA = Subtotal × tasa
      const totalImpuestos = subtotal * tasaIVA;

      // Total final (debe ser igual al que vino del frontend)
      const totalFinal = subtotal + totalImpuestos;

      const insertConceptoQuery = `
        INSERT INTO ConceptosFactura (
          FacturaId, Nombre, Descripcion, ClaveProdServ, UnidadMedida, Cantidad,
          PrecioUnitario, Subtotal, MonedaProducto, ObjetoImpuesto, TotalImpuestos, Total
        )
        OUTPUT INSERTED.Id
        VALUES (
          @FacturaId, @Nombre, @Descripcion, @ClaveProdServ, @UnidadMedida, @Cantidad,
          @PrecioUnitario, @Subtotal, @MonedaProducto, @ObjetoImpuesto, @TotalImpuestos, @Total
        )
      `;

      const conceptoResult = await new sql.Request(transaction)
        .input('FacturaId', sql.Int, facturaId)
        .input('Nombre', sql.NVarChar(255), concepto.nombre)
        .input('Descripcion', sql.NVarChar(500), concepto.descripcion || null)
        .input('ClaveProdServ', sql.NVarChar(50), concepto.productoServicio || null)
        .input('UnidadMedida', sql.NVarChar(10), concepto.unidadMedida)
        .input('Cantidad', sql.Decimal(18, 2), concepto.cantidad)
        .input('PrecioUnitario', sql.Decimal(18, 2), precioUnitarioSinIVA)
        .input('Subtotal', sql.Decimal(18, 2), subtotal)
        .input('MonedaProducto', sql.NVarChar(10), concepto.monedaProducto || 'MXN')
        .input('ObjetoImpuesto', sql.NVarChar(10), concepto.objetoImpuesto || '02')
        .input('TotalImpuestos', sql.Decimal(18, 2), totalImpuestos)
        .input('Total', sql.Decimal(18, 2), totalFinal)
        .query(insertConceptoQuery);

      const conceptoId = conceptoResult.recordset[0].Id;

      // Insertar impuestos del concepto
      if (concepto.impuestos && concepto.impuestos.length > 0) {
        for (const impuesto of concepto.impuestos) {
          // Calcular monto del impuesto sobre el subtotal (sin IVA)
          const montoImpuesto = subtotal * parseFloat(impuesto.tasa);

          await new sql.Request(transaction)
            .input('ConceptoId', sql.Int, conceptoId)
            .input('Tipo', sql.NVarChar(50), impuesto.tipo)
            .input('Tasa', sql.Decimal(5, 4), impuesto.tasa)
            .input('Monto', sql.Decimal(18, 2), montoImpuesto)
            .query(`
              INSERT INTO ImpuestosConcepto (ConceptoId, Tipo, Tasa, Monto)
              VALUES (@ConceptoId, @Tipo, @Tasa, @Monto)
            `);
        }
      }
    }

    await transaction.commit();

    // Verificar si la fecha de emisión es la misma que la fecha actual
    const fechaActual = new Date().toISOString().split('T')[0];
    const fechaEmisionFactura = new Date(fechaEmision).toISOString().split('T')[0];
    const esMismaFecha = fechaEmisionFactura === fechaActual;

    // Timbrar y enviar factura automáticamente SOLO si la fecha de emisión es HOY
    let resultadoTimbrado = null;
    if (esMismaFecha) {
      try {
        const responseTimbrado = await fetch('/api/facturas/timbrar', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ facturaId })
        });

        if (responseTimbrado.ok) {
          resultadoTimbrado = await responseTimbrado.json();
        }
      } catch (errorTimbrado) {
        // Si falla el timbrado, continuar sin error (la factura ya está guardada)
        console.error('Error al timbrar factura automáticamente:', errorTimbrado);
      }
    }

    return json({
      success: true,
      message: esMismaFecha
        ? 'Factura creada exitosamente con conceptos e impuestos'
        : 'Factura creada exitosamente. El timbrado automático solo se realiza para facturas con fecha de emisión actual.',
      facturaId: facturaId,
      timbrado: esMismaFecha
        ? (resultadoTimbrado || { success: false, message: 'No se pudo timbrar automáticamente' })
        : { success: false, message: 'No se timbró automáticamente porque la fecha de emisión es diferente a la fecha actual' }
    }, { status: 201 });

  } catch (error) {
    if (transaction) {
      try {
        await transaction.rollback();
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
  }
};