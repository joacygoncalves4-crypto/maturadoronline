#!/bin/bash
# Script de deploy para VPS (Ubuntu/Debian)
# Rode com: bash deploy-vps.sh

set -e

APP_DIR="/var/www/maturador"
LOG_DIR="/var/log/maturador"

echo "=== Maturador Online — Deploy VPS ==="

# 1. Dependências do sistema
echo "[1/6] Instalando Node.js e nginx..."
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
if ! command -v nginx &>/dev/null; then
  apt-get install -y nginx
fi
if ! command -v pm2 &>/dev/null; then
  npm install -g pm2
fi

# 2. Copiar arquivos
echo "[2/6] Copiando arquivos do projeto..."
mkdir -p "$APP_DIR" "$LOG_DIR"
cp -r . "$APP_DIR/"

# 3. Build do frontend
echo "[3/6] Fazendo build do frontend..."
cd "$APP_DIR"
npm install
npm run build

# 4. Instalar dependências do worker
echo "[4/6] Instalando dependências do worker..."
cd "$APP_DIR/worker"
npm install

# 5. Configurar nginx
echo "[5/6] Configurando nginx..."
cp "$APP_DIR/nginx.conf" /etc/nginx/sites-available/maturador
ln -sf /etc/nginx/sites-available/maturador /etc/nginx/sites-enabled/maturador
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# 6. Iniciar worker com PM2
echo "[6/6] Iniciando worker com PM2..."
cd "$APP_DIR"
pm2 delete maturador-worker 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
pm2 startup | tail -1 | bash 2>/dev/null || true

echo ""
echo "✅ Deploy concluído!"
echo "   Frontend: http://SEU_IP (nginx servindo dist/)"
echo "   Worker:   pm2 logs maturador-worker"
echo ""
echo "⚠️  Edite nginx.conf e troque SEU_DOMINIO_OU_IP antes de rodar."
