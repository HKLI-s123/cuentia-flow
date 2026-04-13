# CuentIA Flow — Guía de Despliegue en Producción

## Arquitectura

```
Internet → Nginx (SSL/443) → SvelteKit App (:3000) → PostgreSQL (:5432)
                                   ↕
                              Worker (:3847) → WhatsApp / OpenAI / Facturapi
```

**Stack**: Node.js 22 + SvelteKit (adapter-node) + PM2 + Nginx + PostgreSQL + Let's Encrypt

---

## Requisitos del Servidor

- Ubuntu 22.04+ (dedicado o VPS)
- 4GB+ RAM (recomendado 8GB)
- Node.js 22.x
- PostgreSQL 16+
- Dominio apuntando al servidor: `flow.cuentia.mx`

---

## Instalación Rápida

### 1. Clonar repositorio

```bash
# Como usuario cuentia
cd /home/cuentia
git clone <repo-url> cuentia-flow
cd cuentia-flow
```

### 2. Configurar variables de entorno

```bash
cp deploy/.env.production .env
nano .env
# Llenar TODOS los valores (ver deploy/.env.production para referencia)
# IMPORTANTE: No confundir con el .env de cuentia-base
```

**Variables críticas que debes generar:**
```bash
# JWT secrets (generar únicos)
openssl rand -base64 64  # para JWT_SECRET
openssl rand -base64 64  # para REFRESH_TOKEN_SECRET

# Worker secret
openssl rand -base64 32  # para WORKER_SECRET

# WhatsApp encryption
openssl rand -hex 16     # para WHATSAPP_ENCRYPTION_KEY
openssl rand -hex 8      # para WHATSAPP_ENCRYPTION_IV
```

### 3. Ejecutar instalación

```bash
bash deploy/deploy.sh setup
```

Esto instala Node.js, PM2, Nginx, SSL, compila la app y la inicia.

---

## Comandos de Operación

| Comando | Descripción |
|---------|-------------|
| `bash deploy/deploy.sh update` | Pull + build + restart |
| `bash deploy/deploy.sh restart` | Reiniciar servicios |
| `bash deploy/deploy.sh logs` | Ver logs en tiempo real |
| `bash deploy/deploy.sh status` | Ver estado de procesos |
| `pm2 logs cuentia-app` | Logs solo de la app |
| `pm2 logs cuentia-worker` | Logs solo del worker |
| `pm2 monit` | Monitor interactivo |

---

## Estructura de Archivos en el Servidor

```
/home/cuentia/
├── cuentia-flow/            # Código fuente
│   ├── .env                # Variables de entorno (NO en git)
│   ├── build/              # App compilada (SvelteKit)
│   ├── worker/             # Worker (se ejecuta con tsx)
│   ├── ecosystem.config.cjs # Config PM2
│   └── deploy/
│       ├── nginx/flow.cuentia.mx
│       ├── deploy.sh
│       └── .env.production  # Template
└── logs/                   # PM2 logs
    ├── app-out.log
    ├── app-err.log
    ├── worker-out.log
    └── worker-err.log
```

---

## Base de Datos

### Crear usuario y base de datos

```bash
sudo -u postgres psql
```

```sql
CREATE USER cuentia WITH PASSWORD 'tu_password_seguro';
CREATE DATABASE cuentia_flow OWNER cuentia;
GRANT ALL PRIVILEGES ON DATABASE cuentia_flow TO cuentia;
\c cuentia_flow
GRANT ALL ON SCHEMA public TO cuentia;
```

### Importar schema y datos

```bash
# Desde la máquina de desarrollo, exportar:
pg_dump -U postgres -d cuentia_flow --no-owner --no-acl > backup.sql

# En el servidor:
psql -U cuentia -d cuentia_flow < backup.sql
```

---

## SSL / Certificados

Los certificados se configuran automáticamente con cerbot durante `deploy.sh setup`.

**Renovación automática** (certbot ya configura un cron/timer):
```bash
# Verificar timer
sudo systemctl status certbot.timer

# Renovar manualmente si es necesario
sudo certbot renew
```

---

## DNS

Agregar un registro **A** en tu proveedor de DNS para `flow.cuentia.mx` apuntando a la IP del servidor.

Si `cuentia.mx` está en Vercel, ve a **Settings → Domains** y agrega el subdominio como registro A externo.

---

## Monitoreo

```bash
# Estado de procesos
pm2 status

# Uso de recursos en tiempo real
pm2 monit

# Logs en tiempo real
pm2 logs

# Verificar Nginx
sudo systemctl status nginx
sudo tail -f /var/log/nginx/flow.cuentia.mx-error.log

# Verificar PostgreSQL
sudo systemctl status postgresql

# Health check del worker
curl http://localhost:3847/health
```

---

## Troubleshooting

### La app no inicia
```bash
pm2 logs cuentia-app --lines 50
# Verificar que .env tiene todos los valores
# Verificar que build/ existe: ls -la build/index.js
```

### Worker no conecta WhatsApp
```bash
pm2 logs cuentia-worker --lines 50
# Baileys necesita escanear QR la primera vez
# Verificar que las sesiones están en la base de datos
```

### Error 502 en Nginx
```bash
# Verificar que la app está corriendo
pm2 status
# Verificar que el puerto 3000 está en uso
sudo ss -tlnp | grep 3000
```

### Stripe webhooks no llegan
- Configurar endpoint en Stripe Dashboard: `https://flow.cuentia.mx/api/stripe/webhook`
- Actualizar `STRIPE_WEBHOOK_SECRET` en `.env` con el nuevo signing secret

---

## Actualizaciones

```bash
cd /home/cuentia/cobranza-app
bash deploy/deploy.sh update
```

Esto hace `git pull`, `npm ci`, `npm run build`, y `pm2 restart`.

---

## Backup

```bash
# Backup de base de datos (agregar a crontab)
pg_dump -U cuentia cuentia_flow | gzip > /home/cuentia/backups/db-$(date +%Y%m%d).sql.gz

# Crontab (diario a las 3am):
# 0 3 * * * pg_dump -U cuentia cuentia_flow | gzip > /home/cuentia/backups/db-$(date +\%Y\%m\%d).sql.gz
```
