# n8n en VPS con HTTPS

Instalador para un VPS Ubuntu 22.04, 24.04 o 26.04 LTS con systemd, preferentemente nuevo. Instala Docker Engine y Compose desde el repositorio oficial si no existe Docker, y despliega n8n más Caddy en `/opt/n8n-municipal`. No modifica instalaciones existentes en esa carpeta.

Antes de ejecutar:

1. Crear un registro DNS **A** para `n8n.tudominio.com` apuntando a la IPv4 pública del VPS. Si hay un registro AAAA, también debe apuntar a ese VPS con IPv6 funcional. Usar DNS directo, sin proxy de Cloudflare, para esta configuración de un solo proxy.
2. Permitir **TCP 80 y 443** en el firewall del proveedor y del sistema. Conservar el acceso SSH. El instalador no cambia reglas de firewall y no publica el puerto 5678.
3. Tener un email para los avisos del certificado y acceso root/sudo.

Desde tu computadora, reemplazando dominio, email e IP:

```sh
scp deploy/vps/install.sh root@IP_DEL_VPS:/root/install-n8n.sh
ssh root@IP_DEL_VPS
bash /root/install-n8n.sh n8n.tudominio.com tu@email.com
```

Si el VPS usa un usuario con sudo, copiar a su carpeta y ejecutar `sudo bash install-n8n.sh ...`.

Caddy solicita y renueva automáticamente el certificado público y redirige HTTP a HTTPS. El script solo informa éxito después de comprobar HTTPS sin omitir la validación del certificado. La verificación desde el VPS no reemplaza probar el acceso externo desde tu computadora.

Abrir la URL y crear **inmediatamente** la cuenta de propietario de n8n. Luego importar `n8n/reportes-municipales-mock.json`, configurar la credencial Telegram en ambos nodos y publicar/activar el flujo. No hace falta ngrok. No usar simultáneamente el mismo bot en el entorno local y el VPS: Telegram utiliza un único webhook por bot.

Se usa SQLite en un volumen persistente, suficiente para este MVP de una sola instancia. Los datos locales no se migran con este script. La clave de cifrado se genera una única vez en `.env` con permisos 600; es necesaria para recuperar credenciales junto con el volumen. Respaldar ambos y no compartir `.env`.

Administración:

```sh
cd /opt/n8n-municipal
sudo docker compose ps
sudo docker compose logs --tail=100 caddy n8n
sudo docker compose stop
sudo docker compose up -d --wait
```

El instalador se revisó estáticamente; no se ejecutó en un VPS ni se emitió un certificado durante su preparación.

Referencias: [Docker en Ubuntu](https://docs.docker.com/engine/install/ubuntu/), [HTTPS automático de Caddy](https://caddyserver.com/docs/automatic-https), [webhooks de n8n detrás de proxy](https://docs.n8n.io/hosting/configuration/configuration-examples/webhook-url/).
