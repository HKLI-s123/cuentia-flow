# Guía de Integración: Crear Facturas con FacturaAPI en Por Cobrar

## 🎯 Objetivo

Integrar el endpoint `/api/facturas` (existente) para emitir facturas CFDI 4.0 timbradas directamente en FacturaAPI desde el módulo "Por Cobrar".

**Importante**: El cliente DEBE estar registrado en FacturaAPI (tener `IdClienteFacturaAPI`). Si no, la creación fallará con error 422.

## 📦 Componentes Afectados

1. **Endpoint**: `POST /api/facturas` (ACTUALIZADO - ahora requiere FacturaAPI)
2. **Módulo**: `src/lib/server/facturapi.ts` (ACTUALIZADO - función `crearFacturaFacturaAPI`)
3. **Validación**: Nuevo check para verificar que cliente existe en FacturaAPI
4. **UI**: `src/routes/dashboard/por-cobrar/ModalNuevaFactura.svelte` (A ACTUALIZAR)

## 🔄 Flujo Propuesto

```
Usuario en "Por Cobrar"
    ↓
Selecciona cliente (debe estar en FacturaAPI)
    ↓
Agrega conceptos
    ↓
Click "Emitir Factura"
    ↓
POST /api/facturas
    │
    ├─ Validar cliente existe en FacturaAPI
    │  └─ Si NO: Error 422 "Cliente no registrado en FacturaAPI"
    │
    ├─ Crear factura en BD local  
    ├─ Convertir conceptos → items (formato FacturaAPI)
    ├─ Crear en FacturaAPI
    ├─ Guardar UUID en BD
    │
    ↓
Mostrar: UUID, número de folio, descarga PDF/XML
```

## 🚀 Implementación

El endpoint `POST /api/facturas` ya existe. Se han realizado los siguientes cambios:

1. **Validación agregada**: Verifica que el cliente tiene `IdClienteFacturaAPI`
   - Si NO: Retorna error 422 con mensaje claro
   - Si SÍ: Procede a crear factura en FacturaAPI

2. **Conversión interna**: Los `conceptos` se convierten a formato `items` de FacturaAPI

3. **Sincronización**: La factura se crea en:
   - BD local (para historial y control)
   - FacturaAPI (para obtener UUID, PDF, XML)

### Cambios Técnicos

**Archivo**: `src/routes/api/facturas/+server.ts`

Se agregó validación (línea ~350):

```typescript
// VALIDACIÓN IMPORTANTE: El cliente debe estar registrado en FacturaAPI
if (!cliente.IdClienteFacturaAPI) {
  return json({
    success: false,
    error: 'Cliente no registrado en FacturaAPI',
    detalles: `El cliente no está registrado en FacturaAPI. Para emitir una factura, el cliente debe estar previamente sincronizado con FacturaAPI.`,
    codigo_error: 'CLIENTE_SIN_FACTURAPI'
  }, { status: 422 });
}
```

**Eliminado**: Endpoint redundante `/api/facturas/crear-facturapi`

## 📋 Checklist de Integración

- [x] Función `crearFacturaFacturaAPI()` creada en `facturapi.ts`
- [x] Validación agregada a `POST /api/facturas`
- [x] Verifica que cliente existe en FacturaAPI
- [x] Endpoint redundante eliminado
- [ ] El modal `ModalNuevaFactura.svelte` existente ya captura conceptos
- [ ] Validar que cliente tiene `IdClienteFacturaAPI` (mostrar warning si no)
- [ ] Actualizar POST en `+page.svelte` para llamar con conceptos

## 🧪 Testing

### Caso 1: Crear factura exitosamente

1. Ir a "Por Cobrar"
2. Click "Nueva Factura"
3. Seleccionar cliente que está en FacturaAPI
4. Agregar conceptos
5. Click "Guardar"
6. Esperado: Factura creada, UUID visible, PDF disponible

### Caso 2: Cliente sin FacturaAPI

1. Seleccionar cliente que NO está en FacturaAPI
2. Agregar conceptos
3. Click "Guardar"
4. Esperado: Error 422 "Cliente no registrado en FacturaAPI"

### Caso 3: Validaciones

1. Sin cliente: Error "ClienteId es requerido"
2. Sin conceptos: Error "Debe incluir al menos un concepto"
3. Monedas diferentes: Error específico por concepto

## 📊 Monitoreo Posterior

Después de implementar, monitorear:

- Logs en `/api/facturas`
- Validación "CLIENTE_SIN_FACTURAPI"
- UUID de facturas creadas
- Errores de FacturaAPI
- Facturas sincronizadas correctamente en BD local
