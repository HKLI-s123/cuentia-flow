import { getConnection } from './db';

export interface AuditLogEntry {
	userId: number;
	organizacionId: number;
	action: 'DELETE_ORGANIZATION' | 'DELETE_CERTIFICATE' | 'UPLOAD_CERTIFICATE' | 'UPDATE_ORGANIZATION' | 'CREATE_ORGANIZATION';
	details: string;
	ipAddress?: string;
	timestamp?: Date;
}

/**
 * Registra un evento en el log de auditoría
 * Esta función es crítica para cumplimiento normativo y detección de anomalías
 */
export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
	try {
		const pool = await getConnection();

		// La tabla audit_log ya debe existir en el esquema PostgreSQL

		// Insertar registro de auditoría
		await pool.query(
			`INSERT INTO audit_log (usuario_id, organizacion_id, action, details, ip_address, timestamp)
			 VALUES ($1, $2, $3, $4, $5, $6)`,
			[entry.userId, entry.organizacionId, entry.action, entry.details, entry.ipAddress || null, entry.timestamp || new Date()]
		);

	} catch (error) {
		// No fallar la operación si el audit logging falla, pero sí loguear el error
		console.error('[AUDIT] Error al registrar evento de auditoría:', error);
	}
}

/**
 * Obtiene los logs de auditoría filtrados por organización
 * Útil para reportes de cumplimiento e investigaciones de seguridad
 */
export async function getAuditLogs(organizacionId: number, limit = 100, offset = 0) {
	try {
		const pool = await getConnection();

		const result = await pool.query(
			`SELECT id, usuario_id, organizacion_id, action, details, ip_address, timestamp
			 FROM audit_log
			 WHERE organizacion_id = $1
			 ORDER BY timestamp DESC
			 LIMIT $2 OFFSET $3`,
			[organizacionId, limit, offset]
		);

		return result.rows;
	} catch (error) {
		console.error('[AUDIT] Error al obtener logs de auditoría:', error);
		return [];
	}
}
