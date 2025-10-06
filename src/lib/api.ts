// Helper para hacer fetch con autenticación automática
export async function authFetch(url: string, options: RequestInit = {}) {
	// Obtener token del sessionStorage
	const token = typeof window !== 'undefined' ? sessionStorage.getItem('jwt') : null;

	// Agregar headers de autenticación
	const headers = new Headers(options.headers || {});

	if (token) {
		headers.set('Authorization', `Bearer ${token}`);
	}

	if (!headers.has('Content-Type') && options.method !== 'GET') {
		headers.set('Content-Type', 'application/json');
	}

	// Hacer el fetch
	const response = await fetch(url, {
		...options,
		headers
	});

	// Si es 401, redirigir al login
	if (response.status === 401) {
		if (typeof window !== 'undefined') {
			sessionStorage.clear();
			window.location.href = '/';
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
