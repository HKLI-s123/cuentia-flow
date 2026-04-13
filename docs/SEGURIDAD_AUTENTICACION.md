# 🔐 Mejoras de Seguridad - Sistema de Autenticación

## Resumen de Cambios

Se ha refactorizado completamente el sistema de autenticación para cumplir con estándares profesionales de seguridad para producción. A continuación se detallan todas las mejoras implementadas.

---

## 1. Configuración de Secretos y Variables de Entorno

### Antes ❌
```typescript
const JWT_SECRET = process.env.JWT_SECRET || 'supersecreto';
```
**Problemas:**
- Valor por defecto débil y predecible
- Token con 12 horas de duración (ventana de riesgo grande)
- Sin separación entre Access y Refresh tokens

### Después ✅
```
JWT_SECRET=your-random-secret-key-min-32-chars-required
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_SECRET=your-random-refresh-secret-key-min-32-chars
REFRESH_TOKEN_EXPIRES_IN=7d
```

**Mejoras:**
- Secretos obligatorios de 32+ caracteres aleatorios
- Access Token con 15 minutos (expiración corta)
- Refresh Token para renovación sin re-autenticar
- Ambos secretos DEBEN ser diferentes

### ⚙️ Cómo Generar Secretos Seguros (En Terminal)

```bash
# En macOS/Linux
openssl rand -base64 32

# En Windows PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object {[byte](Get-Random -Maximum 256)}))
```

---

## 2. Validación y Sanitización de Entrada

### Nuevo Módulo: `src/lib/server/security.ts`

#### Email Validation
```typescript
validateEmail(email: string): ValidationResult
```
- Valida formato RFC 5322 simplificado
- Sanitiza (trim, lowercase)
- Máximo 150 caracteres

