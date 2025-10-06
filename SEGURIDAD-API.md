# Protección de Endpoints API con JWT

## 📋 Resumen

Todos los endpoints de tu aplicación están ahora protegidos con JWT (JSON Web Tokens) excepto las rutas públicas de autenticación.

## 🔒 Endpoints Protegidos

### Rutas Públicas (NO requieren token):
- `POST /api/login` - Login de usuarios
- `POST /api/auth/register` - Registro de usuarios
- `GET /api/test-db` - Solo para desarrollo (remover en producción)

### Todas las demás rutas requieren autenticación

## 🔑 Cómo Funciona

### 1. Hook Global de Servidor (`src/hooks.server.ts`)
El hook intercepta todas las peticiones a `/api/*` y verifica el token JWT antes de permitir el acceso.

### 2. Cliente - Envío Automático de Token

#### Opción A: Usar helper `authFetch` (Recomendado)
```typescript
import { authFetch, authGet, authPost, authPut, authDelete } from '$lib/api';

// GET
const data = await authGet('/api/clientes');

// POST
const result = await authPost('/api/clientes', { nombre: 'Cliente' });

// PUT
const updated = await authPut('/api/clientes/1', { nombre: 'Nuevo Nombre' });

// DELETE
await authDelete('/api/clientes/1');

// Fetch personalizado
const response = await authFetch('/api/custom', {
  method: 'PATCH',
  body: JSON.stringify({ data })
});
```

#### Opción B: Manual
```typescript
const token = sessionStorage.getItem('jwt');

const response = await fetch('/api/endpoint', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(data)
});
```

### 3. Servidor - Acceder al Usuario Autenticado

En tus endpoints, puedes acceder al usuario autenticado desde `event.locals.user`:

```typescript
// src/routes/api/mi-endpoint/+server.ts
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ locals }) => {
  // Usuario ya está autenticado gracias al hook
  const user = locals.user;

  if (!user) {
    return json({ error: 'No autorizado' }, { status: 401 });
  }

  console.log('Usuario ID:', user.id);
  console.log('Correo:', user.correo);
  console.log('Organización:', user.organizacion);

  // Tu lógica aquí...
  return json({ mensaje: 'Éxito', userId: user.id });
};
```

## 🛡️ Manejo de Errores

### Cliente
El helper `authFetch` automáticamente:
- Agrega el token JWT en el header `Authorization`
- Redirige al login si recibe 401 (Unauthorized)
- Limpia la sesión en caso de token inválido

### Servidor
El hook devuelve:
- **401** - Si no hay token o es inválido
- **Mensaje**: `"No autorizado - Token requerido"` o `"No autorizado - Token inválido o expirado"`

## 📝 Agregar Nuevas Rutas Públicas

Si necesitas agregar más rutas públicas (sin autenticación), edita `src/hooks.server.ts`:

```typescript
const PUBLIC_ROUTES = [
  '/api/login',
  '/api/auth/register',
  '/api/public-endpoint', // ← Agregar aquí
];
```

## ✅ Checklist de Migración

Para actualizar código existente:

1. **Importar el helper**:
   ```typescript
   import { authFetch } from '$lib/api';
   ```

2. **Reemplazar fetch con authFetch**:
   ```typescript
   // Antes
   const response = await fetch('/api/endpoint');

   // Después
   const response = await authFetch('/api/endpoint');
   ```

3. **Remover headers manuales** (authFetch los agrega automáticamente):
   ```typescript
   // Antes
   await fetch('/api/endpoint', {
     method: 'POST',
     headers: {
       'Authorization': `Bearer ${token}`,
       'Content-Type': 'application/json'
     },
     body: JSON.stringify(data)
   });

   // Después
   await authFetch('/api/endpoint', {
     method: 'POST',
     body: JSON.stringify(data)
   });
   ```

## 🚀 Para Producción

Antes de hostear, asegúrate de:

1. **Remover `/api/test-db`** de las rutas públicas en `src/hooks.server.ts`
2. **Configurar JWT_SECRET** fuerte en variables de entorno
3. **Usar HTTPS** para todas las peticiones
4. **Configurar CORS** apropiadamente si tienes frontend separado

## 🔍 Testing

Probar autenticación:
```bash
# Sin token - debe devolver 401
curl http://localhost:5173/api/clientes

# Con token - debe funcionar
curl -H "Authorization: Bearer TU_TOKEN_JWT" http://localhost:5173/api/clientes
```

## 📚 Archivos Clave

- `src/hooks.server.ts` - Hook global de protección
- `src/lib/server/auth.ts` - Funciones JWT del servidor
- `src/lib/api.ts` - Helpers del cliente para peticiones autenticadas
- `src/app.d.ts` - Tipos de TypeScript para `locals.user`
