# Bot de WhatsApp

El bot solo recibe un mensaje entrante y responde con un botón **Completar reclamo** que abre `https://reportar-one.vercel.app/reportar`. El formulario web guarda el reporte; WhatsApp no crea registros ni recibe fotos.

## Configuración directa con Meta

1. En Meta for Developers, crear una app con WhatsApp Cloud API y asociarla a la cuenta de WhatsApp Business y al número que se usará.
2. Configurar el webhook de la app con `https://reportar-one.vercel.app/api/whatsapp/webhook` y un valor propio para `WHATSAPP_VERIFY_TOKEN`. Suscribirse al evento `messages` y asociar la app a la cuenta de WhatsApp Business.
3. Cargar en el entorno Production de Vercel estas variables privadas:

   - `WHATSAPP_VERIFY_TOKEN`: el mismo valor usado al validar el webhook.
   - `WHATSAPP_APP_SECRET`: secreto de la app de Meta; se usa para validar la firma de cada evento.
   - `WHATSAPP_ACCESS_TOKEN`: token de acceso de larga duración con permisos de mensajería.
   - `WHATSAPP_PHONE_NUMBER_ID`: ID del número de WhatsApp Business.
   - `WHATSAPP_GRAPH_API_VERSION`: versión vigente de Graph API, por defecto `v26.0`.
   - `REPORTAR_PUBLIC_URL`: URL pública HTTPS del sitio, por defecto `https://reportar-one.vercel.app`.

El endpoint verifica la firma `X-Hub-Signature-256` de Meta y solo responde a mensajes con un remitente válido. Si la cuenta no admite el botón de enlace, envía el mismo enlace como texto. No se necesita n8n ni un servicio intermediario. El acceso directo a la plataforma no agrega una tarifa; Meta aplica su cuota mensual gratuita y cobra los mensajes que la superen según su rate card. Ver [precios y preguntas frecuentes de Meta](https://whatsappbusiness.com/resources/faq/).