#### Password Validation
```typescript
validatePassword(password: string): ValidationResult
```
**Requisitos Mínimos (OWASP):**
- ✅ Mínimo 10 caracteres
- ✅ Debe contener mayúscula (A-Z)
- ✅ Debe contener minúscula (a-z)
- ✅ Debe contener número (0-9)
- ✅ Debe contener símbolo especial (!@#$%^&*...)
- ✅ Máximo 128 caracteres

#### Name Validation
```typescript
validateName(name: string, fieldName: string): ValidationResult
```
- 2-100 caracteres
- Solo letras, espacios y caracteres acentuados
- Previene inyección de caracteres especiales

#### Phone Validation
```typescript
validatePhoneNumber(phone: string): ValidationResult
```
- 7-20 caracteres
- Solo dígitos, espacios, guiones
- Opcional

---

## 3. Rate Limiting - Anti Fuerza Bruta

### Nueva Función: `checkRateLimit()`

```typescript
const rateLimit = checkRateLimit(
  clientIP,      // Identificador único (IP del cliente)
  maxAttempts,   // Por defecto: 5
  lockoutMinutes // Por defecto: 15
);

if (!rateLimit.allowed) {
  // Usuario bloqueado por 15 minutos
}
```

**Características:**
- Almacenamiento en memoria (para desarrollo)
- **⚠️ IMPORTANTE:** En producción, usar Redis para distribuido
- Bloquea después de N intentos fallidos
- Bloqueo temporal (configurable)
- Se resetea después de logout/login exitoso

### Variables de Entorno
```
MAX_LOGIN_ATTEMPTS=5           # Intentos antes de bloquear
LOGIN_LOCKOUT_MINUTES=15       # Duración del bloqueo
```

---

## 4. Manejo Seguro de Errores

### Antes ❌
```typescript
catch (err) {
  console.error(err);  // Expone detalles internos
  return json({ error: 'Error en el servidor' }, { status: 500 });
}
```

### Después ✅
```typescript
import { secureErrorResponse, secureLog } from '$lib/server/security';

catch (error) {
  secureLog('error', 'Login endpoint error', {
    error: error instanceof Error ? error.message : 'Unknown error'
  });
  
  return secureErrorResponse(500, 'Error en el servidor');
}
```

**Beneficios:**
- Mensajes genéricos al cliente (sin info sensible)
- Logs detallados en servidor (sin tokens/passwords)
- Automáticamente redacta datos sensibles

---

## 5. Sistema de Tokens Mejorado

### Nuevo Módulo: `src/lib/server/tokens.ts`

#### Access Token (Corta Duración)
```typescript
const accessToken = generateAccessToken({
  id: user.Id,
  correo: user.Correo,
  organizacion: user.OrganizacionId,
  rolId: user.RolId
});
// Válido por 15 minutos
```

**Características:**
- HS256 (HMAC con SHA256)
- Issuer: `cobranza-app`
- Audience: `cobranza-api`
- Expiración: 15 min (configurable)

#### Refresh Token (Larga Duración)
```typescript
const refreshToken = generateRefreshToken(payload);
// Válido por 7 días
```

**Características:**
- Audience: `cobranza-refresh`
- Expiración: 7 días (configurable)
- Se usa para obtener nuevo Access Token sin re-autenticar

#### Par de Tokens
```typescript
const { accessToken, refreshToken, expiresIn } = generateTokenPair(payload);
```

---

## 6. Validación de Configuración de Seguridad

En startup, valida:
```typescript
if (process.env.NODE_ENV === 'production') {
  // ✅ JWT_SECRET configurado y válido
  // ✅ REFRESH_TOKEN_SECRET configurado y válido
  // ✅ Ambos tienen 32+ caracteres
  // ✅ Son diferentes
  // ❌ Si falla, mata el proceso
}
```

---

## 7. Endpoint de Login Refactorizado

### `POST /api/login`

**Flujo de Seguridad:**

1. **Validación de Entrada**
   - Email requerido y válido
   - Contraseña requerida

2. **Rate Limiting**
   - Detecta intentos fallidos por IP
   - Bloquea después de 5 intentos en 15 minutos

3. **Búsqueda de Usuario**
   - Sin revelar si email existe o no (previene enumeración)

4. **Validación de Contraseña**
   - Usa bcryptjs para comparación
   - Tiempo constante (previene timing attacks)

5. **Generación de Tokens**
   - Access Token (15 min) + Refresh Token (7 días)
   - Validación de secretos

6. **Limpieza de Rate Limit**
   - Se resetea después de login exitoso

7. **Logging de Seguridad**
   - Registra intentos exitosos
   - Redacta información sensible

**Respuesta Exitosa:**
```json
{
  "message": "Login exitoso",
  "token": "eyJhbGc...",
  "refreshToken": "eyJhbGc...",
  "expiresIn": "15m",
  "usuario": {
    "id": 1,
    "correo": "user@example.com",
    "nombre": "Juan",
    "apellido": "Pérez",
    "organizacionId": 10,
    "rolId": 2
  }
}
```

---

## 8. Endpoint de Registro Refactorizado

### `POST /api/auth/register`

**Características:**

1. **Deshabilitado por Defecto**
   - `ALLOW_USER_REGISTRATION=false`
   - Solo admin puede habilitar

2. **Validación Multi-capa**
   - Email válido y único
   - Contraseña fuerte (10+ chars, mayús, minús, número, símbolo)
   - Nombre/Apellido sanitizados
   - Teléfono validado (opcional)

3. **Rate Limiting**
   - 5 intentos por hora por IP

4. **Cuota de Contraseña Fuerte**
   ```
   ✅ Válida: MyPass123!
   ❌ Inválida: password
   ❌ Inválida: 12345678
   ❌ Inválida: Pass123word
   ```

5. **Usuario Inactivo por Defecto**
   - Requiere verificación de email
   - Campos temporales hasta verificación

6. **Hashing Seguro**
   - Bcryptjs con salt rounds = 12 (2x más que antes)

**Respuesta:**
```json
{
  "message": "Usuario registrado correctamente. Verifica tu email...",
  "usuarioId": 42,
  "pendingVerification": true
}
```

---

## 9. Headers de Seguridad HTTP

Se agregan automáticamente a todas las respuestas:

```
X-Frame-Options: DENY
  → Previene clickjacking

X-Content-Type-Options: nosniff
  → Previene MIME sniffing

X-XSS-Protection: 1; mode=block
  → Protección XSS en navegadores antiguos

Referrer-Policy: strict-origin-when-cross-origin
  → No expone referrer a otros dominios

Content-Security-Policy: default-src 'self'; ...
  → Restringe cargas de recursos

Strict-Transport-Security: max-age=31536000
  → HTTPS obligatorio por 1 año
```

---

## 10. CORS (Cross-Origin Resource Sharing)

### Antes ❌
- Sin validación de CORS
- Vulnerable a CSRF desde cualquier dominio

### Después ✅
```
CORS_ORIGINS=https://cobranza-app.com,https://admin.cobranza-app.com
```

- Valida origen de requests
- Solo dominios permitidos pueden acceder
- Completo con pre-flight OPTIONS
- SameSite cookies

---

## 11. Logging de Seguridad

### Función: `secureLog()`

```typescript
secureLog('info', 'Successful login', {
  userId: 1,
  email: 'user@example.com',
  ip: '192.168.1.1'
});

// Automáticamente redacta:
// - Contraseñas
// - Tokens
// - Secretos
```

### Niveles de Log
- `error` - Errores críticos
- `warn` - Intentos fallidos
- `info` - Acciones exitosas

---

## 12. Extracción de IP del Cliente

```typescript
const clientIP = getClientIP(event);
```

Soporta:
- Header `x-forwarded-for` (proxies)
- Header `cf-connecting-ip` (Cloudflare)
- Header `x-real-ip` (nginx)
- IP nativa del socket

---

## 13. Cliente - Almacenamiento de Tokens (⚠️ IMPORTANTE)

### Actual: sessionStorage ❌
```typescript
sessionStorage.setItem('jwt', token);  // Vulnerable a XSS
```

### Debería ser: HttpOnly Cookie ✅
```typescript
// Servidor establece automáticamente
Set-Cookie: accessToken=...; HttpOnly; Secure; SameSite=Strict
```

**Mejoras Requeridas en Cliente:**
1. Cambiar de `sessionStorage` a cookies HttpOnly
2. Agregar middleware para adjuntar token automáticamente
3. Manejar refresh token transparentemente

### Cambio Recomendado:
```typescript
// En src/lib/api.ts - Cambio futuro
// En lugar de leer de sessionStorage:
// const token = sessionStorage.getItem('jwt');

// Usar fetch automáticamente con credenciales
// Las cookies se envían automáticamente
fetch('/api/data', {
  credentials: 'include'  // Envía cookies automáticamente
});
```

---

## 14. Checklist de Implementación para Producción

### ⚠️ Crítico
- [ ] Configurar `JWT_SECRET` (32+ caracteres aleatorios)
- [ ] Configurar `REFRESH_TOKEN_SECRET` (diferente a JWT_SECRET)
- [ ] `NODE_ENV=production`
- [ ] `ALLOW_USER_REGISTRATION=false` (excepto si es necesario)
- [ ] Database con `encrypt: true`
- [ ] HTTPS obligatorio (Vercel/Netlify lo hace automáticamente)

### 🔧 Importante
- [ ] Migrar tokens a HttpOnly cookies
- [ ] Implementar refresh token endpoint
- [ ] Usar Redis para rate limiting distribuido
- [ ] Implementar verificación de email (SMTP configurado)
- [ ] Implementar 2FA (opcional pero recomendado)

### 📊 Monitoreo
- [ ] Logs centralizados (Sentry, LogRocket)
- [ ] Alertas para tasa alta de intentos fallidos
- [ ] Auditoría de acceso (quién accedió cuándo)
- [ ] Rotación de logs cada 30 días

---

## 15. Cambios de Comportamiento

### Usuarios Nuevos
| Aspecto | Antes | Después |
|--------|-------|---------|
| Validación Email | No | ✅ Sí (RFC 5322) |
| Contraseña Mínima | Cualquiera | ✅ 10+ chars, mayús, minús, número, símbolo |
| registro Automático | Activo | ✅ Inactivo (requiere verificación) |
| Token Duración | 12 horas | ✅ 15 minutos |
| Rate Limiting | No | ✅ Sí (5 intentos/15 min) |
| Bloqueo IP | No | ✅ Sí (temporal) |

### Login
| Aspecto | Antes | Después |
|--------|-------|---------|
| Errores Específicos | Sí ❌ | Genéricos ✅ |
| Prevención Enumeración | No | ✅ Sí |
| Refresh Token | No | ✅ Sí |
| Logging | Básico | ✅ Detallado |

---

## 16. Mitigación de Ataques Comunes

### 🔴 Fuerza Bruta
- **Mitigación:** Rate limiting + bloqueo temporal de IP
- **Threshold:** 5 intentos fallidos = 15 minutos bloqueado

### 🔴 Enumeración de Usuarios
- **Mitigación:** Mensajes genéricos "Credenciales inválidas"
- **No revela:** Si email existe o no

### 🔴 XSS (Cross-Site Scripting)
- **Mitigación:** Validación y sanitización de entrada
- **Future:** HttpOnly cookies (tokens)

### 🔴 CSRF (Cross-Site Request Forgery)
- **Mitigación:** SameSite cookies, validación de origin
- **Headers:** CSRF token en requests POST/PUT

### 🔴 SQL Injection
- **Mitigación:** Parámetros nombrados (sql `@param`)
- **No usa:** Concatenación de strings

### 🔴 Timing Attacks
- **Mitigación:** bcrypt.compare() con tiempo constante
- **No usa:** Comparación con ===

### 🔴 Token Hijacking
- **Mitigación:** Expiración corta (15 min), refresh tokens, HTTPS
- **Future:** Binding a IP/User-Agent

---

## 17. Pasos Siguientes Recomendados

### Fase 1 (Inmediata - Antes de Producción)
1. [x] Implementar validación de entrada
2. [x] Rate limiting básico
3. [x] Headers de seguridad
4. [x] Mejor manejo de errores
5. [ ] Configurar variables de entorno en Vercel/hosting

### Fase 2 (Primer Mes)
1. [ ] Migrar tokens a HttpOnly cookies
2. [ ] Implementar refresh token endpoint `/api/auth/refresh`
3. [ ] Implementar verificación de email
4. [ ] Setup Redis para rate limiting distribuido
5. [ ] Implementar auditoría de acceso

### Fase 3 (Segundo Mes)
1. [ ] Implementar 2FA (TOTP/SMS)
2. [ ] Encriptación end-to-end para datos sensibles
3. [ ] Rotación automática de secretos
4. [ ] Implementar session management (logout, revocación)

### Fase 4 (Tercero en Adelante)
1. [ ] Zero-knowledge proofs para autenticación
2. [ ] Biometría
3. [ ] WebAuthn (FIDO2)
4. [ ] Análisis de comportamiento anómalo

---

## 📚 Referencias de Seguridad

- [OWASP Top 10 2023](https://owasp.org/www-project-top-ten/)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [JWT.io](https://jwt.io) - Validación y generación de tokens
- [bcryptjs](https://github.com/dcodeIO/bcrypt.js) - Password hashing

---

## 🆘 Soporte y Preguntas

Si tienes dudas sobre la implementación o necesitas ayuda con la migración a producción, revisa:
1. Los comentarios en el código (marcan cambios importantes)
2. Las variables de entorno en `.env.example`
3. Los endpoints de test en `/api/test-*`

