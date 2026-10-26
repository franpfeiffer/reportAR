import { createHmac, timingSafeEqual } from "node:crypto";

type WhatsAppWebhook = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: Array<{ from?: string; id?: string }>;
      };
    }>;
  }>;
};

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token") ?? "";
  const challenge = url.searchParams.get("hub.challenge") ?? "";
  const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (!expectedToken) return new Response("Webhook is not configured", { status: 503 });
  if (mode !== "subscribe" || !challenge || !safeEqual(token, expectedToken)) {
    return new Response("Forbidden", { status: 403 });
  }

  return new Response(challenge, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

export async function POST(request: Request) {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
  const publicUrl = process.env.REPORTAR_PUBLIC_URL;
  const graphVersion = process.env.WHATSAPP_GRAPH_API_VERSION ?? "v26.0";

  if (!appSecret || !accessToken || !phoneNumberId || !verifyToken || !publicUrl) {
    return Response.json({ error: "webhook_not_configured" }, { status: 503 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 1_000_000) return Response.json({ error: "payload_too_large" }, { status: 413 });

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > 1_000_000) {
    return Response.json({ error: "payload_too_large" }, { status: 413 });
  }

  const signature = request.headers.get("x-hub-signature-256") ?? "";
  const expectedSignature = `sha256=${createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
  if (!safeEqual(signature, expectedSignature)) return Response.json({ error: "invalid_signature" }, { status: 401 });

  let payload: WhatsAppWebhook;
  try {
    payload = JSON.parse(rawBody) as WhatsAppWebhook;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const recipients = new Set<string>();
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const message of change.value?.messages ?? []) {
        if (message.from && /^\d{6,20}$/.test(message.from)) recipients.add(message.from);
      }
    }
  }

  const site = new URL(publicUrl);
  if (site.protocol !== "https:") return Response.json({ error: "invalid_public_url" }, { status: 500 });
  const formUrl = new URL("/reportar", site).toString();

  const sendMessage = (recipient: string, message: Record<string, unknown>) => fetch(
    `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: recipient,
        ...message,
      }),
      cache: "no-store",
    },
  );

  await Promise.all([...recipients].map(async recipient => {
    try {
      const response = await sendMessage(recipient, {
        type: "interactive",
        interactive: {
          type: "cta_url",
          header: { type: "text", text: "ReportAR" },
          body: { text: "¡Hola! Podés reportar un problema de cualquier localidad. Completá el formulario y tu reclamo quedará publicado en el mapa." },
          footer: { text: "Es gratis y no necesitás una cuenta." },
          action: {
            name: "cta_url",
            parameters: { display_text: "Completar reclamo", url: formUrl },
          },
        },
      });

      if (!response.ok) {
        // Keep the report link usable if Meta rejects interactive CTA messages
        // for a particular account or API version.
        const fallback = await sendMessage(recipient, {
          type: "text",
          text: { body: `¡Hola! Podés reportar un problema de cualquier localidad. Completá el formulario; es gratis y no necesitás una cuenta.\n\n${formUrl}` },
        });
        if (!fallback.ok) console.error("WhatsApp welcome message failed", fallback.status);
      }
    } catch {
      console.error("WhatsApp welcome message request failed");
    }
  }));

  return Response.json({ received: true });
}
