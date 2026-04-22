/**
 * Returns today's date as YYYY-MM-DD in the local timezone.
 * Replaces `new Date().toISOString().split('T')[0]` which returns UTC date
 * and can show tomorrow in timezones behind UTC (e.g. Mexico after 6pm).
 */
const APP_TIME_ZONE = 'America/Mexico_City';

function formatDateParts(date: Date): string {
	const formatter = new Intl.DateTimeFormat('en-CA', {
		timeZone: APP_TIME_ZONE,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	});

	const parts = formatter.formatToParts(date);
	const year = parts.find((part) => part.type === 'year')?.value;
	const month = parts.find((part) => part.type === 'month')?.value;
	const day = parts.find((part) => part.type === 'day')?.value;

	if (!year || !month || !day) {
		throw new Error('No se pudo formatear la fecha local');
	}

	return `${year}-${month}-${day}`;
}

export function hoyLocal(): string {
	return formatDateParts(new Date());
}

/**
 * Formats a Date object or date string as YYYY-MM-DD in local timezone.
 * If the input is already a YYYY-MM-DD string, returns it directly to avoid
 * the UTC parsing pitfall (new Date("2026-04-09") is UTC midnight, which
 * shifts the date backward in western-hemisphere timezones).
 */
export function fechaLocal(date: Date | string): string {
	if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
		return date;
	}
	const d = typeof date === 'string' ? new Date(date) : date;
	return formatDateParts(d);
}
