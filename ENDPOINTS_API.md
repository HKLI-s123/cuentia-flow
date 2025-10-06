# Documentación de Endpoints API - Cobranza App

Esta es la lista completa de todos los endpoints creados en la carpeta `src/routes/api/` que deben ser migrados al backend.

---

## Índice de Endpoints

### Usuarios
- [GET /api/usuario](#get-apiusuario)
- [GET /api/usuario/[id]/organizacion](#get-apiusuarioidorganizacion)
- [GET /api/usuario/[id]/organizaciones](#get-apiusuarioidorganizaciones)

### Clientes
- [GET /api/clientes](#get-apiclientes)
- [GET /api/clientes/buscar-por-rfc](#get-apiclientesbuscar-por-rfc)
- [POST /api/clientes/asignar-agente](#post-apiclientesasignar-agente)
- [POST /api/clientes/remover-agente](#post-apiclientesremover-agente)

### Facturas
- [GET /api/facturas](#get-apifacturas)
- [POST /api/facturas](#post-apifacturas)
- [POST /api/facturas/actualizar-dias-vencidos](#post-apifacturasactualizar-dias-vencidos)

### Agentes
- [GET /api/agentes](#get-apiagentes)

### Dashboard
- [GET /api/dashboard/stats](#get-apidashboardstats)

### Catálogos
- [GET /api/paises](#get-apipaises)
- [GET /api/estados](#get-apiestados)
- [GET /api/regimen](#get-apiregimen)

### Configuración
- [GET /api/config](#get-apiconfig)
- [GET /api/configuracion/organizacion/[id]](#get-apiconfiguracionorganizacionid)
- [POST /api/configuracion/organizacion/[id]](#post-apiconfiguracionorganizacionid)

---

## Usuarios

### GET /api/usuario
**Descripción**: Obtener información del usuario autenticado mediante JWT

**Headers**:
- `Authorization: Bearer <token>`

**SQL Query**:
```sql
SELECT
    u.Id,
    u.Nombre,
    u.Apellido,
    u.Correo,
    uo.OrganizacionId,
    o.RazonSocial as Organizacion,
    r.Nombre as Rol,
    uo.Id as UsuarioOrganizacionId
FROM Usuarios u
LEFT JOIN Usuario_Organizacion uo ON u.Id = uo.UsuarioId
LEFT JOIN Organizaciones o ON uo.OrganizacionId = o.Id
LEFT JOIN Roles r ON uo.RolId = r.Id
WHERE u.Correo = @email
    AND u.Activo = 1
ORDER BY o.RazonSocial, r.Nombre
```

**Response 200**:
```json
{
  "id": 1,
  "nombre": "Juan Pérez",
  "email": "usuario@ejemplo.com",
  "organizacion": "Mi Empresa SA",
  "organizacionId": 3,
  "rol": "Administrador",
  "iniciales": "JP",
  "organizaciones": [
    {
      "organizacionId": 3,
      "organizacion": "Mi Empresa SA",
      "rol": "Administrador",
      "usuarioOrganizacionId": 5
    }
  ]
}
```

**Errores**:
- 401: Token de autorización requerido / Token inválido
- 404: Usuario no encontrado
- 500: Error interno del servidor

---

### GET /api/usuario/[id]/organizacion
**Descripción**: Obtener la organización principal de un usuario

**URL Params**:
- `id`: ID del usuario

**SQL Query**:
```sql
SELECT
    uo.OrganizacionId,
    o.RazonSocial as organizacion_nombre,
    uo.RolId,
    r.Nombre as rol_nombre
FROM Usuario_Organizacion uo
INNER JOIN Organizaciones o ON uo.OrganizacionId = o.Id
LEFT JOIN Roles r ON uo.RolId = r.Id
WHERE uo.UsuarioId = @usuarioId
```

**Response 200**:
```json
{
  "organizacionId": 3,
  "organizacionNombre": "Mi Empresa SA",
  "rolId": 1,
  "rolNombre": "Administrador"
}
```

**Errores**:
- 400: ID de usuario inválido
- 404: Usuario sin organización asignada
- 500: Error interno del servidor

---

### GET /api/usuario/[id]/organizaciones
**Descripción**: Obtener todas las organizaciones de un usuario

**URL Params**:
- `id`: ID del usuario

**SQL Query**:
```sql
SELECT DISTINCT
    o.Id,
    o.RazonSocial,
    o.RFC,
    uo.RolId,
    r.Nombre
FROM Usuario_Organizacion uo
INNER JOIN Organizaciones o ON uo.OrganizacionId = o.Id
INNER JOIN Roles r ON uo.RolId = r.Id
WHERE uo.UsuarioId = @userId
ORDER BY o.RazonSocial ASC
```

**Response 200**:
```json
{
  "success": true,
  "organizaciones": [
    {
      "id": 3,
      "razonSocial": "Mi Empresa SA",
      "rfc": "MEE990101A12",
      "rolId": 1,
      "rolNombre": "Administrador"
    }
  ]
}
```

**Errores**:
- 500: Error interno del servidor

---

## Clientes

### GET /api/clientes
**Descripción**: Obtener listado de clientes con paginación y búsqueda

**Query Params**:
- `organizacionId` (requerido): ID de la organización
- `search` (opcional): Texto de búsqueda
- `page` (opcional, default: 1): Página actual
- `pageSize` (opcional, default: 5): Registros por página
- `all` (opcional): Si es "true", devuelve todos los registros sin paginación

**SQL Query (principal)**:
```sql
SELECT
    c.Id as id,
    c.NombreComercial as cliente,
    c.RazonSocial as razonSocial,
    c.RFC as rfc,
    c.CondicionesPago as condiciones,
    ISNULL(agentes.ListaAgentes, '') as agente,
    0 as cuentasMXN,
    0 as cuentasUSD
FROM Clientes c
LEFT JOIN (
    SELECT
        ac.ClienteId,
        STRING_AGG(CONCAT(u.Nombre, ' ', u.Apellido), ', ') as ListaAgentes
    FROM Agentes_Clientes ac
    INNER JOIN Usuarios u ON ac.UsuarioId = u.Id
    GROUP BY ac.ClienteId
) agentes ON c.Id = agentes.ClienteId
WHERE c.OrganizacionId = @organizacionId
    AND (
        c.NombreComercial LIKE @search OR
        c.RazonSocial LIKE @search OR
        c.RFC LIKE @search OR
        agentes.ListaAgentes LIKE @search
    )
ORDER BY c.RazonSocial ASC
OFFSET @offset ROWS
FETCH NEXT @pageSize ROWS ONLY
```

**SQL Query (conteo)**:
```sql
SELECT COUNT(DISTINCT c.Id) as total
FROM Clientes c
LEFT JOIN (
    SELECT
        ac.ClienteId,
        STRING_AGG(CONCAT(u.Nombre, ' ', u.Apellido), ', ') as ListaAgentes
    FROM Agentes_Clientes ac
    INNER JOIN Usuarios u ON ac.UsuarioId = u.Id
    GROUP BY ac.ClienteId
) agentes ON c.Id = agentes.ClienteId
WHERE c.OrganizacionId = @organizacionId
    AND (...)
```

**Response 200 (con paginación)**:
```json
{
  "clientes": [
    {
      "id": 1,
      "cliente": "Cliente XYZ",
      "razonSocial": "Cliente XYZ SA de CV",
      "rfc": "CXY990101ABC",
      "condiciones": "30 días",
      "agente": "Juan Pérez, María García",
      "cuentasMXN": 0,
      "cuentasUSD": 0
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 10,
    "totalRecords": 50,
    "pageSize": 5
  }
}
```

**Response 200 (con all=true)**:
```json
{
  "clientes": [...],
  "total": 50
}
```

**Errores**:
- 400: organizacionId es requerido
- 500: Error interno del servidor

---

### GET /api/clientes/buscar-por-rfc
**Descripción**: Buscar un cliente específico por RFC

**Query Params**:
- `rfc` (requerido): RFC del cliente
- `organizacionId` (requerido): ID de la organización

**SQL Query**:
```sql
SELECT TOP 1 Id as id
FROM Clientes
WHERE RFC = @rfc AND OrganizacionId = @organizacionId
ORDER BY Id DESC
```

**Response 200**:
```json
{
  "id": 1
}
```

**Errores**:
- 400: RFC y organizacionId son requeridos
- 404: Cliente no encontrado
- 500: Error interno del servidor

---

### POST /api/clientes/asignar-agente
**Descripción**: Asignar un agente a un cliente

**Request Body**:
```json
{
  "clienteId": 1,
  "organizacionId": 3,
  "usuarioId": 5
}
```

**SQL Query (verificar si existe)**:
```sql
SELECT COUNT(*) as count
FROM Agentes_Clientes
WHERE ClienteId = @clienteId AND UsuarioId = @usuarioId
```

**SQL Query (insertar)**:
```sql
INSERT INTO Agentes_Clientes (ClienteId, UsuarioId, RolAgente, CreatedAt, UpdatedAt)
VALUES (@clienteId, @usuarioId, 'Agente Principal', GETDATE(), GETDATE())
```

**SQL Query (obtener nombre del agente)**:
```sql
SELECT CONCAT(Nombre, ' ', Apellido) as nombreCompleto
FROM Usuarios
WHERE Id = @usuarioId
```

**Response 200**:
```json
{
  "success": true,
  "agenteId": 5,
  "agenteNombre": "Juan Pérez",
  "message": "Agente asignado exitosamente"
}
```

**Errores**:
- 400: clienteId y usuarioId son requeridos
- 500: Error interno del servidor

---

### POST /api/clientes/remover-agente
**Descripción**: Remover todas las asignaciones de agentes de un cliente

**Request Body**:
```json
{
  "clienteId": 1
}
```

**SQL Query**:
```sql
DELETE FROM Agentes_Clientes
WHERE ClienteId = @clienteId
```

**Response 200**:
```json
{
  "success": true,
  "message": "Asignaciones de agente removidas exitosamente"
}
```

**Errores**:
- 400: clienteId es requerido
- 500: Error interno del servidor

---

## Facturas

### GET /api/facturas
**Descripción**: Obtener listado de facturas con filtros avanzados y estadísticas de aging

**Nota**: Este endpoint usa una conexión diferente (MySQL/compatible), los queries están adaptados para esa sintaxis.

**Query Params**:
- `organizacionId` (requerido): ID de la organización
- `cliente` (opcional): Búsqueda por nombre, RFC o razón social
- `estado` (opcional): Código del estado de factura
- `fechaInicio` (opcional): Fecha inicial (formato: YYYY-MM-DD)
- `fechaFin` (opcional): Fecha final (formato: YYYY-MM-DD)
- `montoMin` (opcional): Monto mínimo
- `montoMax` (opcional): Monto máximo
- `diasVencidoMin` (opcional): Días vencidos mínimos
- `diasVencidoMax` (opcional): Días vencidos máximos
- `prioridad` (opcional): Código de prioridad
- `page` (opcional, default: 1): Página actual
- `limit` (opcional, default: 50): Registros por página

**SQL Query (obtener facturas)**:
```sql
SELECT
    f.Id,
    f.ClienteId,
    f.numero_factura,
    f.MontoTotal,
    f.SaldoPendiente,
    f.FechaEmision,
    f.FechaVencimiento,
    f.DiasVencido,
    f.UltimaGestion,
    f.Observaciones,
    f.CreatedAt,
    f.UpdatedAt,
    c.RazonSocial as ClienteRazonSocial,
    c.NombreComercial as ClienteNombreComercial,
    c.RFC as ClienteRFC,
    c.CorreoPrincipal as ClienteEmail,
    c.Telefono as ClienteTelefono,
    ef.codigo as EstadoCodigo,
    ef.id as EstadoId,
    pc.codigo as PrioridadCodigo,
    pc.id as PrioridadId
FROM Facturas f
INNER JOIN Clientes c ON f.ClienteId = c.Id
LEFT JOIN estados_factura ef ON f.estado_factura_id = ef.id
LEFT JOIN prioridades_cobranza pc ON f.prioridad_cobranza_id = pc.id
WHERE c.OrganizacionId = ?
    AND [filtros dinámicos...]
ORDER BY f.FechaVencimiento ASC, f.DiasVencido DESC
OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
```

**SQL Query (conteo)**:
```sql
SELECT COUNT(*) as total
FROM Facturas f
INNER JOIN Clientes c ON f.ClienteId = c.Id
LEFT JOIN estados_factura ef ON f.estado_factura_id = ef.id
LEFT JOIN prioridades_cobranza pc ON f.prioridad_cobranza_id = pc.id
WHERE c.OrganizacionId = ?
    AND [filtros dinámicos...]
```

**SQL Query (aging)**:
```sql
SELECT
    COUNT(*) as totalFacturas,
    SUM(f.SaldoPendiente) as montoTotal,
    SUM(CASE WHEN f.DiasVencido >= 0 AND f.DiasVencido <= 30 THEN f.SaldoPendiente ELSE 0 END) as aging0_30,
    SUM(CASE WHEN f.DiasVencido > 30 AND f.DiasVencido <= 60 THEN f.SaldoPendiente ELSE 0 END) as aging31_60,
    SUM(CASE WHEN f.DiasVencido > 60 AND f.DiasVencido <= 90 THEN f.SaldoPendiente ELSE 0 END) as aging61_90,
    SUM(CASE WHEN f.DiasVencido > 90 THEN f.SaldoPendiente ELSE 0 END) as aging91_mas,
    COUNT(CASE WHEN f.DiasVencido >= 0 AND f.DiasVencido <= 30 THEN 1 END) as count0_30,
    COUNT(CASE WHEN f.DiasVencido > 30 AND f.DiasVencido <= 60 THEN 1 END) as count31_60,
    COUNT(CASE WHEN f.DiasVencido > 60 AND f.DiasVencido <= 90 THEN 1 END) as count61_90,
    COUNT(CASE WHEN f.DiasVencido > 90 THEN 1 END) as count91_mas
FROM Facturas f
INNER JOIN Clientes c ON f.ClienteId = c.Id
WHERE c.OrganizacionId = ?
    AND [filtros dinámicos...]
```

**Response 200**:
```json
{
  "success": true,
  "facturas": [
    {
      "id": 1,
      "clienteId": 5,
      "numeroFactura": "F-001",
      "montoTotal": 10000.00,
      "saldoPendiente": 5000.00,
      "fechaEmision": "2024-01-01",
      "fechaVencimiento": "2024-02-01",
      "diasVencido": 15,
      "ultimaGestion": null,
      "observaciones": "Pago parcial recibido",
      "createdAt": "2024-01-01T10:00:00",
      "cliente": {
        "id": 5,
        "razonSocial": "Cliente ABC SA",
        "nombreComercial": "ABC",
        "rfc": "CAB990101XYZ",
        "email": "cliente@abc.com",
        "telefono": "5551234567"
      },
      "estado": {
        "id": 2,
        "codigo": "vencida"
      },
      "prioridad": {
        "id": 3,
        "codigo": "alta"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 150,
    "totalPages": 3
  },
  "aging": {
    "totalFacturas": 150,
    "montoTotal": 500000.00,
    "rango0_30": {
      "monto": 100000.00,
      "count": 40
    },
    "rango31_60": {
      "monto": 150000.00,
      "count": 50
    },
    "rango61_90": {
      "monto": 120000.00,
      "count": 35
    },
    "rango91_mas": {
      "monto": 130000.00,
      "count": 25
    }
  }
}
```

**Errores**:
- 400: organizacionId es requerido para sistema multi-tenant
- 500: Error interno del servidor

---

### POST /api/facturas
**Descripción**: Crear una nueva factura

**Nota**: Este endpoint también usa conexión MySQL/compatible.

**Request Body**:
```json
{
  "clienteId": 5,
  "montoTotal": 10000.00,
  "saldoPendiente": 10000.00,
  "fechaEmision": "2024-01-01",
  "fechaVencimiento": "2024-02-01",
  "numeroFactura": "F-001",
  "estadoId": 1,
  "prioridadId": 2,
  "observaciones": "Factura de servicios"
}
```

**SQL Query (verificar cliente)**:
```sql
SELECT Id FROM Clientes WHERE Id = ?
```

**SQL Query (insertar factura)**:
```sql
INSERT INTO Facturas (
    ClienteId,
    MontoTotal,
    SaldoPendiente,
    FechaEmision,
    FechaVencimiento,
    DiasVencido,
    estado_factura_id,
    prioridad_cobranza_id,
    numero_factura,
    Observaciones
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
```

**SQL Query (consultar factura creada)**:
```sql
SELECT
    f.Id, f.ClienteId, f.numero_factura, f.MontoTotal,
    f.SaldoPendiente, f.FechaEmision, f.FechaVencimiento,
    f.DiasVencido, f.UltimaGestion, f.Observaciones,
    f.CreatedAt, f.UpdatedAt,
    c.RazonSocial as ClienteRazonSocial,
    c.NombreComercial as ClienteNombreComercial,
    c.RFC as ClienteRFC,
    c.CorreoPrincipal as ClienteEmail,
    c.Telefono as ClienteTelefono,
    ef.codigo as EstadoCodigo, ef.id as EstadoId,
    pc.codigo as PrioridadCodigo, pc.id as PrioridadId
FROM Facturas f
INNER JOIN Clientes c ON f.ClienteId = c.Id
LEFT JOIN estados_factura ef ON f.estado_factura_id = ef.id
LEFT JOIN prioridades_cobranza pc ON f.prioridad_cobranza_id = pc.id
WHERE f.Id = ?
```

**Response 200**:
```json
{
  "success": true,
  "message": "Factura creada exitosamente",
  "factura": {
    "id": 123,
    "clienteId": 5,
    "numeroFactura": "F-001",
    "montoTotal": 10000.00,
    "saldoPendiente": 10000.00,
    "fechaEmision": "2024-01-01",
    "fechaVencimiento": "2024-02-01",
    "diasVencido": -15,
    "cliente": { ... },
    "estado": { ... },
    "prioridad": { ... }
  }
}
```

**Errores**:
- 400: ClienteId es requerido / MontoTotal debe ser mayor a 0 / FechaVencimiento es requerida
- 404: Cliente no encontrado
- 500: Error interno del servidor

---

### POST /api/facturas/actualizar-dias-vencidos
**Descripción**: Actualizar los días vencidos de todas las facturas

**Nota**: Este endpoint también usa conexión MySQL/compatible.

**SQL Query (actualizar)**:
```sql
UPDATE Facturas
SET DiasVencido = DATEDIFF(day, FechaVencimiento, GETDATE())
WHERE FechaVencimiento IS NOT NULL
```

**SQL Query (estadísticas)**:
```sql
SELECT
    COUNT(*) as totalFacturas,
    COUNT(CASE WHEN DiasVencido > 0 THEN 1 END) as facturasVencidas,
    COUNT(CASE WHEN DiasVencido <= 0 THEN 1 END) as facturasVigentes,
    MIN(DiasVencido) as minDiasVencido,
    MAX(DiasVencido) as maxDiasVencido,
    AVG(DiasVencido) as promedioDiasVencido
FROM Facturas
WHERE FechaVencimiento IS NOT NULL
```

**Response 200**:
```json
{
  "success": true,
  "message": "Días vencidos actualizados correctamente",
  "estadisticas": {
    "totalFacturas": 150,
    "facturasVencidas": 80,
    "facturasVigentes": 70,
    "minDiasVencido": -30,
    "maxDiasVencido": 120,
    "promedioDiasVencido": 15
  }
}
```

**Errores**:
- 500: Error interno del servidor

---

## Agentes

### GET /api/agentes
**Descripción**: Obtener listado de agentes (usuarios) de una organización

**Query Params**:
- `organizacionId` (requerido): ID de la organización

**SQL Query**:
```sql
SELECT DISTINCT
    u.Id as value,
    CONCAT(u.Nombre, ' ', u.Apellido) as text,
    u.Nombre,
    u.Apellido
FROM Usuarios u
INNER JOIN Usuario_Organizacion uo ON u.Id = uo.UsuarioId
WHERE uo.OrganizacionId = @organizacionId
    AND u.Activo = 1
ORDER BY u.Nombre, u.Apellido
```

**Response 200**:
```json
[
  {
    "value": 5,
    "text": "Juan Pérez",
    "Nombre": "Juan",
    "Apellido": "Pérez"
  }
]
```

**Errores**:
- 400: organizacionId es requerido
- 500: Error interno del servidor

---

## Dashboard

### GET /api/dashboard/stats
**Descripción**: Obtener estadísticas para el dashboard

**Query Params**:
- `organizacionId` (opcional, default: "3"): ID de la organización

**SQL Query (clientes por agente)**:
```sql
SELECT
    CONCAT(u.Nombre, ' ', u.Apellido) as agente,
    COUNT(ac.ClienteId) as total_clientes
FROM Agentes_Clientes ac
INNER JOIN Usuarios u ON ac.UsuarioId = u.Id
INNER JOIN Usuario_Organizacion uo ON u.Id = uo.UsuarioId
WHERE uo.OrganizacionId = @organizacionId
GROUP BY u.Id, u.Nombre, u.Apellido
ORDER BY total_clientes DESC
```

**SQL Query (total clientes)**:
```sql
SELECT COUNT(*) as total
FROM Clientes c
WHERE c.OrganizacionId = @organizacionId
```

**SQL Query (clientes con/sin agente)**:
```sql
SELECT
    CASE
        WHEN ac.ClienteId IS NOT NULL THEN 'Con Agente'
        ELSE 'Sin Agente'
    END as estado,
    COUNT(*) as total
FROM Clientes c
LEFT JOIN Agentes_Clientes ac ON c.Id = ac.ClienteId
WHERE c.OrganizacionId = @organizacionId
GROUP BY CASE
    WHEN ac.ClienteId IS NOT NULL THEN 'Con Agente'
    ELSE 'Sin Agente'
END
```

**SQL Query (verificar si existe tabla Facturas)**:
```sql
SELECT COUNT(*) as existe
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_NAME = 'Facturas'
```

**SQL Query (facturas por estado - si existe tabla)**:
```sql
SELECT
    ISNULL(f.Estado, 'Pendiente') as estado,
    COUNT(*) as total,
    ISNULL(SUM(f.Total), 0) as monto_total
FROM Facturas f
INNER JOIN Clientes c ON f.ClienteId = c.Id
WHERE c.OrganizacionId = @organizacionId
GROUP BY f.Estado
```

**SQL Query (montos por mes - últimos 6 meses)**:
```sql
SELECT
    FORMAT(f.FechaEmision, 'MMM yyyy') as mes,
    MONTH(f.FechaEmision) as mes_num,
    YEAR(f.FechaEmision) as año,
    SUM(f.Total) as total_facturado
FROM Facturas f
INNER JOIN Clientes c ON f.ClienteId = c.Id
WHERE c.OrganizacionId = @organizacionId
    AND f.FechaEmision >= DATEADD(month, -6, GETDATE())
GROUP BY YEAR(f.FechaEmision), MONTH(f.FechaEmision), FORMAT(f.FechaEmision, 'MMM yyyy')
ORDER BY año, mes_num
```

**Response 200**:
```json
{
  "clientes_por_agente": [
    {
      "agente": "Juan Pérez",
      "total_clientes": 25
    }
  ],
  "total_clientes": 100,
  "clientes_asignacion": [
    {
      "estado": "Con Agente",
      "total": 75
    },
    {
      "estado": "Sin Agente",
      "total": 25
    }
  ],
  "facturas_por_estado": [
    {
      "estado": "Pendiente",
      "total": 50,
      "monto_total": 250000.00
    }
  ],
  "montos_facturas": [
    {
      "mes": "Ene 2024",
      "mes_num": 1,
      "año": 2024,
      "total_facturado": 100000.00
    }
  ],
  "tiene_facturas": true
}
```

**Errores**:
- 500: Error interno del servidor

---

## Catálogos

### GET /api/paises
**Descripción**: Obtener listado de países

**SQL Query**:
```sql
SELECT ID, NombrePais
FROM Paises
ORDER BY ID
```

**Response 200**:
```json
[
  {
    "ID": 1,
    "NombrePais": "México"
  }
]
```

**Errores**:
- 500: Error al obtener los países

---

### GET /api/estados
**Descripción**: Obtener listado de estados por país

**Query Params**:
- `paisId` (requerido): ID del país

**SQL Query (VULNERABLE - SQL Injection)**:
```sql
-- NOTA: Esta query tiene SQL injection, debe corregirse usando parámetros preparados
SELECT ID, ClaveEstado, NombreEstado, PaisID
FROM Estados
WHERE PaisID = ${paisId}  -- ⚠️ VULNERABLE
ORDER BY NombreEstado
```

**SQL Query (CORREGIDA)**:
```sql
SELECT ID, ClaveEstado, NombreEstado, PaisID
FROM Estados
WHERE PaisID = @paisId  -- ✓ Usar parámetros preparados
ORDER BY NombreEstado
```

**Response 200**:
```json
[
  {
    "ID": 1,
    "ClaveEstado": "AGS",
    "NombreEstado": "Aguascalientes",
    "PaisID": 1
  }
]
```

**Errores**:
- 400: ID del país es requerido
- 500: Error al obtener los estados

---

### GET /api/regimen
**Descripción**: Obtener listado de regímenes fiscales

**SQL Query**:
```sql
SELECT ID_Regimen, Codigo, Descripcion
FROM Regimen
ORDER BY ID_Regimen
```

**Response 200**:
```json
[
  {
    "ID_Regimen": 601,
    "Codigo": "601",
    "Descripcion": "General de Ley Personas Morales"
  }
]
```

**Errores**:
- 500: Error al obtener los regímenes fiscales

---

### GET /api/configuracion/organizacion/[id]
**Descripción**: Obtener configuración completa de una organización

**Nota**: Este endpoint usa conexión MySQL/compatible.

**URL Params**:
- `id`: ID de la organización

**SQL Query (configuración de organización)**:
```sql
SELECT
    co.id,
    co.organizacion_id,
    co.nombre_comercial,
    co.email_corporativo,
    co.telefono,
    co.calle,
    co.numero_exterior,
    co.numero_interior,
    co.colonia,
    co.ciudad,
    co.estado,
    co.codigo_postal,
    co.pais,
    co.regimen_fiscal,
    co.activa,
    co.fecha_creacion,
    co.fecha_actualizacion,
    o.RazonSocial,
    o.RFC,
    r.Codigo as regimen_codigo,
    r.Descripcion as regimen_descripcion
FROM configuracion_organizacion co
INNER JOIN Organizaciones o ON co.organizacion_id = o.Id
LEFT JOIN Regimen r ON co.regimen_fiscal = r.ID_Regimen
WHERE co.organizacion_id = ?
```

**SQL Query (configuración de cobranza)**:
```sql
SELECT
    DiasGracia,
    EscalamientoDias,
    EnvioAutomaticoRecordatorios,
    DiasRecordatorioPrevio
FROM ConfiguracionCobranza
WHERE OrganizacionId = ?
```

**Response 200**:
```json
{
  "success": true,
  "configuracion": {
    "id": 1,
    "organizacionId": 3,
    "razonSocial": "Mi Empresa SA",
    "rfc": "MEE990101A12",
    "nombreComercial": "Mi Empresa",
    "emailCorporativo": "contacto@miempresa.com",
    "telefono": "5551234567",
    "direccion": {
      "calle": "Av. Principal",
      "numeroExterior": "123",
      "numeroInterior": "A",
      "colonia": "Centro",
      "ciudad": "Ciudad de México",
      "estado": "CDMX",
      "codigoPostal": "06000",
      "pais": "México"
    },
    "datosFiscales": {
      "regimenFiscal": 601,
      "regimenCodigo": "601",
      "regimenDescripcion": "General de Ley Personas Morales"
    },
    "activa": true,
    "fechaCreacion": "2024-01-01T10:00:00",
    "fechaActualizacion": "2024-01-15T14:30:00"
  },
  "configCobranza": {
    "diasGracia": 3,
    "escalonamiento": {
      "primer_recordatorio": 7,
      "segundo_recordatorio": 15,
      "gestion_telefonica": 30,
      "proceso_legal": 90
    },
    "envioAutomaticoRecordatorios": true,
    "diasRecordatorioPrevio": 3,
    "horariosEnvio": {
      "horaInicio": "09:00",
      "horaFin": "18:00",
      "diasSemana": ["lunes", "martes", "miércoles", "jueves", "viernes"]
    }
  },
  "exists": true
}
```

**Errores**:
- 400: ID de organización inválido
- 500: Error interno del servidor

---

### POST /api/configuracion/organizacion/[id]
**Descripción**: Crear o actualizar configuración de una organización

**Nota**: Este endpoint usa conexión MySQL/compatible.

**URL Params**:
- `id`: ID de la organización

**SQL Query (verificar si existe configuración)**:
```sql
SELECT id FROM configuracion_organizacion WHERE organizacion_id = ?
```

**SQL Query (actualizar configuración existente)**:
```sql
UPDATE configuracion_organizacion SET
    nombre_comercial = ?,
    email_corporativo = ?,
    telefono = ?,
    calle = ?,
    numero_exterior = ?,
    numero_interior = ?,
    colonia = ?,
    ciudad = ?,
    estado = ?,
    codigo_postal = ?,
    pais = ?,
    regimen_fiscal = ?,
    activa = ?,
    fecha_actualizacion = ?
WHERE organizacion_id = ?
```

**SQL Query (crear nueva configuración)**:
```sql
INSERT INTO configuracion_organizacion (
    organizacion_id, nombre_comercial, email_corporativo, telefono,
    calle, numero_exterior, numero_interior, colonia, ciudad, estado,
    codigo_postal, pais, regimen_fiscal, activa, fecha_creacion, fecha_actualizacion
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
```

**SQL Query (verificar configuración de cobranza)**:
```sql
SELECT Id FROM ConfiguracionCobranza WHERE OrganizacionId = ?
```

**SQL Query (actualizar configuración de cobranza)**:
```sql
UPDATE ConfiguracionCobranza SET
    DiasGracia = ?,
    EscalamientoDias = ?,
    EnvioAutomaticoRecordatorios = ?,
    DiasRecordatorioPrevio = ?
WHERE OrganizacionId = ?
```

**SQL Query (crear configuración de cobranza)**:
```sql
INSERT INTO ConfiguracionCobranza (
    OrganizacionId, DiasGracia, EscalamientoDias,
    EnvioAutomaticoRecordatorios, DiasRecordatorioPrevio
) VALUES (?, ?, ?, ?, ?)
```

**Request Body**:
```json
{
  "nombreComercial": "Mi Empresa",
  "emailCorporativo": "contacto@miempresa.com",
  "telefono": "5551234567",
  "direccion": {
    "calle": "Av. Principal",
    "numeroExterior": "123",
    "numeroInterior": "A",
    "colonia": "Centro",
    "ciudad": "Ciudad de México",
    "estado": "CDMX",
    "codigoPostal": "06000",
    "pais": "México"
  },
  "datosFiscales": {
    "regimenFiscal": 601
  },
  "activa": true,
  "configCobranza": {
    "diasGracia": 3,
    "escalonamiento": {
      "primer_recordatorio": 7,
      "segundo_recordatorio": 15,
      "gestion_telefonica": 30,
      "proceso_legal": 90
    },
    "envioAutomaticoRecordatorios": true,
    "diasRecordatorioPrevio": 3
  }
}
```

**Response 200**:
```json
{
  "success": true,
  "message": "Configuración guardada exitosamente"
}
```

**Errores**:
- 400: ID de organización inválido
- 500: Error interno del servidor

---

## Base de Datos

### Tablas Principales Utilizadas

1. **Usuarios**
   - Campos: Id, Correo, Contrasena, Nombre, Apellido, Activo

2. **Organizaciones**
   - Campos: Id, RazonSocial, RFC

3. **Usuario_Organizacion**
   - Campos: Id, UsuarioId, OrganizacionId, RolId

4. **Roles**
   - Campos: Id, Nombre

5. **Clientes**
   - Campos: Id, NombreComercial, RazonSocial, RFC, CondicionesPago, CorreoPrincipal, Telefono, OrganizacionId

6. **Agentes_Clientes**
   - Campos: Id, ClienteId, UsuarioId, RolAgente, CreatedAt, UpdatedAt

7. **Facturas**
   - Campos: Id, ClienteId, numero_factura, MontoTotal, SaldoPendiente, FechaEmision, FechaVencimiento, DiasVencido, UltimaGestion, Observaciones, estado_factura_id, prioridad_cobranza_id, CreatedAt, UpdatedAt

8. **estados_factura**
   - Campos: id, codigo

9. **prioridades_cobranza**
   - Campos: id, codigo

10. **configuracion_organizacion**
    - Campos: id, organizacion_id, nombre_comercial, email_corporativo, telefono, calle, numero_exterior, numero_interior, colonia, ciudad, estado, codigo_postal, pais, regimen_fiscal, activa, fecha_creacion, fecha_actualizacion

11. **ConfiguracionCobranza**
    - Campos: Id, OrganizacionId, DiasGracia, EscalamientoDias, EnvioAutomaticoRecordatorios, DiasRecordatorioPrevio

12. **Paises**
    - Campos: ID, NombrePais

13. **Estados**
    - Campos: ID, ClaveEstado, NombreEstado, PaisID

14. **Regimen**
    - Campos: ID_Regimen, Codigo, Descripcion

---

## Notas Importantes

1. **Autenticación**: Actualmente se usa JWT pero la contraseña no está hasheada (se compara en texto plano). Recomendado implementar bcrypt.

2. **Multi-tenant**: La mayoría de los endpoints requieren `organizacionId` para filtrar datos por organización.

3. **SQL Injection**: El endpoint `/api/estados` tiene una vulnerabilidad de SQL injection en la línea 19. Debe usar parámetros preparados.

4. **Conexión DB**: Se usan dos conexiones diferentes:
   - `getConnection()` de `$lib/server/db` (SQL Server con mssql)
   - `db` de `$lib/server/db` (parece ser MySQL o compatible)

5. **Paginación**: La mayoría de endpoints con listas soportan paginación mediante `page` y `limit/pageSize`.

6. **Formato de Respuesta**: No hay un formato estándar. Algunos usan `{ success: true, ... }`, otros solo retornan los datos directamente.

---

## Recomendaciones para la Migración

1. **Estandarizar respuestas**: Usar siempre formato `{ success: boolean, data?: any, error?: string }`
2. **Agregar validación de datos**: Implementar schemas con Zod o similar
3. **Implementar autenticación JWT robusta**: Con refresh tokens
4. **Hashear contraseñas**: Usar bcrypt o argon2
5. **Middleware de autenticación**: Para validar tokens en todas las rutas protegidas
6. **Manejo de errores centralizado**: Crear un middleware de error handling
7. **Logging**: Implementar logger centralizado (Winston, Pino)
8. **Rate limiting**: Para prevenir abuso de la API
9. **Documentación**: Implementar Swagger/OpenAPI
10. **Tests**: Agregar tests unitarios e integración

---

**Fecha de generación**: 2025-10-01
**Total de endpoints**: 23 (8 GET, 7 POST, 2 GET/POST dinámicos)
