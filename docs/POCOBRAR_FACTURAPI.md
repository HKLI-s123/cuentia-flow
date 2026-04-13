# Módulo de Creación de Facturas CFDI 4.0 con FacturaAPI

## 📋 Descripción

Este módulo permite crear facturas CFDI 4.0 directamente en FacturaAPI desde el módulo "Por Cobrar". Las facturas se timbran automáticamente (o de forma asíncrona si se requiere) y se envían al SAT.

**Importante**: Todos los clientes DEBEN estar registrados en FacturaAPI para emitir facturas. Si un cliente no tiene `IdClienteFacturaAPI`, la creación de la factura fallará con un error claro.

## 🎯 Flujo General

```
┌─ Usuario abre "Por Cobrar"
│
├─ Selecciona cliente (ya debe estar registrado en FacturaAPI)
├─ Completa items/conceptos, forma de pago, etc.
├─ Click en "Emitir Factura"
│
├─ POST /api/facturas/crear-facturapi
│   ├─ Validar autenticación ✓
│   ├─ Validar datos (items, payment_form) ✓
│   ├─ Verificar cliente existe en BD local ✓
│   ├─ Verificar cliente está en FacturaAPI ✓
│   ├─ Validar user tiene acceso a organización ✓
│   ├─ Obtener API Key de organización ✓
│   ├─ Crear factura en FacturaAPI ✓
│   ├─ Retornar ID, UUID, archivos, etc. ✓
│   └─ (Opcional) Guardar referencia en BD local
│
└─ Mostrar factura timbrada con PDF y XML
```

## 🔌 Endpoint

**URL**: `POST /api/facturas`

**Autenticación**: Requerida (HTTP nur con Authorization header requerido)

**Content-Type**: `application/json`

## 📥 Request Body

```json
{
  "clienteId": 123,
  "conceptos": [
    {
      "nombre": "Servicio de consultoría",
      "cantidad": 2,
      "precioUnitario": 500.00,
      "monedaProducto": "MXN"
    },
    {
      "nombre": "Licencia de software",
      "cantidad": 1,
      "precioUnitario": 1000.00,
      "monedaProducto": "MXN"
    }
  ],
  "moneda": "MXN",
  "condicionesPago": "30-dias"
}
```

### Parámetros Requeridos

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `clienteId` | integer | ID del cliente en BD local (debe estar en FacturaAPI) |
| `conceptos` | array | Array de conceptos/líneas de factura |

### Estructura de Conceptos

Cada concepto debe tener:

```json
{
  "nombre": string,              // Descripción del concepto
  "cantidad": number,            // Cantidad
  "precioUnitario": number,      // Precio unitario
  "monedaProducto": string       // Moneda (MXN, USD, etc)
}
```

### Parámetros Opcionales

| Parámetro | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `moneda` | string | "MXN" | Moneda de la factura |
| `condicionesPago` | string | "30-dias" | Condiciones: "contado", "7-dias", "15-dias", "30-dias", "45-dias", "60-dias", "90-dias" |
| `fechaEmision` | string | today | Fecha en formato YYYY-MM-DD |

## 📤 Response (201)

### Éxito

```json
{
  "success": true,
  "message": "Factura creada exitosamente en FacturaAPI",
  "factura": {
    "idFacturaAPI": "60c5f234567890abcdef1234",
    "folio": 1001,
    "serie": "F",
    "status": "valid",
    "uuid": "32a74f12-b5ed-4a5f-aa35-a26d1d2c1234",
    "cliente": {
      "id": 123,
      "razonSocial": "ACME Corp",
      "nombreComercial": "ACME",
      "rfc": "ACM990101ABC",
      "email": "contacto@acme.com"
    },
    "items": 2,
    "montoTotal": "2760.00",
    "moneda": "MXN",
    "formaPago": "06",
    "metodoPago": "PUE",
    "archivos": {
      "pdf": "https://facturapi.io/v2/invoices/60c5f.../pdf",
      "xml": "https://facturapi.io/v2/invoices/60c5f.../xml"
    }
  }
}
```

### Error - Cliente sin FacturaAPI (422)

```json
{
  "success": false,
  "error": "Cliente no registrado en FacturaAPI",
  "detalles": "El cliente \"123\" no está registrado en FacturaAPI. Para emitir una factura, el cliente debe estar previamente sincronizado con FacturaAPI. Verifica que el cliente fue creado correctamente.",
  "codigo_error": "CLIENTE_SIN_FACTURAPI"
}
```

**Solución**: Verifique que el cliente fue creado en el módulo de "Clientes" y sincronizado correctamente con FacturaAPI (debe tener `IdClienteFacturaAPI`).

### Error - Validación (400)

```json
{
  "success": false,
  "error": "Debe incluir al menos un concepto"
}
```

## 🔐 Seguridad y Validaciones

1. **Autenticación requerida**: Bearer token válido
2. **Verificación de permisos**: Solo administradores (RolId = 3) pueden crear facturas
3. **Aislamiento de organizaciones**: Usuario solo puede crear facturas en sus organizaciones
4. **Validación de cliente**: Cliente debe estar registrado en BD local Y en FacturaAPI
5. **Validación de datos**: Todos los parámetros requeridos se validan antes de llamar a FacturaAPI

