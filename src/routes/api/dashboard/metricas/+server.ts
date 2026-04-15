import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getConnection } from '$lib/server/db';
import { requireOrganizationAccess, getOrganizationIdFromHeader } from '$lib/server/auth';

export const GET: RequestHandler = async (event) => {
	try {
		// Obtener organizacionId del header X-Organization-Id o del query param (backwards compatibility)
		const orgIdFromHeader = getOrganizationIdFromHeader(event);
		const orgIdFromQuery = event.url.searchParams.get('organizacionId');
		const organizacionId = orgIdFromHeader || orgIdFromQuery;

		// Validar autenticación y acceso a la organización
		const authResult = await requireOrganizationAccess(event, organizacionId);

		// Si authResult es una Response, significa que hubo un error de autorización
		if (authResult instanceof Response) {
			return authResult;
		}

		// Destructurar el usuario y organizacionId validados
		const { user, organizacionId: validatedOrgId } = authResult;

		const pool = await getConnection();
		const hoy = new Date();

		// 1. Total Por cobrar: Suma de SaldoPendiente donde SaldoPendiente > 0
		const totalPorCobrarQuery = `
			SELECT
				SUM(SaldoPendiente) as TotalPorCobrar,
				COUNT(*) as CantidadFacturas
			FROM Facturas
			WHERE ClienteId IN (
				SELECT Id FROM Clientes WHERE OrganizacionId = $1
			)
			AND SaldoPendiente > 0
			AND estado_factura_id <> 6
		`;
		const totalPorCobrar = await pool.query(totalPorCobrarQuery, [validatedOrgId]);

		// 2. Saldo Vencido: Suma de SaldoPendiente donde FechaVencimiento < HOY y SaldoPendiente > 0
		const saldoVencidoQuery = `
			SELECT
				SUM(SaldoPendiente) as SaldoVencido,
				COUNT(*) as CantidadVencidas
			FROM Facturas
			WHERE ClienteId IN (
				SELECT Id FROM Clientes WHERE OrganizacionId = $1
			)
			AND SaldoPendiente > 0
			AND FechaVencimiento < $2
			AND estado_factura_id <> 6
		`;
		const saldoVencido = await pool.query(saldoVencidoQuery, [validatedOrgId, hoy]);

		// 3. Total Facturado (Ventas): Suma de MontoTotal de todas las facturas
		const totalFacturadoQuery = `
			SELECT
				SUM(MontoTotal) as TotalFacturado,
				COUNT(*) as CantidadFacturas
			FROM Facturas
			WHERE ClienteId IN (
				SELECT Id FROM Clientes WHERE OrganizacionId = $1
			)
			AND estado_factura_id <> 6
		`;
		const totalFacturado = await pool.query(totalFacturadoQuery, [validatedOrgId]);

		// 4. Total Cobrado: Suma de pagos + facturas PUE timbradas
		const totalCobradoQuery = `
			SELECT
				COALESCE(pagos.TotalPagos, 0) + COALESCE(pue.TotalPUE, 0) as TotalCobrado,
				COALESCE(pagos.CantidadPagos, 0) as CantidadPagos,
				COALESCE(pagos.CantidadFacturasConPago, 0) + COALESCE(pue.CantidadPUE, 0) as CantidadFacturasConPago
			FROM (
				SELECT
					SUM(p.monto) as TotalPagos,
					COUNT(DISTINCT p.id) as CantidadPagos,
					COUNT(DISTINCT p.facturaid) as CantidadFacturasConPago
				FROM Pagos p
				INNER JOIN Facturas f ON p.facturaid = f.id
				WHERE f.clienteid IN (
					SELECT Id FROM Clientes WHERE OrganizacionId = $1
				)
				AND f.estado_factura_id <> 6
			) pagos,
			(
				SELECT
					SUM(f.montototal) as TotalPUE,
					COUNT(*) as CantidadPUE
				FROM Facturas f
				WHERE f.clienteid IN (
					SELECT Id FROM Clientes WHERE OrganizacionId = $1
				)
				AND f.metodopago = 'PUE'
				AND f.timbrado = true
				AND f.estado_factura_id <> 6
			) pue
		`;
		const totalCobrado = await pool.query(totalCobradoQuery, [validatedOrgId]);

		// 5. Aging: Distribución por antigüedad de saldo vencido (0-30, 31-60, 61-90, +90 días)
		const agingQuery = `
			SELECT
				CASE
					WHEN FechaVencimiento >= $2 THEN 'vigente'
					WHEN ($2::date - FechaVencimiento::date) BETWEEN 1 AND 30 THEN '0-30'
					WHEN ($2::date - FechaVencimiento::date) BETWEEN 31 AND 60 THEN '31-60'
					WHEN ($2::date - FechaVencimiento::date) BETWEEN 61 AND 90 THEN '61-90'
					WHEN ($2::date - FechaVencimiento::date) > 90 THEN '+90'
				END as Rango,
				COUNT(*) as Cantidad,
				SUM(SaldoPendiente) as Monto
			FROM Facturas
			WHERE ClienteId IN (
				SELECT Id FROM Clientes WHERE OrganizacionId = $1
			)
			AND SaldoPendiente > 0
			AND estado_factura_id <> 6
			GROUP BY
				CASE
					WHEN FechaVencimiento >= $2 THEN 'vigente'
					WHEN ($2::date - FechaVencimiento::date) BETWEEN 1 AND 30 THEN '0-30'
					WHEN ($2::date - FechaVencimiento::date) BETWEEN 31 AND 60 THEN '31-60'
					WHEN ($2::date - FechaVencimiento::date) BETWEEN 61 AND 90 THEN '61-90'
					WHEN ($2::date - FechaVencimiento::date) > 90 THEN '+90'
				END
		`;
		const aging = await pool.query(agingQuery, [validatedOrgId, hoy]);

		// Organizar aging por rangos
		const agingData: any = {
			vigente: { cantidad: 0, monto: 0 },
			dias0_30: { cantidad: 0, monto: 0 },
			dias31_60: { cantidad: 0, monto: 0 },
			dias61_90: { cantidad: 0, monto: 0 },
			mas90: { cantidad: 0, monto: 0 }
		};

		aging.rows.forEach((row: any) => {
			const cantidad = parseInt(row.cantidad) || 0;
			const monto = parseFloat(row.monto) || 0;
			switch (row.rango) {
				case 'vigente':
					agingData.vigente = { cantidad, monto };
					break;
				case '0-30':
					agingData.dias0_30 = { cantidad, monto };
					break;
				case '31-60':
					agingData.dias31_60 = { cantidad, monto };
					break;
				case '61-90':
					agingData.dias61_90 = { cantidad, monto };
					break;
				case '+90':
					agingData.mas90 = { cantidad, monto };
					break;
			}
		});

		// Calcular eficiencia de cobranza (% de lo facturado que se ha cobrado)
		const totalFacturadoValor = parseFloat(totalFacturado.rows[0].totalfacturado) || 0;
		const totalCobradoValor = parseFloat(totalCobrado.rows[0].totalcobrado) || 0;
		const eficienciaCobranza = totalFacturadoValor > 0
			? (totalCobradoValor / totalFacturadoValor) * 100
			: 0;

		// 6. Datos para gráfico de ventas (últimos 4 meses)
		const ventasPorMesQuery = `
			SELECT
				EXTRACT(YEAR FROM FechaEmision) as Anio,
				EXTRACT(MONTH FROM FechaEmision) as Mes,
				SUM(MontoTotal) as TotalVentas,
				COUNT(*) as CantidadFacturas
			FROM Facturas
			WHERE ClienteId IN (
				SELECT Id FROM Clientes WHERE OrganizacionId = $1
			)
			AND FechaEmision >= $2::timestamp - INTERVAL '3 months'
			AND estado_factura_id <> 6
			GROUP BY EXTRACT(YEAR FROM FechaEmision), EXTRACT(MONTH FROM FechaEmision)
			ORDER BY EXTRACT(YEAR FROM FechaEmision), EXTRACT(MONTH FROM FechaEmision)
		`;
		const ventasPorMes = await pool.query(ventasPorMesQuery, [validatedOrgId, hoy]);

		// 7. Datos para gráfico de resumen de cobranza (por periodo)
		const periodo = event.url.searchParams.get('periodo') || 'Semana';
		let resumenCobranzaQuery = '';

		if (periodo === 'Mes') {
			resumenCobranzaQuery = `
				SELECT
					TO_CHAR(DATE_TRUNC('month', FechaEmision), 'Mon YYYY') as Periodo,
					EXTRACT(YEAR FROM FechaEmision) as Anio,
					EXTRACT(MONTH FROM FechaEmision) as Mes,
					SUM(CASE WHEN SaldoPendiente > 0 AND FechaVencimiento >= $2 THEN SaldoPendiente ELSE 0 END) as Vigente,
					SUM(CASE WHEN SaldoPendiente > 0 AND FechaVencimiento < $2 THEN SaldoPendiente ELSE 0 END) as Vencido,
					SUM(CASE WHEN SaldoPendiente = 0 THEN MontoTotal ELSE 0 END) as Pagado
				FROM Facturas
				WHERE ClienteId IN (
					SELECT Id FROM Clientes WHERE OrganizacionId = $1
				)
				AND FechaEmision >= $2::timestamp - INTERVAL '6 months'
				AND estado_factura_id <> 6
				GROUP BY EXTRACT(YEAR FROM FechaEmision), EXTRACT(MONTH FROM FechaEmision),
					TO_CHAR(DATE_TRUNC('month', FechaEmision), 'Mon YYYY')
				ORDER BY EXTRACT(YEAR FROM FechaEmision), EXTRACT(MONTH FROM FechaEmision)
			`;
		} else if (periodo === 'Trimestre') {
			resumenCobranzaQuery = `
				SELECT
					'Q' || EXTRACT(QUARTER FROM FechaEmision)::text || ' ' || EXTRACT(YEAR FROM FechaEmision)::text as Periodo,
					EXTRACT(YEAR FROM FechaEmision) as Anio,
					EXTRACT(QUARTER FROM FechaEmision) as Trimestre,
					SUM(CASE WHEN SaldoPendiente > 0 AND FechaVencimiento >= $2 THEN SaldoPendiente ELSE 0 END) as Vigente,
					SUM(CASE WHEN SaldoPendiente > 0 AND FechaVencimiento < $2 THEN SaldoPendiente ELSE 0 END) as Vencido,
					SUM(CASE WHEN SaldoPendiente = 0 THEN MontoTotal ELSE 0 END) as Pagado
				FROM Facturas
				WHERE ClienteId IN (
					SELECT Id FROM Clientes WHERE OrganizacionId = $1
				)
				AND FechaEmision >= $2::timestamp - INTERVAL '12 months'
				AND estado_factura_id <> 6
				GROUP BY EXTRACT(YEAR FROM FechaEmision), EXTRACT(QUARTER FROM FechaEmision)
				ORDER BY EXTRACT(YEAR FROM FechaEmision), EXTRACT(QUARTER FROM FechaEmision)
			`;
		} else {
			resumenCobranzaQuery = `
				SELECT
					EXTRACT(WEEK FROM FechaEmision) as Semana,
					SUM(CASE WHEN SaldoPendiente > 0 AND FechaVencimiento >= $2 THEN SaldoPendiente ELSE 0 END) as Vigente,
					SUM(CASE WHEN SaldoPendiente > 0 AND FechaVencimiento < $2 THEN SaldoPendiente ELSE 0 END) as Vencido,
					SUM(CASE WHEN SaldoPendiente = 0 THEN MontoTotal ELSE 0 END) as Pagado
				FROM Facturas
				WHERE ClienteId IN (
					SELECT Id FROM Clientes WHERE OrganizacionId = $1
				)
				AND FechaEmision >= $2::timestamp - INTERVAL '4 weeks'
				AND estado_factura_id <> 6
				GROUP BY EXTRACT(WEEK FROM FechaEmision)
				ORDER BY EXTRACT(WEEK FROM FechaEmision)
			`;
		}
		const resumenCobranza = await pool.query(resumenCobranzaQuery, [validatedOrgId, hoy]);

		// 8. Top Saldo Vencido por Cliente
		const topSaldoVencidoQuery = `
			SELECT
				c.id as ClienteId,
				c.razonsocial as ClienteNombre,
				SUM(f.saldopendiente) as TotalSaldoVencido,
				COUNT(*) as CantidadFacturas
			FROM Facturas f
			INNER JOIN Clientes c ON f.clienteid = c.id
			WHERE c.organizacionid = $1
			AND f.saldopendiente > 0
			AND f.fechavencimiento < $2
			AND f.estado_factura_id <> 6
			GROUP BY c.id, c.razonsocial
			ORDER BY SUM(f.saldopendiente) DESC
			LIMIT 10
		`;
		const topSaldoVencido = await pool.query(topSaldoVencidoQuery, [validatedOrgId, hoy]);

		// 9. WhatsApp / IA usage
		const whatsappUsageQuery = `
			SELECT
				(SELECT COUNT(*) FROM Facturas f
				 INNER JOIN Clientes c ON f.clienteid = c.id
				 WHERE c.organizacionid = $1
				   AND COALESCE(f.agenteiaactivo, false) = true
				   AND f.estado_factura_id NOT IN (3, 6)) as facturasConIA,
				COALESCE((SELECT EnvioAutomaticoRecordatorios
				 FROM ConfiguracionCobranza
				 WHERE OrganizacionId = $1
				 LIMIT 1), false) as recordatoriosAuto
		`;
		const whatsappUsage = await pool.query(whatsappUsageQuery, [validatedOrgId]);
		const usaWhatsApp = (whatsappUsage.rows[0]?.facturasconias ?? 0) > 0
			|| whatsappUsage.rows[0]?.recordatoriosauto === true;

		return json({
			success: true,
			metricas: {
				totalPorCobrar: parseFloat(totalPorCobrar.rows[0].totalporcobrar) || 0,
				cantidadFacturasPendientes: parseInt(totalPorCobrar.rows[0].cantidadfacturas) || 0,

				saldoVencido: parseFloat(saldoVencido.rows[0].saldovencido) || 0,
				cantidadFacturasVencidas: parseInt(saldoVencido.rows[0].cantidadvencidas) || 0,

				totalFacturado: totalFacturadoValor,
				cantidadFacturasEmitidas: parseInt(totalFacturado.rows[0].cantidadfacturas) || 0,

				totalCobrado: totalCobradoValor,
				cantidadPagos: parseInt(totalCobrado.rows[0].cantidadpagos) || 0,
				cantidadFacturasConPago: parseInt(totalCobrado.rows[0].cantidadfacturasconpago) || 0,

				eficienciaCobranza: Math.round(eficienciaCobranza * 100) / 100,

				aging: agingData,

				ventasPorMes: ventasPorMes.rows,
				resumenCobranza: resumenCobranza.rows,
				topSaldoVencido: topSaldoVencido.rows,
				usaWhatsApp
			}
		});

	} catch (err) {
		console.error('Error al obtener métricas del dashboard:', err);
		return json({
			success: false,
			error: 'Error en el servidor',
			details: err instanceof Error ? err.message : 'Error desconocido'
		}, { status: 500 });
	}
};
