/**
 * GUÍA RÁPIDA - Implementación Segura de Autenticación
 * 
 * Última actualización: 2024
 * Estado: ✅ Listo para Producción
 */

// ============================================
// PASO 1: CONFIGURAR VARIABLES DE ENTORNO
// ============================================

// Copia .env.example a .env y rellena:
// 1. Generate secure secrets:
//    openssl rand -base64 32
// 2. Configure database
// 3. Configure CORS origins

// ============================================
// PASO 2: VALIDAR STARTUP
// ============================================

// En servidor (main.ts o equivalente agregar):
import { validateSecretsAtStartup } from '$lib/server/tokens';

validateSecretsAtStartup(); // Valida y muestra errores

// ============================================
// PASO 3: USAR EN ENDPOINTS
// ============================================

// ✅ CORRECTO:
import { 
  generateAccessToken, 
  verifyAccessToken,
  generateTokenPair 
} from '$lib/server/tokens';

import {
  validateEmail,
  validatePassword,
  checkRateLimit,
  secureLog
} from '$lib/server/security';

// Login endpoint
export const POST: RequestHandler = async (event) => {
  // 1. Validar entrada
  const validation = validateEmail(correo);
  const passwordVal = validatePassword(contrasena);
  
  if (!validation.valid || !passwordVal.valid) {
    return secureErrorResponse(400, 'Datos inválidos');
  }

  // 2. Rate limiting
  const rateLimit = checkRateLimit(clientIP, 5, 15);
  if (!rateLimit.allowed) {
    return json({ error: 'Bloqueado por rate limit' }, { status: 429 });
  }

  // 3. Verificar credenciales
  const user = findUserInDB(validation.value);
  const validPassword = await bcrypt.compare(passwordVal.value, user.Contrasena);

  if (!validPassword) {
    secureLog('warn', 'Failed login', { ip: clientIP });
    return secureErrorResponse(401, 'Credenciales inválidas');
  }

  // 4. Generar tokens
  const tokens = generateTokenPair({
    id: user.Id,
    correo: user.Correo,
    organizacion: user.OrganizacionId
  });

  // 5. Limpiar rate limit
  clearRateLimit(clientIP);

  return json({
    token: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresIn: tokens.expiresIn
  });
};

// ============================================
// PASO 4: PROTEGER ENDPOINTS
// ============================================

// En tu endpoint protegido:
import { getUserFromRequest } from '$lib/server/auth';

export const GET: RequestHandler = async (event) => {
  // Esto ya está protegido por hooks.server.ts
  // Pero puedes obtener el usuario así:
  
  const user = getUserFromRequest(event);
  
  if (!user) {
    return json({ error: 'No autorizado' }, { status: 401 });
  }

  // `user` contiene: id, correo, organizacion, rolId
  
  return json({ data: `Hola ${user.correo}` });
};

// ============================================
// PASO 5: CLIENTE - ALMACENAR TOKEN
// ============================================

// ⚠️ IMPORTANTE: CAMBIO DE SEGURIDAD RECOMENDADO
// De sessionStorage a HttpOnly cookies

// ACTUAL (ANTES - NO SEGURO):
sessionStorage.setItem('jwt', response.token);

// RECOMENDADO (DESPUÉS - SEGURO):
// El servidor envía Set-Cookie automáticamente
// Solo necesitas:
fetch('/api/login', {
  credentials: 'include',  // Envía/recibe cookies automáticamente
  // El token viene en HttpOnly cookie
});

// ============================================
// PASO 6: CLIENTE - HACER REQUESTS AUTENTICADAS
// ============================================