## 📊 Códigos de Forma de Pago (payment_form)

```
01 - Efectivo
02 - Cheque nominativo
03 - Transferencia electrónica de fondos
04 - Tarjeta de crédito
05 - Monedero electrónico
06 - Dinero electrónico
08 - Vales de despensa
12 - Dación en pago
13 - Pago por subrogación
14 - Pago por consignación
15 - Condonación
17 - Cheque
23 - Especie o equivalente
24 - Carta de crédito / Crédito documentario
25 - Nota de crédito
26 - Nota de débito
27 - Consentimiento para cobro con tercero
28 - Transferencia de fondos
29 - Mixto
30 - Orden de compra
31 - Folio/ Número de operación
32 - Transacción sin identificación de tercero
33 - Crédito al sistema de transferencias, disponi...
34 - Pago en divisas
```

## 🎓 Ejemplos de Uso

### Ejemplo 1: Factura Simple (una línea)

```bash
curl -X POST http://localhost:5173/api/facturas \
  -H "Content-Type: application/json" \
  -d '{
    "clienteId": 123,
    "conceptos": [
      {
        "nombre": "Servicio de Consultoría",
        "cantidad": 1,
        "precioUnitario": 1500.00,
        "monedaProducto": "MXN"
      }
    ],
    "moneda": "MXN",
    "condicionesPago": "contado"
  }'
```

**Resultado**: Factura se crea y timbra en FacturaAPI, se retorna información con UUID y archivos.

### Ejemplo 2: Factura con Múltiples Conceptos

```bash
curl -X POST http://localhost:5173/api/facturas \
  -H "Content-Type: application/json" \
  -d '{
    "clienteId": 456,
    "conceptos": [
      {
        "nombre": "Licencia Mensual - Software A",
        "cantidad": 3,
        "precioUnitario": 500.00,
        "monedaProducto": "MXN"
      },
      {
        "nombre": "Soporte Técnico por Hora",
        "cantidad": 2,
        "precioUnitario": 250.00,
        "monedaProducto": "MXN"
      }
    ],
    "moneda": "MXN",
    "condicionesPago": "30-dias"
  }'
```

**Cálculo**:
- Concepto 1: 3 × 500 = 1,500 + IVA (16%) = 1,740
- Concepto 2: 2 × 250 = 500 + IVA (16%) = 580
- **Total: 2,320**

### Ejemplo 3: Cliente sin FacturaAPI (Error)

```bash
curl -X POST http://localhost:5173/api/facturas \
  -H "Content-Type: application/json" \
  -d '{
    "clienteId": 999,
    "conceptos": [
      {
        "nombre": "Servicio",
        "cantidad": 1,
        "precioUnitario": 1000.00,
        "monedaProducto": "MXN"
      }
    ]
  }'
```

**Respuesta (422)**:
```json
{
  "success": false,
  "error": "Cliente no registrado en FacturaAPI",
  "codigo_error": "CLIENTE_SIN_FACTURAPI"
}
```

## 🔗 Integración con UI (Por Cobrar)

En el componente `ModalNuevaFactura.svelte`:

```typescript
async function crearFactura() {
  try {
    const response = await fetch('/api/facturas/crear-facturapi', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clienteId: clienteSeleccionado,
        items: items,
        payment_form: formaPago,
        payment_method: metodoPago,
        currency: moneda,
        conditions: condiciones,
        async: facturacionAsincrona
      })
    });

    const data = await response.json();
    
    if (data.success) {
      // Mostrar factura creada
      console.log('Factura creada:', data.factura);
      
      // Dar opción de descargar PDF
      window.open(data.factura.archivos.pdf, '_blank');
    } else {
      // Mostrar error
      alertaError(data.error);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}
```

## 🚀 Próximas Mejoras

- [ ] Guardar factura en BD local después de crear en FacturaAPI
- [ ] Webhooks para notificaciones de cambio de status (async)
- [ ] UI mejorada con validación live de items
- [ ] Búsqueda de productos SAT en ModalNuevaFactura
- [ ] Descarga automática de PDF al crear
- [ ] Envío de factura por email al cliente
- [ ] Historial de intentos fallidos
- [ ] Facturación global (S01)
- [ ] Complementos de pago (pagos parciales)

## 📝 Notas Técnicas

### Claves de Producto SAT (product_key)

Las claves deben ser de 8 dígitos según el catálogo del SAT. Ejemplos:

```
60131324 - Venta de servicios y reparaciones
80131324 - Otros servicios profesionales
84141600 - Servicios profesionales de consultoría
```

Ver: [Catálogo de Productos SAT](https://www.facturapi.io/)

### Peso Máximo de Factura

- Máximo 5,000 items por factura
- Si necesita más, dividir en múltiples facturas

### Monedas Soportadas

- MXN (Pesos Mexicanos)
- USD (Dólares Estadounidenses)
- EUR (Euros)
- Y más según catálogo SAT

### Estados de la Factura

- `pending` - Esperando timbrado del SAT (o asíncrono)
- `valid` - Timbrada correctamente
- `canceled` - Cancelada
- `error` - Error en timbrado
