# Configuración FacturaAPI

## Pasos para configurar la sincronización con FacturaAPI

### 1. Obtener las claves de acceso

#### a) SecretUserKey (para acceder a datos de la organización)

1. Ir a https://www.facturapi.io/
2. Crear una cuenta si no la tienes
3. Ir a "Settings" → "Account" 
4. Copiar la **SecretUserKey**: `sk_user_XXXXXXXXXXXX`

#### b) ID de la Organización en FacturaAPI

1. En FacturaAPI, ir a "Organizations"
2. Copiar el **ID** de tu organización (ej: `5a2a307be93a2f00129ea035`)
3. Este se usará para obtener las Live API Keys

### 2. Agregar las variables de entorno

En tu archivo `.env.local`:

```env
# SecretUserKey para acceder a datos de organizaciones
FACTURAPI_SECRET_USER_KEY=sk_user_XXXXXXXXXXXX
```

**Importante:**
- Esta es la única key que necesitas en variables de entorno
- Las Live Keys se obtienen automáticamente por organización
- Nunca commitees estas keys al repositorio

### 3. Ejecutar los scripts SQL

Ejecuta ambos scripts SQL para agregar las columnas necesarias:

```bash
# Script 1: Agregar columnas a Clientes
sqlcmd -S YOUR_SERVER -U YOUR_USER -P YOUR_PASSWORD -d YOUR_DATABASE -i scripts/add-facturapi-columns.sql

# Script 2: Agregar columnas a Organizaciones
sqlcmd -S YOUR_SERVER -U YOUR_USER -P YOUR_PASSWORD -d YOUR_DATABASE -i scripts/add-facturapi-org-columns.sql
```

O manualmente:

```sql
-- Script 1: Clientes
ALTER TABLE Clientes
ADD IdClienteFacturaAPI NVARCHAR(100) NULL,
    FechaRegistroFacturaAPI DATETIME NULL,
    SincronizadoFacturaAPI BIT DEFAULT 0,
    ErrorSincronizacionFacturaAPI NVARCHAR(MAX) NULL;

-- Script 2: Organizaciones
ALTER TABLE Organizaciones
ADD IdFacturaAPI NVARCHAR(100) NULL,
    ApiKeyFacturaAPI NVARCHAR(100) NULL,
    FechaActualizacionFacturaAPI DATETIME NULL;
```

### 4. Registrar ID de FacturaAPI en la BD

Para cada organización, guardar el ID de FacturaAPI:

```sql
UPDATE Organizaciones
SET IdFacturaAPI = '5a2a307be93a2f00129ea035'  -- Reemplaza con el ID real
WHERE Id = 45;  -- Tu OrganizacionId
```

### 5. Cómo funciona la sincronización

**Cuando se crea un cliente:**

```
1. Cliente se guarda en BD local
   ↓
2. Sistema obtiene la organización y su IdFacturaAPI
   ↓
3. Si no tiene ApiKeyFacturaAPI en BD:
   - Usa FACTURAPI_SECRET_USER_KEY
   - Llama a FacturaAPI para obtener Live Key
   - Guarda la Live Key en BD para futuras operaciones
   ↓
4. Usa la Live Key para registrar el cliente en FacturaAPI
   ↓
5. Guarda IdClienteFacturaAPI en BD local
```

**Flujo detallado:**

```
POST /api/clientes
├── Validar usuario y organización
├── Crear cliente en BD local → clienteId = 123
├── Asignar agente (Agentes_Clientes)
├── Obtener organización con IdFacturaAPI
├── Si no tiene ApiKeyFacturaAPI:
│   ├── GET /v2/organizations/{IdFacturaAPI}/apikeys/live
│   │   (usando FACTURAPI_SECRET_USER_KEY)
│   └── Guardar ApiKeyFacturaAPI en BD
├── Crear cliente en FacturaAPI
│   (usando ApiKeyFacturaAPI obtenida)
├── Guardar IdClienteFacturaAPI en Clientes
└── Responder con datos del cliente
```

