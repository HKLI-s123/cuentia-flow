/**
 * Módulo de API con autenticación automática
 * Usa cookies HttpOnly (credentials: include) y CSRF tokens
 */
import { get } from 'svelte/store';
import { organizacionStore } from '$lib/stores/organizacion';

// Helper para leer una cookie por nombre
function getCookie(name: string): string | null {
	if (typeof document === 'undefined') return null;
	const prefix = name + '=';
	const cookies = document.cookie.split(';');
	for (let cookie of cookies) {
		cookie = cookie.trim();
		if (cookie.startsWith(prefix)) {
			return cookie.substring(prefix.length);
		}
	}
	return null;
}

// Helper para hacer fetch con autenticación automática
export async function authFetch(url: string, options: RequestInit = {}) {
	// Obtener organizacionId para multi-tenant desde el store
	let organizacionId: string | null = null;
	if (typeof window !== 'undefined') {
		const org = get(organizacionStore);
		if (org.id) {
			organizacionId = org.id.toString();
		}
	}

	// Agregar headers
	const headers = new Headers(options.headers || {});

	// Agregar header de organización para multi-tenant
	if (organizacionId) {
		headers.set('X-Organization-Id', organizacionId);
	}

	// Agregar CSRF token para métodos que modifican datos
	if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(options.method?.toUpperCase() || 'GET')) {
		const csrfToken = getCookie('csrf_token');
		if (csrfToken) {
			headers.set('X-CSRF-Token', csrfToken);
		}
	}

	// Content-Type automático (excepto para FormData)
	const isFormData = options.body instanceof FormData;
	if (!headers.has('Content-Type') && options.method !== 'GET' && !isFormData) {
		headers.set('Content-Type', 'application/json');
	}

	// Hacer el fetch con credentials: include para enviar cookies
	const response = await fetch(url, {
		...options,
		headers,
		credentials: 'include'
	});

	// Si es 401, redirigir al login
	if (response.status === 401) {
		if (typeof window !== 'undefined') {
			window.location.href = '/login';
		}
	}

	return response;
}

// Helper para GET con autenticación
export async function authGet(url: string) {
	const response = await authFetch(url, { method: 'GET' });
	return response.json();
}

// Helper para POST con autenticación
export async function authPost(url: string, data: any) {
	const response = await authFetch(url, {
		method: 'POST',
		body: JSON.stringify(data)
	});
	return response.json();
}

// Helper para PUT con autenticación
export async function authPut(url: string, data: any) {
	const response = await authFetch(url, {
		method: 'PUT',
		body: JSON.stringify(data)
	});
	return response.json();
}

// Helper para DELETE con autenticación
export async function authDelete(url: string) {
	const response = await authFetch(url, { method: 'DELETE' });
	return response.json();
}
