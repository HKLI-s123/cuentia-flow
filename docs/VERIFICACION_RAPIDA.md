# 🧪 VERIFICACIÓN RÁPIDA - Después de Implement ar Seguridad

Usa esta guía para verificar que todo fue instalado correctamente.

## ✅ Verificación de Archivos

```bash
# Verificar que los archivos fueron creados/modificados

# Nuevos archivos
❌ ls src/lib/server/security.ts
❌ ls src/lib/server/tokens.ts
❌ ls .env.example
❌ ls src/routes/api/auth/test-security/+server.ts
❌ ls scripts/security-checklist.js

# Documentación
❌ ls SEGURIDAD_AUTENTICACION.md
❌ ls GUIA_RAPIDA_AUTH.md
❌ ls CAMBIOS_SEGURIDAD.md
❌ ls RESUMEN_SEGURIDAD.md
```

## ✅ Verificación de Imports

```bash
# Verificar que las importaciones están correctas

# En src/routes/api/login/+server.ts
❌ grep "generateTokenPair" src/routes/api/login/+server.ts  # Debe encontrarlo
❌ grep "from '\$lib/server/tokens'" src/routes/api/login/+server.ts  # Debe encontrarlo

# En src/lib/server/auth.ts
❌ grep "verifyAccessToken" src/lib/server/auth.ts  # Debe encontrarlo
```

## ✅ Verificación de Código

```typescript
// 1. security.ts debe tener:
- ✅ validateEmail()
- ✅ validatePassword()
- ✅ validateName()
- ✅ validatePhoneNumber()
- ✅ checkRateLimit()
- ✅ clearRateLimit()
- ✅ secureLog()
- ✅ getClientIP()
- ✅ getSecurityHeaders()
- ✅ generateCSRFToken()
- ✅ validateCSRFToken()

// 2. tokens.ts debe tener:
- ✅ AuthToken (interface)
- ✅ generateAccessToken()
- ✅ generateRefreshToken()
- ✅ generateTokenPair()
- ✅ verifyAccessToken()
- ✅ verifyRefreshToken()
- ✅ extractTokenFromHeader()
- ✅ validateSecretsAtStartup()

// 3. auth.ts debe tener (actualizado):
- ✅ getUserFromRequest()
- ✅ verifyToken() @deprecated
- ✅ forbiddenResponse()
- ✅ validateOrganizationAccess()
- ✅ requireOrganizationAccess()

// 4. loops.server.ts debe tener:
- ✅ Headers de seguridad
- ✅ CORS validation
- ✅ Token verification
```

## 🧪 Tests de Funcionamiento

```bash
# 1. Test de validación de email
curl "http://localhost:5173/api/auth/test-security?test=email-validation"

# Respuesta esperada:
# {
#   "success": true,
#   "results": [
#     {
#       "test": "email-validation",
#       "passed": true,
#       "details": [ ... ]
#     }
#   ]
# }

# 2. Test de validación de contraseña
curl "http://localhost:5173/api/auth/test-security?test=password-validation"

# 3. Test de rate limiting
curl "http://localhost:5173/api/auth/test-security?test=rate-limit"

# 4. Test completo
curl "http://localhost:5173/api/auth/test-security?test=all"
```

## ⚙️ Configuración de Variables de Entorno

```bash
# Copiar .env.example a .env
cp .env.example .env

# Editar .env y configurar:
# 1. JWT_SECRET (generar: openssl rand -base64 32)
# 2. REFRESH_TOKEN_SECRET (diferente a JWT_SECRET)
# 3. DB_SERVER, DB_NAME, DB_USER, DB_PASSWORD
# 4. NODE_ENV=production
# 5. CORS_ORIGINS (tus dominios)
```

## 🔍 Verificación de Seguridad

```bash
# Ejecutar checklist de seguridad
node scripts/security-checklist.js

# Debe mostrar:
# - Chequeos críticos: TODOS DEBEN PASAR
# - Chequeos altos: Deben estar configurados
# - Chequeos medios: Para el futuro
# - Chequeos bajos: Nice to have
```

## 📋 Checklist de Verificación Manual

### Importaciones
- [ ] security.ts existe en src/lib/server/
- [ ] tokens.ts existe en src/lib/server/
- [ ] login/+server.ts importa de tokens.ts
- [ ] register/+server.ts importa de security.ts
- [ ] auth.ts usa verifyAccessToken de tokens.ts
- [ ] hooks.server.ts tiene getSecurityHeaders()

### Funcionalidad
- [ ] validateEmail() rechaza emails inválidos
- [ ] validatePassword() rechaza contraseñas débiles
- [ ] checkRateLimit() bloquea después de 5 intentos
- [ ] secureLog() no loguea contraseñas/tokens
- [ ] generateTokenPair() returns {accessToken, refreshToken, expiresIn}

### Variables de Entorno
- [ ] JWT_SECRET está configurado (32+ chars)
- [ ] REFRESH_TOKEN_SECRET está diferente
- [ ] NODE_ENV=production
- [ ] CORS_ORIGINS contiene tus dominios
- [ ] DB_* está configurado

### Documentación
- [ ] SEGURIDAD_AUTENTICACION.md existe
- [ ] GUIA_RAPIDA_AUTH.md existe
- [ ] CAMBIOS_SEGURIDAD.md existe
- [ ] RESUMEN_SEGURIDAD.md existe

## 🐛 Troubleshooting

### Error: "JWT_SECRET not configured properly"
```
Solución: Agregar JWT_SECRET a .env con 32+ caracteres aleatorios
openssl rand -base64 32  # Copiar output a JWT_SECRET=...
```

### Error: "Cannot find module '$lib/server/security'"
```
Solución: Verificar que src/lib/server/security.ts existe
Si no existe, correr nuevamente la instalación
```

### Error: "validateEmail is not a function"
```
Solución: Verificar importación en el archivo
import { validateEmail } from '$lib/server/security';
```

### Las pruebas de test-security fallan
```
Solución:
1. Verificar que security.ts tiene todas las funciones
2. Verificar que están exportadas (export function)
3. Verificar que routes/api/auth/test-security/+server.ts existe
```

## ✨ Pasos Finales

1. [ ] Ejecutar tests: `curl localhost:5173/api/auth/test-security?test=all`
2. [ ] Revisar: `node scripts/security-checklist.js`
3. [ ] Leer: [SEGURIDAD_AUTENTICACION.md](SEGURIDAD_AUTENTICACION.md)
4. [ ] Configurar: `.env` con secretos propios
5. [ ] Deploy: Con confianza ✅

---

## 📞 Si Algo No Funciona

1. Revisa el archivo de error específico mencionado arriba
2. Verifica las importaciones
3. Asegúrate de que los archivos existen
4. Lee SEGURIDAD_AUTENTICACION.md para más detalles
5. Ejecuta los tests de seguridad para diagnóstico

---

**¡Listo! Todo debe funcionar ahora. 🎉**
