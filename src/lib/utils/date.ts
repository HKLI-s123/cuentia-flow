/**
 * Returns today's date as YYYY-MM-DD in the local timezone.
 * Replaces `new Date().toISOString().split('T')[0]` which returns UTC date
 * and can show tomorrow in timezones behind UTC (e.g. Mexico after 6pm).
 */
export function hoyLocal(): string {
	const d = new Date();
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
