// Función para obtener datos del usuario desde el token/sesión
export function obtenerDatosUsuario() {
    if (typeof window === 'undefined') return null;

    try {
        const userData = sessionStorage.getItem('userData');
        if (userData) {
            return JSON.parse(userData);
        }
        return null;
    } catch (error) {
        return null;
    }
}

// Función helper para obtener SOLO el organizacionId actual (más rápida y directa)
export function obtenerOrganizacionIdActual(): number | null {
    if (typeof window === 'undefined') return null;

    try {
        const userData = sessionStorage.getItem('userData');
        if (userData) {
            const user = JSON.parse(userData);
            return user.organizacionId || null;
        }
        return null;
    } catch (error) {
        return null;
    }
}

// Función para obtener organizacionId del usuario desde la BD
export async function obtenerOrganizacionId(): Promise<number> {
    const userData = obtenerDatosUsuario();

    if (!userData?.id) {
        throw new Error('No se encontró ID del usuario. Por favor vuelve a iniciar sesión.');
    }

    // Si ya tenemos organizacionId en cache, usarlo
    if (userData.organizacionId) {
        return userData.organizacionId;
    }

    // Obtener organizacionId desde la base de datos
    try {
        const { authFetch } = await import('$lib/api');
        const response = await authFetch(`/api/usuario/${userData.id}/organizacion`);
        if (!response.ok) {
            throw new Error('Error al obtener organización del usuario');
        }

        const data = await response.json();

        // Guardar en cache para próximas llamadas
        userData.organizacionId = data.organizacionId;
        if (typeof window !== 'undefined') {
            sessionStorage.setItem('userData', JSON.stringify(userData));
        }

        return data.organizacionId;
    } catch (error) {
        throw new Error('No se pudo obtener la organización del usuario');
    }
}

// Función para obtener organizacionId desde API (más confiable)
export async function obtenerOrganizacionIdFromAPI(): Promise<number> {
    const userData = obtenerDatosUsuario();
    if (!userData?.id) {
        throw new Error('No se encontró información del usuario');
    }

    try {
        const { authFetch } = await import('$lib/api');
        const response = await authFetch(`/api/usuario/${userData.id}/organizacion`);
        if (response.ok) {
            const data = await response.json();
            return data.organizacionId;
        } else {
            throw new Error('Error al obtener organización del usuario');
        }
    } catch (error) {
        throw error;
    }
}

// Función para guardar datos del usuario después del login
export function guardarDatosUsuario(userData: any) {
    if (typeof window === 'undefined') return;

    try {
        sessionStorage.setItem('userData', JSON.stringify(userData));
    } catch (error) {
    }
}

// Función para limpiar datos del usuario
export function limpiarDatosUsuario() {
    if (typeof window === 'undefined') return;

    try {
        sessionStorage.removeItem('userData');
        sessionStorage.removeItem('jwt');
        sessionStorage.removeItem('organizacionActualId');
    } catch (error) {
    }
}

// Función para hacer login con el endpoint local
export async function loginExterno(correo: string, contrasena: string) {
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ correo, contrasena })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Error en el login');
        }

        // Guardar token y datos básicos
        if (typeof window !== 'undefined') {
            sessionStorage.setItem('jwt', data.token);
            sessionStorage.setItem('userData', JSON.stringify(data.usuario));
        }

        // Obtener información completa del usuario (organización)
        try {
            const { authFetch } = await import('$lib/api');
            const orgResponse = await authFetch(`/api/usuario/${data.usuario.id}/organizacion`);
            if (orgResponse.ok) {
                const orgData = await orgResponse.json();

                const completeUserData = {
                    ...data.usuario,
                    organizacionId: orgData.organizacionId,
                    organizacionNombre: orgData.organizacionNombre,
                    rolId: orgData.rolId,
                    rolNombre: orgData.rolNombre
                };

                // Actualizar sessionStorage con la información completa
                if (typeof window !== 'undefined') {
                    sessionStorage.setItem('userData', JSON.stringify(completeUserData));
                    // Establecer organizacionActualId para que coincida con organizacionId
                    sessionStorage.setItem('organizacionActualId', orgData.organizacionId.toString());
                }

                return completeUserData;
            }
        } catch (orgError) {
        }

        return data.usuario;
    } catch (error) {
        throw error;
    }
}

// Función para verificar si el usuario está autenticado
export function estaAutenticado(): boolean {
    if (typeof window === 'undefined') return false;

    const token = sessionStorage.getItem('jwt');
    const userData = sessionStorage.getItem('userData');

    return !!(token && userData);
}