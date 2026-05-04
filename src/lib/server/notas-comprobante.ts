export const LINK_COMPROBANTE_LABEL = 'Link para subir comprobante:';
export const MAX_NOTAS_CLIENTE_LENGTH = 1000;

/**
 * Combina las notas existentes de la factura con el link de comprobante.
 * Elimina cualquier link previo para evitar duplicados y respeta el límite de longitud.
 */
export function mergeNotasClienteConLink(
	notasActuales: string | null | undefined,
	link: string
): string {
	const normalizado = String(notasActuales || '').replace(/\r\n/g, '\n');
	const lineasSinLink = normalizado
		.split('\n')
		.filter((linea) => {
			const lower = linea.toLowerCase();
			return (
				!lower.includes('link para subir comprobante:') &&
				!linea.includes('/comprobante-factura/')
			);
		})
		.join('\n')
		.trim();

	const textoConLink = `${LINK_COMPROBANTE_LABEL} ${link}`;
	const combinado = lineasSinLink ? `${lineasSinLink}\n\n${textoConLink}` : textoConLink;

	// Si el combinado excede el límite, conservar sólo el link.
	if (combinado.length > MAX_NOTAS_CLIENTE_LENGTH) {
		return textoConLink;
	}

	return combinado;
}
