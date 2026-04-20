#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
# CuentIA Flow — Script de despliegue en Ubuntu
# ═══════════════════════════════════════════════════════════
# Uso:
#   Primera vez:  bash deploy/deploy.sh setup
#   Actualizar:   bash deploy/deploy.sh update
#   Solo build:   bash deploy/deploy.sh build
# ═══════════════════════════════════════════════════════════

set -euo pipefail

APP_DIR="/home/cuentia/apps/cuentia-flow"
LOG_DIR="/home/cuentia/logs"
DOMAIN="flow.cuentia.mx"
NODE_VERSION="22"

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# ─── SETUP: Primera instalación completa ────────────────
cmd_setup() {
    echo "═══════════════════════════════════════════"
    echo "  CuentIA Flow — Instalación inicial"
    echo "═══════════════════════════════════════════"

    # 1. Dependencias del sistema
    log "Actualizando paquetes del sistema..."
    sudo apt update && sudo apt upgrade -y
    sudo apt install -y curl git nginx certbot python3-certbot-nginx ufw

    # 2. Node.js vía NodeSource
    if ! command -v node &> /dev/null; then
        log "Instalando Node.js ${NODE_VERSION}..."
        curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
        sudo apt install -y nodejs
    else
        log "Node.js ya instalado: $(node -v)"
    fi

    # 3. PM2
    if ! command -v pm2 &> /dev/null; then
        log "Instalando PM2..."
        sudo npm install -g pm2
        pm2 startup systemd -u cuentia --hp /home/cuentia
    else
        log "PM2 ya instalado"
    fi

    # 4. tsx global (para el worker)
    if ! command -v tsx &> /dev/null; then
        log "Instalando tsx..."
        sudo npm install -g tsx
    fi

    # 5. Crear directorios
    log "Creando directorios..."
    mkdir -p "$LOG_DIR"

    # 6. Firewall
    log "Configurando firewall..."
    sudo ufw allow OpenSSH
    sudo ufw allow 'Nginx Full'
    sudo ufw --force enable

    # 7. Nginx config
    log "Configurando Nginx..."
    sudo cp "$APP_DIR/deploy/nginx/flow.cuentia.mx" /etc/nginx/sites-available/flow.cuentia.mx
    sudo ln -sf /etc/nginx/sites-available/flow.cuentia.mx /etc/nginx/sites-enabled/
    sudo rm -f /etc/nginx/sites-enabled/default
    sudo nginx -t && sudo systemctl reload nginx

    # 8. SSL con Certbot
    log "Obteniendo certificado SSL..."
    sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email soporte@cuentia.mx

    # 9. Verificar .env
    if [ ! -f "$APP_DIR/.env" ]; then
        warn "⚠️  Copia deploy/.env.production a .env y llena los valores:"
        warn "   cp $APP_DIR/deploy/.env.production $APP_DIR/.env"
        warn "   nano $APP_DIR/.env"
        err  "No se puede continuar sin .env"
    fi

    # 10. Instalar dependencias y build
    cmd_build

    # 11. Iniciar con PM2
    log "Iniciando aplicación con PM2..."
    cd "$APP_DIR"
    pm2 start ecosystem.config.cjs
    pm2 save

    echo ""
    log "═══════════════════════════════════════════"
    log "  ¡Instalación completa!"
    log "  App:    https://$DOMAIN"
    log "  Logs:   pm2 logs"
    log "  Status: pm2 status"
    log "═══════════════════════════════════════════"
}

# ─── BUILD: Instalar deps + compilar ────────────────────
cmd_build() {
    log "Instalando dependencias..."
    cd "$APP_DIR"
    npm ci --production=false

    log "Compilando SvelteKit..."
    npm run build

    log "Build completado ✓"
}

# ─── UPDATE: Pull + build + restart ─────────────────────
cmd_update() {
    echo "═══════════════════════════════════════════"
    echo "  CuentIA Flow — Actualización"
    echo "═══════════════════════════════════════════"

    cd "$APP_DIR"

    # Pull cambios
    log "Descargando cambios..."
    git pull origin main

    # Build
    cmd_build

    # Actualizar Nginx config y SSL
    log "Actualizando configuración Nginx..."
    sudo cp "$APP_DIR/deploy/nginx/flow.cuentia.mx" /etc/nginx/sites-available/flow.cuentia.mx
    sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email soporte@cuentia.mx
    sudo nginx -t && sudo systemctl reload nginx

    # Restart PM2
    log "Reiniciando servicios..."
    pm2 restart ecosystem.config.cjs

    log "Actualización completada ✓"
    pm2 status
}

# ─── RESTART: Solo reiniciar ────────────────────────────
cmd_restart() {
    cd "$APP_DIR"
    pm2 restart ecosystem.config.cjs
    pm2 status
}

# ─── LOGS: Ver logs ─────────────────────────────────────
cmd_logs() {
    pm2 logs --lines 100
}

# ─── STATUS: Ver estado ─────────────────────────────────
cmd_status() {
    pm2 status
    echo ""
    echo "── Último deploy ──"
    ls -la "$APP_DIR/build/index.js" 2>/dev/null || echo "No hay build"
}

# ─── Router ──────────────────────────────────────────────
case "${1:-help}" in
    setup)   cmd_setup   ;;
    build)   cmd_build   ;;
    update)  cmd_update  ;;
    restart) cmd_restart ;;
    logs)    cmd_logs    ;;
    status)  cmd_status  ;;
    *)
        echo "Uso: $0 {setup|update|build|restart|logs|status}"
        echo ""
        echo "  setup   — Instalación inicial completa (primera vez)"
        echo "  update  — git pull + build + restart"
        echo "  build   — npm ci + npm run build"
        echo "  restart — Reiniciar PM2"
        echo "  logs    — Ver logs en tiempo real"
        echo "  status  — Ver estado de procesos"
        ;;
esac
