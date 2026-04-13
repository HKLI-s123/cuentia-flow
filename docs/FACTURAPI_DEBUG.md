# Debugging FacturaAPI - Guía de Logs

## ¿Qué está pasando?

He agregado logs detallados en varios puntos para debuggear el problema. Cuando intentes crear un cliente nuevamente, verás un flujo de logs que te mostrará exactamente dónde está fallando.

## Logs esperados y qué significan

### 1. Iniciando sincronización
```
[CLIENTES POST] Iniciando sincronización con FacturaAPI para cliente 496
```
✅ El sistema empezó a intentar sincronizar con FacturaAPI

---

### 2. Consulta de organización
```
[CLIENTES POST] Consulta de organización completada. Resultados: [
  { IdFacturaAPI: '5a2a307be93a2f00129ea035', ApiKeyFacturaAPI: null }
]
```
✅ Se recuperaron los datos de la organización

**Los datos dicen:**
- `IdFacturaAPI`: ID de tu organización en FacturaAPI (debería ser tipo `12abc...`)
- `ApiKeyFacturaAPI`: null = no está guardada en BD aún

---

### 3. Intentando obtener API Key
```
[FACTURAPI] obtenerApiKeyFacturaAPI llamada con: { idFacturaAPIOrganizacion: '5a2a307be93a2f00129ea035' }
[FACTURAPI] FACTURAPI_SECRET_USER_KEY está configurada. Longitud: 28
[FACTURAPI] URL de solicitud: https://www.facturapi.io/v2/organizations/5a2a307be93a2f00129ea035/apikeys/live
[FACTURAPI] Respuesta recibida. Status: 200
```

**¿Qué buscar aquí?**

- ❌ **Si ves**: `FACTURAPI_SECRET_USER_KEY no está configurada`
  - **Problema**: La variable de entorno no está configurada
  - **Solución**: Agregar a `.env.local`:
    ```env
    FACTURAPI_SECRET_USER_KEY=sk_user_XXXXXXXXXXXX
    ```

- ❌ **Si ves**: `Status: 401`
  - **Problema**: La SecretUserKey es inválida
  - **Solución**: Verifica que copiaste correctamente la SecretUserKey de FacturaAPI

- ❌ **Si ves**: `Status: 404`
  - **Problema**: El ID de organización no existe en FacturaAPI
  - **Solución**: Verifica que el `IdFacturaAPI` guardado en BD sea correcto

- ❌ **Si ves**: `Status: 400 o 403`
  - **Problema**: Otro error de FacturaAPI
  - **Busca el siguiente log para detalles**

---

### 4. Respuesta de FacturaAPI
```
[FACTURAPI] Respuesta parseada: {
  tieneApiKeys: true,
  isArray: true,
  longitud: 1,
  keys: [ 'api_keys', 'pagination' ]
}
```

**¿Qué significa?**
- ✅ `tieneApiKeys: true` - Excelente, hay api_keys en la respuesta
- ✅ `isArray: true` - Están formateadas como array
- ✅ `longitud: 1` - Hay al menos una key disponible

**❌ Si ves `tieneApiKeys: false`:**
- La respuesta no tiene campo `api_keys`
- Busca en los logs anteriores un error de FacturaAPI con más detalles

---

### 5. API Key extraída
```
[FACTURAPI] API Key extraída. Longitud: 28
[FACTURAPI] API Key obtenida exitosamente para organización: 5a2a307be93a2f00129ea035
```
✅ La API Key se obtuvo y guardará en BD

---

### 6. Guardando en BD
```
[CLIENTES POST] API Key guardada en BD para organización 45
```
✅ Ahora futuras solicitudes usarán la key de la BD

---

## Checklist de debuggeo

Si no ves los logs esperados, revisa:

### ☐ ¿Está configurada FACTURAPI_SECRET_USER_KEY?
```powershell
# En tu .env.local (o donde tengas las variables)
cat .env.local | grep FACTURAPI_SECRET_USER_KEY
```

### ☐ ¿Tiene IdFacturaAPI la organización en BD?
```sql
SELECT Id, IdFacturaAPI, ApiKeyFacturaAPI 
FROM Organizaciones 
WHERE Id = 45;
```

Debería ver algo como:
```
Id    IdFacturaAPI              ApiKeyFacturaAPI
45    5a2a307be93a2f00129...   NULL
```

Si `IdFacturaAPI` es NULL, ejecuta:
```sql
UPDATE Organizaciones 
SET IdFacturaAPI = '5a2a307be93a2f00129ea035'  -- Reemplaza con tu ID real
WHERE Id = 45;
```

### ☐ ¿Es válida la SecretUserKey?
- Debe empezar con `sk_user_`
- Debe tener al menos 28 caracteres
- Obtenerla de: https://www.facturapi.io/ → Settings → Account → SecretUserKey

### ☐ ¿Está online FacturaAPI?
Prueba en la terminal:
```bash
curl -H "Authorization: Bearer sk_user_XXXXXXXXXXXX" \
  https://www.facturapi.io/v2/organizations/5a2a307be93a2f00129ea035/apikeys/live
```

Debería retornar JSON con `api_keys`

---

## Cómo leer los logs completos

1. **Abre la consola del servidor** (donde corre Node.js)
2. **Intenta crear un cliente**
3. **Copia TODOS los logs** que empiezan con `[CLIENTES POST]` y `[FACTURAPI]`
4. **Compáralos con los ejemplos arriba**

## Ejemplo de flujo completo exitoso
```
[CLIENTES POST] userId: 51, organizacionId enviada: 45
[CLIENTES POST] Iniciando sincronización con FacturaAPI para cliente 496
[CLIENTES POST] Consulta de organización completada. Resultados: [{ IdFacturaAPI: '...' }]
[CLIENTES POST] Datos de organización: { IdFacturaAPI: '5a2a...', TieneApiKey: false }
[CLIENTES POST] Obteniendo API Key de FacturaAPI para organización 5a2a...
[FACTURAPI] obtenerApiKeyFacturaAPI llamada con: { idFacturaAPIOrganizacion: '5a2a...' }
[FACTURAPI] FACTURAPI_SECRET_USER_KEY está configurada. Longitud: 28
[FACTURAPI] URL de solicitud: https://www.facturapi.io/v2/organizations/5a2a.../apikeys/live
[FACTURAPI] Respuesta recibida. Status: 200
[FACTURAPI] Respuesta parseada: { tieneApiKeys: true, isArray: true, longitud: 1 }
[FACTURAPI] API Key extraída. Longitud: 28
[FACTURAPI] API Key obtenida exitosamente para organización: 5a2a...
[CLIENTES POST] Resultado de obtenerApiKeyFacturaAPI: { obtuvoKey: true, keyLength: 28 }
[CLIENTES POST] API Key guardada en BD para organización 45
[CLIENTES POST] Creando cliente en FacturaAPI con API Key...
[FACTURAPI] Creando cliente con datos: { legal_name: 'Test', tax_id: 'ABC...' }
[FACTURAPI] Cliente creado exitosamente: 5f123abc
[CLIENTES POST] Cliente sincronizado exitosamente con FacturaAPI: 5f123abc
```

---

## ¿Aún no funciona?

Comparte los logs exactos que ves cuando intentas crear el cliente, y podré identificar el problema específico.