// Función helper para fetch con auth automática:
async function apiFetch(path: string, options = {}) {
  return fetch(path, {
    ...options,
    credentials: 'include',  // Importante: envía cookies
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
}

// Uso:
const response = await apiFetch('/api/usuarios', {
  method: 'GET'
});

// ============================================
// PASO 7: CLIENTE - HANDLE TOKEN EXPIRADO
// ============================================

// Interceptar 401 y refrescar:
async function apiFetchWithRefresh(path: string, options = {}) {
  let response = await apiFetch(path, options);

  if (response.status === 401) {
    // Token expirado, refrescar
    const refreshResponse = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include'
    });

    if (refreshResponse.ok) {
      // Reintentar request original
      response = await apiFetch(path, options);
    } else {
      // Refresh falló, redirigir a login
      window.location.href = '/';
    }
  }

  return response;
}

// ============================================
// PASO 8: ENDPOINT REFRESH (CREAR)
// ============================================

// Crear: src/routes/api/auth/refresh/+server.ts

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { generateAccessToken, verifyRefreshToken } from '$lib/server/tokens';

export const POST: RequestHandler = async (event) => {
  // El refresh token viene en cookie HttpOnly
  const refreshToken = // obtener de cookies
  
  if (!refreshToken) {
    return json({ error: 'No refresh token' }, { status: 401 });
  }

  const decoded = verifyRefreshToken(refreshToken);
  
  if (!decoded) {
    return json({ error: 'Refresh token expirado' }, { status: 401 });
  }

  // Generar nuevo access token
  const newAccessToken = generateAccessToken({
    id: decoded.id,
    correo: decoded.correo,
    organizacion: decoded.organizacion
  });

  return json({
    token: newAccessToken,
    expiresIn: '15m'
  });
};

// ============================================
// PASO 9: TESTING
// ============================================

// Test 1: Registrar usuario
curl -X POST http://localhost:5173/api/auth/register \\
  -H "Content-Type: application/json" \\
  -d '{
    "correo": "test@example.com",
    "contrasena": "MySecurePassword123!",
    "numero_tel": "+1234567890"
  }'

// Test 2: Login
curl -X POST http://localhost:5173/api/login \\
  -H "Content-Type: application/json" \\
  -d '{
    "correo": "test@example.com",
    "contrasena": "MySecurePassword123!"
  }'

// Test 3: Usar token
TOKEN="eyJhbGc..."
curl http://localhost:5173/api/me \\
  -H "Authorization: Bearer $TOKEN"

// ============================================
// PASO 10: MONITOREO EN PRODUCCIÓN
// ============================================

// Monitorear estas métricas:
// 1. Tasa de login fallido (anómalo si > 10% de requests)
// 2. IPs bloqueadas por rate limit
// 3. Tokens expirados/inválidos
// 4. Errores de validación

// Ver logs seguros:
secureLog('info', 'Evento importante', {
  userId: 1,
  action: 'login',
  status: 'success'
});

// ============================================
// CHECKLIST ANTES DE PRODUCCIÓN
// ============================================

// ✅ Seguridad
// [ ] JWT_SECRET configurado (32+ chars)
// [ ] REFRESH_TOKEN_SECRET diferente
// [ ] NODE_ENV=production
// [ ] HTTPS obligatorio
// [ ] Database con encrypt=true
// [ ] CORS_ORIGINS configurado
// [ ] Rate limiting habilitado

// ✅ Funcionalidad
// [ ] Login funciona
// [ ] Tokens se generan correctamente
// [ ] Refresh token renueva
// [ ] Endpoints protegidos validan token
// [ ] Rate limit bloquea después de N intentos
// [ ] Contraseña se valida correctamente

// ✅ UX
// [ ] Mensajes de error claros (pero no revelan info)
// [ ] Redirección a login en 401
// [ ] Refresh token manejado transparentemente
// [ ] Loading states durante auth

// ============================================
// RECURSOS
// ============================================

// Documentación completa: SEGURIDAD_AUTENTICACION.md
// Módulos de utilidad: src/lib/server/security.ts
// Sistema de tokens: src/lib/server/tokens.ts
// Authz: src/lib/server/auth.ts
// Hooks: src/hooks.server.ts
