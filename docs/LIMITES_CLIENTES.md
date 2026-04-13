# Sistema de Límites de Clientes

## 📋 Descripción General

Se ha implementado un sistema flexible de límites de clientes basado en planes de organización:

### Planes Disponibles

| Plan | Clientes/Día | Total Máximo | Caso de Uso |
|------|---|---|---|
| **FREE** | 10 | 100 | Startups / Pruefas |
| **PAID** | 500 | 10,000 | Empresas / Producción |

## 🔧 Cómo Funciona

### Validación de Límites

Cuando un usuario intenta crear un cliente:

1. **Se obtiene el plan de la organización** (por defecto: FREE)
2. **Se cuentan los clientes creados hoy**
   - Query: `WHERE CAST(CreatedAt AS DATE) = CAST(GETDATE() AS DATE)`
3. **Se cuentan los clientes totales** de la organización
4. **Se valida contra los límites del plan**
5. **Si se excede un límite**: retorna `429 Too Many Requests` con detalles

### Respuesta de Error

Cuando se excedan los límites, el API retorna:

```json
{
  "error": "Límite alcanzado",
  "detalles": {
    "mensaje": "Has alcanzado el límite de [X] clientes por día. Intenta de nuevo mañana.",
    "plan": "FREE",
    "cliente_actual": 15,
    "cliente_maximo": 100,
    "cliente_hoy": 10,
    "cliente_diarios_max": 10
  }
}
```

## 🛠️ Implementación Técnica

### Módulo Principal

**Archivo**: `src/lib/server/validar-limites-clientes.ts`

**Funciones**:
- `obtenerPlanOrganizacion(organizacionId)` - Obtiene el plan de una organización
- `validarLimitesClientes(organizacionId)` - Valida si se puede crear un nuevo cliente

### Integración en Endpoints

**Archivo**: `src/routes/api/clientes/+server.ts`

**POST handler ahora**:
1. Valida autenticación
2. Valida datos de cliente
3. Valida permisos (Admin)
4. **Valida límites de clientes** ← Nuevo
5. Crea cliente en BD
6. Sincroniza con FacturaAPI

### Flujo de Validación

```
┌─ POST /api/clientes
│
├─ Autenticación ✓
├─ Validación de datos ✓
├─ Validación de permisos (Admin) ✓
├─ ► Validación de límites ◄ NUEVO
│   ├─ Obtener plan de organización
│   ├─ Contar clientes hoy
│   ├─ Contar clientes totales
│   └─ Comparar contra límites
│
├─ Si límite NO se excede:
│   ├─ Crear cliente en BD
│   ├─ Sincronizar con FacturaAPI
│   └─ Retornar 200 con detalles
│
└─ Si límite se excede:
    └─ Retornar 429 con detalles
```

## 🎯 Casos de Uso

### 1. Usuario Free - Primer Cliente del Día

```bash
curl -X POST http://localhost:5173/api/clientes \
  -H "Content-Type: application/json" \
  -d '{
    "RazonSocial": "ACME Corp",
    "RFC": "ACM990101ABC",
    ...
  }'
```

**Respuesta**: `200 OK` - Cliente creado exitosamente

### 2. Usuario Free - Intenta 11° Cliente del Día

**Respuesta**: `429 Too Many Requests`
```json
{
  "error": "Límite alcanzado",
  "detalles": {
    "mensaje": "Has alcanzado el límite de 10 clientes por día. Intenta de nuevo mañana.",
    "cliente_hoy": 10,
    "cliente_diarios_max": 10
  }
}
```

### 3. Usuario Free - Exceede 100 Clientes Totales

**Respuesta**: `429 Too Many Requests`
```json
{
  "error": "Límite alcanzado",
  "detalles": {
    "mensaje": "Has alcanzado el límite total de 100 clientes para tu plan Gratuito. Considera actualizar tu plan para agregar más clientes.",
    "cliente_actual": 100,
    "cliente_maximo": 100
  }
}
```

## 🔑 Personalización

### Cambiar Límites

Editar `src/lib/server/validar-limites-clientes.ts`:

```typescript
export const PLANES_ORGANIZACION = {
	FREE: {
		nombre: 'Gratuito',
		cliente_diarios: 10,        // ← CAMBIAR
		cliente_totales: 100,       // ← CAMBIAR
		esGratis: true
	},
	PAID: {
		nombre: 'Premium',
		cliente_diarios: 500,       // ← CAMBIAR
		cliente_totales: 10000,     // ← CAMBIAR
		esGratis: false
	}
};
```

### Agregar Nuevos Planes

```typescript
export const PLANES_ORGANIZACION = {
	FREE: { /* ... */ },
	PAID: { /* ... */ },
	ENTERPRISE: {                   // ← NUEVO
		nombre: 'Empresarial',
		cliente_diarios: 1000,
		cliente_totales: 50000,
		esGratis: false
	}
};
```

Luego actualizar la BD si se necesita persistir los planes:

```sql
-- Agregar plan_id a Organizaciones
ALTER TABLE Organizaciones
ADD plan_id NVARCHAR(50) DEFAULT 'FREE'
    CHECK (plan_id IN ('FREE', 'PAID', 'ENTERPRISE'));
```

Ver script: `scripts/add-organization-plans.sql`

## 🔐 Seguridad

### Principios Implementados

1. **Server-Side Enforcement**: Los límites se validan en el servidor, no en cliente
2. **Organization Isolation**: Cada organización tiene sus propios límites independientes
3. **Atomic Validation**: Se verifica en la transacción antes de insertar
4. **Graceful Degradation**: Si hay error en validación de límites, se permite crear (open fail)

## 📊 Monitoreo

### Query para Monitorear Uso

```sql
SELECT 
    o.Id,
    o.RazonSocial,
    COALESCE(o.plan_id, 'FREE') as plan,
    COUNT(c.Id) as total_clientes,
    SUM(CASE WHEN CAST(c.CreatedAt AS DATE) = CAST(GETDATE() AS DATE) THEN 1 ELSE 0 END) as clientes_hoy,
    -- Calcular % de uso
    CAST(
        100.0 * COUNT(c.Id) / 
        CASE WHEN COALESCE(o.plan_id, 'FREE') = 'FREE' THEN 100 ELSE 10000 END
    AS INT) as porcentaje_uso
FROM Organizaciones o
LEFT JOIN Clientes c ON o.Id = c.OrganizacionId
GROUP BY o.Id, o.RazonSocial, o.plan_id
ORDER BY porcentaje_uso DESC;
```

## 🚀 Futuras Mejoras

- [ ] UI para mostrar uso actual vs límites
- [ ] Alertas cuando se acerca al límite (90%, 95%)
- [ ] Dashboard de administrador para gestionar planes
- [ ] API para cambiar plan de organización
- [ ] Notificaciones por email cuando se alcance límite
- [ ] Reportes de uso por organización
- [ ] Sistema de upgrade automático a PAID

## 📝 Notas

- Por defecto, **todas las organizaciones inician en plan FREE**
- A futuro, se puede agregar una columna `plan_id` a la tabla `Organizaciones` para persistir los planes
- Los conteos se hacen en real-time desde la BD (sin cache)
- El código es extensible para agregar más planes según se necesite
