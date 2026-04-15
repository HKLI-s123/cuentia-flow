/**
 * Módulo de autenticación del cliente
 * Usa HttpOnly cookies para tokens (manejado por el servidor)
 * CSRF token en localStorage para protección contra CSRF
 */

// Obtener CSRF token del servidor y guardarlo en localStorage
export async function obtenerCSRFToken(): Promise<string | null> {
    if (typeof window === 'undefined') return null;

    try {
        const response = await fetch('/api/auth/csrf', {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok) {
            console.error('[AUTH] Error al obtener CSRF token:', response.status);
            return null;
        }

        const data = await response.json();

        if (data.csrf_token) {
            localStorage.setItem('csrf_token', data.csrf_token);
            return data.csrf_token;
        }

        return null;
    } catch (error) {
        console.error('[AUTH] Error al obtener CSRF token:', error);
        return null;
    }
}

// Obtener CSRF token desde localStorage
export function getCSRFToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('csrf_token');
}

// Obtener datos del usuario autenticado desde el servidor
export async function obtenerDatosUsuario(): Promise<any | null> {
    if (typeof window === 'undefined') return null;

    try {
        const response = await fetch('/api/auth/me', {
            method: 'GET',
            credentials: 'include'
        });

        if (response.ok) {
            return await response.json();
        }

        return null;
    } catch {
        return null;
    }
}

// Obtener organizacionId del usuario actual
export async function obtenerOrganizacionIdActual(): Promise<number | null> {
    return obtenerOrganizacionId();
}

export async function obtenerOrganizacionId(): Promise<number | null> {
    if (typeof window === 'undefined') return null;

    try {
        const user = await obtenerDatosUsuario();
        return user?.organizacion || null;
    } catch {
        return null;
    }
}

// Login con credenciales
export async function loginExterno(correo: string, contrasena: string, recaptchaToken?: string) {
    try {
        const csrfToken = getCSRFToken();

        if (!csrfToken) {
            throw new Error('CSRF token no disponible. Por favor recarga la página.');
        }

        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            credentials: 'include',
            body: JSON.stringify({ correo, contrasena, recaptchaToken })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Error en el login');
        }

        return { success: true, message: data.message, usuario: data.usuario };
    } catch (error) {
        console.error('[AUTH CLIENTE] Error en login:', error);
        throw error;
    }
}

// Verificar si el usuario está autenticado
export async function estaAutenticado(): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    try {
        return (await obtenerDatosUsuario()) != null;
    } catch {
        return false;
    }
}

// Cerrar sesión
export async function logout(): Promise<void> {
    try {
        await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include'
        });
    } catch (error) {
        console.error('Error al hacer logout:', error);
    }
}

// Registro de usuario
export async function registroExterno(
    correo: string,
    contrasena: string,
    nombre: string,
    apellido: string,
    numero_tel: string,
    recaptchaToken: string
) {
    try {
        const csrfToken = getCSRFToken();

        if (!csrfToken) {
            throw new Error('CSRF token no disponible. Por favor recarga la página.');
        }

        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            credentials: 'include',
            body: JSON.stringify({
                correo,
                contrasena,
                nombre,
                apellido,
                numero_tel: numero_tel || null,
                recaptchaToken
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Error al registrarse');
        }

        return {
            success: true,
            message: data.message,
            usuarioId: data.usuarioId,
            pendingVerification: data.pendingVerification
        };
    } catch (error) {
        throw error;
    }
}

// Login con Google OAuth
export async function loginConGoogle(): Promise<void> {
    try {
        window.location.href = '/api/auth/google/authorize';
    } catch (error) {
        console.error('[AUTH] Error al iniciar Google login:', error);
        throw error;
    }
}