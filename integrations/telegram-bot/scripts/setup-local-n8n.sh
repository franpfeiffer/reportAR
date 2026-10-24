#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_dir"

if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
  echo 'Instalando Docker Engine y Compose desde los repositorios de Ubuntu.'
  shopt -s nullglob
  cached_packages=(/tmp/bot-reportar-docker/*.deb)
  if [ "${#cached_packages[@]}" -eq 7 ]; then
    echo 'Usando los paquetes descargados en /tmp/bot-reportar-docker.'
    sudo apt-get install -y "${cached_packages[@]}"
  else
    sudo apt-get update
    sudo apt-get install -y docker.io docker-compose-v2
  fi
fi

if ! sudo docker info >/dev/null 2>&1; then
  if [ -d /run/systemd/system ]; then
    sudo systemctl enable --now docker
  else
    sudo service docker start
  fi
fi

sudo docker compose config --quiet
sudo docker compose pull
sudo docker compose up -d --wait --wait-timeout 240
sudo docker compose ps
echo
echo 'n8n disponible en http://localhost:5678'
echo 'Creá tu cuenta local e importá n8n/reportes-municipales-mock.json desde la interfaz.'
echo 'Los datos y la clave de cifrado se conservan en el volumen bot-reportar_n8n_data.'
echo 'Para Telegram todavía hace falta una URL HTTPS pública para el webhook.'
