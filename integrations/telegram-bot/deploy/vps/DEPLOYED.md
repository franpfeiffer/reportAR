# Instalación del MVP

URL: https://n8n.149.34.226.13.sslip.io/

VPS Ubuntu 24.04, SSH en puerto 5980. Configuración en `/opt/n8n-municipal/compose.yaml` y variables en `/opt/n8n-municipal/.env` (no copiar las claves a este repositorio).

Se reutilizó Docker y el Caddy existente del proyecto `pixly-processor`. n8n usa la red externa `pixly-processor_default` con alias `municipal-n8n`. Caddy agrega un sitio para ese alias en `/root/pixly-processor/Caddyfile`. Copia previa del Caddyfile: `/opt/n8n-municipal/Caddyfile.before-n8n`.

Se verificaron el estado healthy de n8n y la respuesta HTTPS `/healthz/readiness` con certificado válido. Caddy obtuvo el certificado mediante Let's Encrypt y gestiona su renovación. La instalación depende de que se conserve la red y el proxy existentes.

Workflow copiado a `/opt/n8n-municipal/workflows/reportes-municipales-mock.json`. Falta crear la cuenta de propietario desde la interfaz, importar el workflow, configurar credenciales Telegram y publicar el flujo. Las credenciales configuradas en el n8n local no se transfieren automáticamente.

El dominio usa el DNS público de sslip.io para la demo. Puede reemplazarse luego por un dominio propio actualizando `.env`, el sitio de Caddy y el registro del webhook de Telegram.

Administración en el VPS:

```sh
cd /opt/n8n-municipal
docker compose ps
docker compose logs --tail=100 n8n
docker compose stop
docker compose up -d --wait
```

No ejecutar el instalador genérico sobre esta instalación: el proxy ya estaba configurado y se integró manualmente.
