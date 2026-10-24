#!/usr/bin/env bash
# Uso: sudo bash install.sh n8n.tudominio.com admin@tudominio.com
set -Eeuo pipefail
umask 077
fail() { echo "ERROR: $*" >&2; exit 1; }
[[ $EUID -eq 0 ]] || fail 'Ejecutar con sudo o como root.'
[[ $# -eq 2 ]] || fail 'Uso: sudo bash install.sh n8n.tudominio.com admin@tudominio.com'
domain=${1,,}
email=$2
[[ ${#domain} -le 253 && "$domain" =~ ^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]([a-z0-9-]{0,61}[a-z0-9])?$ ]] || fail 'Ingresá un dominio válido, sin https:// ni rutas.'
[[ "$email" =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]] || fail 'Email inválido.'
. /etc/os-release
[[ "$ID" == ubuntu && "$VERSION_ID" =~ ^(22.04|24.04|26.04)$ ]] || fail 'Este instalador admite Ubuntu 22.04, 24.04 y 26.04 LTS.'
deploy_dir=/opt/n8n-municipal
[[ ! -e "$deploy_dir" ]] || fail "$deploy_dir ya existe. No se sobrescribirá. Usá docker compose desde esa carpeta para administrar la instalación."
command -v systemctl >/dev/null || fail 'Se necesita un VPS con systemd.'

apt-get update
apt-get install -y ca-certificates curl openssl
if ! command -v docker >/dev/null; then
  # Repositorio oficial de Docker; no ejecutar scripts remotos.
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  cat > /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: ${UBUNTU_CODENAME:-$VERSION_CODENAME}
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
docker compose version >/dev/null || fail 'Docker existe pero falta Compose v2. Instalalo según el proveedor de tu Docker y volvé a ejecutar.'
systemctl enable --now docker
docker info >/dev/null
if command -v ss >/dev/null && ss -H -ltn '( sport = :80 or sport = :443 )' | read -r _; then
  fail 'Los puertos 80/443 están ocupados. Integrá n8n al proxy existente antes de continuar.'
fi
getent ahosts "$domain" >/dev/null || fail 'El dominio no resuelve. Configurá el registro DNS A antes de ejecutar.'

install -m 0700 -d "$deploy_dir"
cd "$deploy_dir"
encryption_key=$(openssl rand -hex 32)
cat > .env <<EOF
N8N_DOMAIN=$domain
ACME_EMAIL=$email
N8N_ENCRYPTION_KEY=$encryption_key
EOF
unset encryption_key
cat > compose.yaml <<'YAML'
name: n8n-municipal
services:
  n8n:
    image: n8nio/n8n:2.44.6
    restart: unless-stopped
    environment:
      TZ: America/Argentina/Buenos_Aires
      GENERIC_TIMEZONE: America/Argentina/Buenos_Aires
      N8N_HOST: ${N8N_DOMAIN}
      N8N_PORT: "5678"
      N8N_PROTOCOL: https
      N8N_EDITOR_BASE_URL: https://${N8N_DOMAIN}/
      WEBHOOK_URL: https://${N8N_DOMAIN}/
      N8N_PROXY_HOPS: "1"
      N8N_SECURE_COOKIE: "true"
      N8N_ENCRYPTION_KEY: ${N8N_ENCRYPTION_KEY}
      N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS: "true"
      N8N_DIAGNOSTICS_ENABLED: "false"
      EXECUTIONS_DATA_PRUNE: "true"
      EXECUTIONS_DATA_MAX_AGE: "168"
    volumes:
      - n8n_data:/home/node/.n8n
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:5678/healthz/readiness').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 10s
      timeout: 5s
      start_period: 60s
      retries: 12
    logging:
      driver: json-file
      options:
        max-size: 10m
        max-file: "3"
  caddy:
    image: caddy:2
    restart: unless-stopped
    depends_on:
      n8n:
        condition: service_healthy
    ports:
      - "80:80"
      - "443:443"
    environment:
      N8N_DOMAIN: ${N8N_DOMAIN}
      ACME_EMAIL: ${ACME_EMAIL}
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    logging:
      driver: json-file
      options:
        max-size: 10m
        max-file: "3"
volumes:
  n8n_data:
  caddy_data:
  caddy_config:
YAML
cat > Caddyfile <<'CADDY'
{
    email {$ACME_EMAIL}
}
{$N8N_DOMAIN} {
    encode gzip
    reverse_proxy n8n:5678
}
CADDY
chmod 600 .env
docker compose config --quiet
docker compose run --rm --no-deps caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
docker compose pull
docker compose up -d --wait --wait-timeout 300

echo 'Esperando certificado HTTPS válido y respuesta de n8n...'
for attempt in $(seq 1 30); do
  if curl --fail --silent --show-error --connect-timeout 5 --max-time 10 "https://$domain/healthz/readiness" >/dev/null 2>&1; then
    echo "Listo: https://$domain"
    echo 'Creá inmediatamente la cuenta de propietario desde el navegador y luego importá el workflow.'
    echo "Configuración: $deploy_dir. Respaldá .env y los volúmenes; no uses down -v."
    exit 0
  fi
  sleep 5
done
echo "Los contenedores arrancaron, pero no pude verificar HTTPS en https://$domain."
echo 'Revisá DNS A/AAAA, puertos TCP 80/443 y firewall del proveedor.'
echo "Diagnóstico: cd $deploy_dir && sudo docker compose logs --tail=100 caddy n8n"
exit 1
