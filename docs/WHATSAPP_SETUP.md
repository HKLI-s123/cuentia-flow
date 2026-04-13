# 🔐 Configuración de WhatsApp - Variables de Entorno

Agregar al archivo `.env` (crear si no existe):

```bash
# ============================================
# WHATSAPP - Encriptación de Sesiones Baileys
# ============================================

# Clave de encriptación (genera una nueva con: openssl rand -hex 16)
WHATSAPP_ENCRYPTION_KEY=tu_clave_encriptacion_de_32_caracteres_aqui

# Vector de inicialización (genera una nueva con: openssl rand -hex 8)
WHATSAPP_ENCRYPTION_IV=tu_iv_de_16_caracteres_aqui
```

## Cómo generar claves seguras:

### Opción 1: Usar OpenSSL
```bash
# Clave (32 bytes = 64 caracteres hex)
openssl rand -hex 32

# IV (16 bytes = 32 caracteres hex)
openssl rand -hex 16
```

### Opción 2: Usar Node.js
```javascript
const crypto = require('crypto');
console.log('KEY:', crypto.randomBytes(32).toString('hex'));
console.log('IV:', crypto.randomBytes(16).toString('hex'));
```

### Opción 3: Valores por defecto (⚠️ SOLO PARA DESARROLLO)
Si no defines variables, se usarán valores por defecto inseguros.

```bash
WHATSAPP_ENCRYPTION_KEY=cobranza-app-default-key-change-me!
WHATSAPP_ENCRYPTION_IV=default-iv-16byt
```

## ⚠️ IMPORTANTE - Consideraciones de Seguridad:

1. **Guarda las credenciales seguras** - Las claves de encriptación deben guardarse en un gestor de secretos
2. **No commitees .env a Git** - Añade .env al .gitignore
3. **Rota las claves periódicamente** - Cada 90 días es recomendado
4. **Usa HTTPS siempre** - Las sesiones de Baileys son sensibles
5. **Permisos de archivo** - Asegura que los archivos de sesión (.whatsapp/) tienen permisos restrictivos

## Estructura de Directorios Generada:

```
cobranza-app/
└── .whatsapp/
    └── auth_info/
        └── org_123_session/
            ├── creds.json (encriptado)
            ├── pre-keys.json
            ├── sender-keys.json
            └── sessions.json
```

## Prueba de Conexión:

Accede a: `http://localhost:5173/dashboard/configuracion/whatsapp`

1. Haz clic en "Conectar Teléfono"
2. Escanea el QR con tu teléfono
3. Verifica que aparezca "✅ Conectado"

## Solución de Problemas:

| Problema | Solución |
|----------|----------|
| QR no aparece | Espera 3-5 segundos, las redes pueden ser lentas |
| Sesión se desconecta | Mantén WhatsApp activo en tu teléfono |
| Error 503 "Teléfono no conectado" | Conecta primero desde Configuración > WhatsApp |
| Error 503 "No autenticada" | Escanea el QR nuevamente |

---

**Próximo paso:** Prueba enviando una factura por WhatsApp.