### 6. Campos en las tablas

**Tabla `Clientes`:**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `IdClienteFacturaAPI` | NVARCHAR(100) | ID único del cliente en FacturaAPI |
| `FechaRegistroFacturaAPI` | DATETIME | Fecha de registro en FacturaAPI |
| `SincronizadoFacturaAPI` | BIT | 1 si sincronizado, 0 si no |
| `ErrorSincronizacionFacturaAPI` | NVARCHAR(MAX) | Error si falló la sincronización |

**Tabla `Organizaciones`:**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `IdFacturaAPI` | NVARCHAR(100) | ID de la organización en FacturaAPI |
| `ApiKeyFacturaAPI` | NVARCHAR(100) | Live API Key (obtenida automáticamente) |
| `FechaActualizacionFacturaAPI` | DATETIME | Fecha de la última actualización |

### 7. Respuesta de creación de cliente

Éxito:

```json
{
  "message": "Cliente creado correctamente",
  "id": 123,
  "sincronizadoFacturaAPI": true,
  "idClienteFacturaAPI": "5f123abc456def"
}
```

Con error en FacturaAPI (pero cliente creado en BD):

```json
{
  "message": "Cliente creado correctamente",
  "id": 123,
  "sincronizadoFacturaAPI": false,
  "idClienteFacturaAPI": null,
  "advertencia": "Sincronización con FacturaAPI: Error al obtener API Key"
}
```

### 8. Debugging

**Revisar logs del servidor:**

La consola mostrará el flujo completo:

```
[CLIENTES POST] Iniciando sincronización con FacturaAPI para cliente 123
[FACTURAPI] Obteniendo API Key para organización: 5a2a307be93a2f00129ea035
[FACTURAPI] API Key obtenida exitosamente para organización: 5a2a307be93a2f00129ea035
[CLIENTES POST] API Key guardada en BD para organización 45
[FACTURAPI] Creando cliente con datos: {
  legal_name: "Mi Empresa",
  tax_id: "ABC123456789",
  tax_system: "601"
}
[FACTURAPI] Cliente creado exitosamente: 5f123abc456def
```

**Si hay error:**

```
[FACTURAPI] Error al obtener API Key: {
  status: 401,
  error: "Invalid secret user key"
}
```

### 9. Cache de API Keys

- Las API Keys se cachean en memoria por **1 hora**
- Esto evita llamadas repetidas a FacturaAPI
- El servidor se reinicia, el cache se limpia
- También se guardan en BD para persistencia

### 10. Validación de datos

FacturaAPI requiere:

- `legal_name` (RazonSocial o NombreComercial) **requerido**
- `tax_id` (RFC) **requerido**
- `tax_system` (Régimen Fiscal - ej: 601) **requerido**
- `address.zip` (Código Postal) **requerido**

### 11. Pruebas

1. **Configurar la SecretUserKey:**
   ```
   FACTURAPI_SECRET_USER_KEY=sk_user_XXXXXXXXXXXX
   ```

2. **Ejecutar scripts SQL:**
   ```sql
   -- Agregar columnas
   -- Actualizar Organizaciones con IdFacturaAPI
   UPDATE Organizaciones SET IdFacturaAPI = 'tu_id_aqui' WHERE Id = 45;
   ```

3. **Crear un cliente:**
   - RazonSocial: "Test Company"
   - RFC: "ABC123456789"
   - RegimenFiscalId: 603
   - CodigoPostal: "28001"

4. **Verificar:**
   - Respuesta incluye `idClienteFacturaAPI`
   - BD tiene el ID guardado
   - Logs muestran sincronización exitosa

### 12. Próximos pasos

- [ ] Actualizar cliente (PUT): Sincronizar cambios a FacturaAPI
- [ ] Eliminar cliente: Mantener registro en FacturaAPI
- [ ] Emitir factura: Usar `IdClienteFacturaAPI` en lugar de datos completos



