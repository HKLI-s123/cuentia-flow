import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getConnection } from '$lib/server/db';
import { requireOrganizationAccess, getOrganizationIdFromHeader } from '$lib/server/auth';
import sql from 'mssql';

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

		// 1. Total Por Cobrar: Suma de SaldoPendiente donde SaldoPendiente > 0
		const totalPorCobrarQuery = `
			SELECT
				SUM(SaldoPendiente) as TotalPorCobrar,
				COUNT(*) as CantidadFacturas
			FROM Facturas
			WHERE ClienteId IN (
				SELECT Id FROM Clientes WHERE OrganizacionId = @OrganizacionId
			)
			AND SaldoPendiente > 0
		`;

		const totalPorCobrar = await pool
			.request()
			.input('OrganizacionId', sql.Int, validatedOrgId)
			.query(totalPorCobrarQuery);

		// 2. Saldo Vencido: Suma de SaldoPendiente donde FechaVencimiento < HOY y SaldoPendiente > 0
		const saldoVencidoQuery = `
			SELECT
				SUM(SaldoPendiente) as SaldoVencido,
				COUNT(*) as CantidadVencidas
			FROM Facturas
			WHERE ClienteId IN (
				SELECT Id FROM Clientes WHERE OrganizacionId = @OrganizacionId
			)
			AND SaldoPendiente > 0
			AND FechaVencimiento < @Hoy
		`;

		const saldoVencido = await pool
			.request()
			.input('OrganizacionId', sql.Int, validatedOrgId)
			.input('Hoy', sql.DateTime, hoy)
			.query(saldoVencidoQuery);

		// 3. Total Facturado (Ventas): Suma de MontoTotal de todas las facturas
		const totalFacturadoQuery = `
			SELECT
				SUM(MontoTotal) as TotalFacturado,
				COUNT(*) as CantidadFacturas
			FROM Facturas
			WHERE ClienteId IN (
				SELECT Id FROM Clientes WHERE OrganizacionId = @OrganizacionId
			)
		`;

		const totalFacturado = await pool
			.request()
			.input('OrganizacionId', sql.Int, validatedOrgId)
			.query(totalFacturadoQuery);

		// 4. Total Cobrado: Suma de Monto de la tabla Pagos (dinero real que ingresó)
		const totalCobradoQuery = `
			SELECT
				SUM(p.Monto) as TotalCobrado,
				COUNT(DISTINCT p.Id) as CantidadPagos,
				COUNT(DISTINCT p.FacturaId) as CantidadFacturasConPago
			FROM Pagos p
			INNER JOIN Facturas f ON p.FacturaId = f.Id
			WHERE f.ClienteId IN (
				SELECT Id FROM Clientes WHERE OrganizacionId = @OrganizacionId
			)
		`;

		const totalCobrado = await pool
			.request()
			.input('OrganizacionId', sql.Int, validatedOrgId)
			.query(totalCobradoQuery);

		// 5. Aging: Distribución por antigüedad de saldo vencido (0-30, 31-60, 61-90, +90 días)
		const agingQuery = `
			SELECT
				CASE
					WHEN FechaVencimiento >= @Hoy THEN 'vigente'
					WHEN DATEDIFF(day, FechaVencimiento, @Hoy) BETWEEN 1 AND 30 THEN '0-30'
					WHEN DATEDIFF(day, FechaVencimiento, @Hoy) BETWEEN 31 AND 60 THEN '31-60'
					WHEN DATEDIFF(day, FechaVencimiento, @Hoy) BETWEEN 61 AND 90 THEN '61-90'
					WHEN DATEDIFF(day, FechaVencimiento, @Hoy) > 90 THEN '+90'
				END as Rango,
				COUNT(*) as Cantidad,
				SUM(SaldoPendiente) as Monto
			FROM Facturas
			WHERE ClienteId IN (
				SELECT Id FROM Clientes WHERE OrganizacionId = @OrganizacionId
			)
			AND SaldoPendiente > 0
			GROUP BY
				CASE
					WHEN FechaVencimiento >= @Hoy THEN 'vigente'
					WHEN DATEDIFF(day, FechaVencimiento, @Hoy) BETWEEN 1 AND 30 THEN '0-30'
					WHEN DATEDIFF(day, FechaVencimiento, @Hoy) BETWEEN 31 AND 60 THEN '31-60'
					WHEN DATEDIFF(day, FechaVencimiento, @Hoy) BETWEEN 61 AND 90 THEN '61-90'
					WHEN DATEDIFF(day, FechaVencimiento, @Hoy) > 90 THEN '+90'
				END
		`;

		const aging = await pool
			.request()
			.input('OrganizacionId', sql.Int, validatedOrgId)
			.input('Hoy', sql.DateTime, hoy)
			.query(agingQuery);

		// Organizar aging por rangos
		const agingData: any = {
			vigente: { cantidad: 0, monto: 0 },
			dias0_30: { cantidad: 0, monto: 0 },
			dias31_60: { cantidad: 0, monto: 0 },
			dias61_90: { cantidad: 0, monto: 0 },
			mas90: { cantidad: 0, monto: 0 }
		};

		aging.recordset.forEach((row: any) => {
			switch (row.Rango) {
				case 'vigente':
					agingData.vigente = { cantidad: row.Cantidad, monto: row.Monto || 0 };
					break;
				case '0-30':
					agingData.dias0_30 = { cantidad: row.Cantidad, monto: row.Monto || 0 };
					break;
				case '31-60':
					agingData.dias31_60 = { cantidad: row.Cantidad, monto: row.Monto || 0 };
					break;
				case '61-90':
					agingData.dias61_90 = { cantidad: row.Cantidad, monto: row.Monto || 0 };
					break;
				case '+90':
					agingData.mas90 = { cantidad: row.Cantidad, monto: row.Monto || 0 };
					break;
			}
		});

		// Calcular eficiencia de cobranza (% de lo facturado que se ha cobrado)
		const totalFacturadoValor = totalFacturado.recordset[0].TotalFacturado || 0;
		const totalCobradoValor = totalCobrado.recordset[0].TotalCobrado || 0;
		const eficienciaCobranza = totalFacturadoValor > 0
			? (totalCobradoValor / totalFacturadoValor) * 100
			: 0;

		// 6. Datos para gráfico de ventas (últimos 4 meses)
		const ventasPorMesQuery = `
			SELECT
				YEAR(FechaEmision) as Anio,
				MONTH(FechaEmision) as Mes,
				SUM(MontoTotal) as TotalVentas,
				COUNT(*) as CantidadFacturas
			FROM Facturas
			WHERE ClienteId IN (
				SELECT Id FROM Clientes WHERE OrganizacionId = @OrganizacionId
			)
			AND FechaEmision >= DATEADD(MONTH, -3, @Hoy)
			GROUP BY YEAR(FechaEmision), MONTH(FechaEmision)
			ORDER BY YEAR(FechaEmision), MONTH(FechaEmision)
		`;

		const ventasPorMes = await pool
			.request()
			.input('OrganizacionId', sql.Int, validatedOrgId)
			.input('Hoy', sql.DateTime, hoy)
			.query(ventasPorMesQuery);

		// 7. Datos para gráfico de resumen de cobranza (últimas 4 semanas)
		const resumenCobranzaQuery = `
			SELECT
				DATEPART(WEEK, FechaEmision) as Semana,
				SUM(CASE WHEN SaldoPendiente > 0 AND FechaVencimiento >= @Hoy THEN SaldoPendiente ELSE 0 END) as Vigente,
				SUM(CASE WHEN SaldoPendiente > 0 AND FechaVencimiento < @Hoy THEN SaldoPendiente ELSE 0 END) as Vencido,
				SUM(CASE WHEN SaldoPendiente = 0 THEN MontoTotal ELSE 0 END) as Pagado
			FROM Facturas
			WHERE ClienteId IN (
				SELECT Id FROM Clientes WHERE OrganizacionId = @OrganizacionId
			)
			AND FechaEmision >= DATEADD(WEEK, -4, @Hoy)
			GROUP BY DATEPART(WEEK, FechaEmision)
			ORDER BY DATEPART(WEEK, FechaEmision)
		`;

		const resumenCobranza = await pool
			.request()
			.input('OrganizacionId', sql.Int, validatedOrgId)
			.input('Hoy', sql.DateTime, hoy)
			.query(resumenCobranzaQuery);

		// 8. Top Saldo Vencido por Cliente
		const topSaldoVencidoQuery = `
			SELECT TOP 10
				c.Id as ClienteId,
				c.RazonSocial as ClienteNombre,
				SUM(f.SaldoPendiente) as TotalSaldoVencido,
				COUNT(*) as CantidadFacturas
			FROM Facturas f
			INNER JOIN Clientes c ON f.ClienteId = c.Id
			WHERE c.OrganizacionId = @OrganizacionId
			AND f.SaldoPendiente > 0
			AND f.FechaVencimiento < @Hoy
			GROUP BY c.Id, c.RazonSocial
			ORDER BY SUM(f.SaldoPendiente) DESC
		`;

		const topSaldoVencido = await pool
			.request()
			.input('OrganizacionId', sql.Int, validatedOrgId)
			.input('Hoy', sql.DateTime, hoy)
			.query(topSaldoVencidoQuery);

		return json({
			success: true,
			metricas: {
				totalPorCobrar: totalPorCobrar.recordset[0].TotalPorCobrar || 0,
				cantidadFacturasPendientes: totalPorCobrar.recordset[0].CantidadFacturas || 0,

				saldoVencido: saldoVencido.recordset[0].SaldoVencido || 0,
				cantidadFacturasVencidas: saldoVencido.recordset[0].CantidadVencidas || 0,

				totalFacturado: totalFacturadoValor,
				cantidadFacturasEmitidas: totalFacturado.recordset[0].CantidadFacturas || 0,

				totalCobrado: totalCobradoValor,
				cantidadPagos: totalCobrado.recordset[0].CantidadPagos || 0,
				cantidadFacturasConPago: totalCobrado.recordset[0].CantidadFacturasConPago || 0,

				eficienciaCobranza: Math.round(eficienciaCobranza * 100) / 100,

				aging: agingData,

				ventasPorMes: ventasPorMes.recordset,
				resumenCobranza: resumenCobranza.recordset,
				topSaldoVencido: topSaldoVencido.recordset
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
