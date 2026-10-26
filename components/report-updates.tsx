"use client";

import { useEffect, useRef, useState } from "react";
import { StatusPill } from "@/components/status-pill";
import { statusLabels, type ReportStatus } from "@/lib/reports/validation";

type Event = { type: string; fromStatus: ReportStatus | null; toStatus: ReportStatus | null; publicMessage: string | null; createdAt: string };
type UpdateResponse = { status: ReportStatus; updatedAt: string; events: Event[] };
const eventKey = (event: Event) => `${event.type}:${event.createdAt}:${event.publicMessage || ""}`;

function eventTitle(event: Event) {
  if (event.type === "CREATED") return "Reporte recibido";
  if (event.type === "STATUS_CHANGED" && event.toStatus) return `Estado actualizado: ${statusLabels[event.toStatus]}`;
  if (event.type === "MUNICIPAL_RESPONSE") return "Respuesta municipal";
  return "Novedad del reporte";
}

export function ReportUpdates({ id, initialStatus, initialEvents }: { id: string; initialStatus: ReportStatus; initialEvents: Event[] }) {
  const [status, setStatus] = useState(initialStatus);
  const [events, setEvents] = useState(initialEvents);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [message, setMessage] = useState("");
  const knownEvents = useRef(new Set(initialEvents.map(eventKey)));

  useEffect(() => {
    if (typeof Notification === "undefined") setPermission("unsupported");
    else setPermission(Notification.permission);
  }, []);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch(`/api/reports/${id}/updates`, { cache: "no-store" });
        if (!response.ok) return;
        const result = await response.json() as UpdateResponse;
        if (!active) return;
        setStatus(result.status);
        for (const event of result.events) {
          const key = eventKey(event);
          if (!knownEvents.current.has(key) && permission === "granted" && (event.type === "STATUS_CHANGED" || event.type === "MUNICIPAL_RESPONSE")) {
            try { new Notification(eventTitle(event), { body: event.publicMessage || (event.toStatus ? `El estado cambió a ${statusLabels[event.toStatus]}.` : "Hay una actualización en tu reclamo.") }); } catch { /* The live timeline still works if the browser blocks desktop notifications. */ }
          }
          knownEvents.current.add(key);
        }
        setEvents(result.events);
      } catch { /* The next poll will retry without interrupting the tracking page. */ }
    };
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [id, permission]);

  async function enableNotifications() {
    if (typeof Notification === "undefined") { setPermission("unsupported"); return; }
    const result = await Notification.requestPermission();
    setPermission(result);
    setMessage(result === "granted" ? "Te avisamos mientras esta página esté abierta." : "El navegador no permitió mostrar avisos.");
  }

  return <section className="surface mt-9 overflow-hidden" aria-labelledby="progress-title">
    <div className="bg-[#14433F] px-6 py-7 text-white sm:px-9"><div className="flex flex-wrap items-center justify-between gap-3"><h2 id="progress-title" className="text-xl font-bold tracking-[-.04em]">Estado del reporte</h2><StatusPill status={status}/></div><p className="mt-3 text-xs text-[#C5E0D4]">Código de seguimiento</p><code className="mt-1 block break-all font-mono text-xs text-white sm:text-sm">{id}</code></div>
    <ol className="grid gap-0 px-6 py-7 sm:grid-cols-3 sm:px-9" aria-label="Etapas del reclamo">{(["Recibido", "En revisión", "Resuelto"] as const).map((label, index) => { const step = (["RECIBIDO", "EN_REVISION", "RESUELTO"] as const).indexOf(status); return <li key={label} className={`border-t-4 py-3 pr-5 ${index <= step ? "border-[#116D63]" : "border-[#CBDCD4]"}`} aria-current={index === step ? "step" : undefined}><span className="font-mono text-xs text-[#5B746F]">{String(index + 1).padStart(2, "0")}</span><p className={`mt-1 text-sm font-bold ${index <= step ? "text-[#173735]" : "text-[#71857E]"}`}>{label}</p></li>; })}</ol>
    <div className="border-t border-[#CBDCD4] px-6 py-6 sm:px-9"><div className="flex flex-wrap items-start justify-between gap-4"><div><h3 className="text-lg font-bold">Novedades</h3><p className="mt-1 text-sm text-[#5B746F]">Acá aparecen los cambios de estado y las respuestas del municipio.</p></div>{permission === "default" && <button type="button" onClick={() => void enableNotifications()} className="civic-button civic-button-outline min-h-10">Avisarme en este dispositivo</button>}{permission === "denied" && <p className="text-sm text-[#5B746F]">Podés habilitar avisos en la configuración del navegador.</p>}{permission === "unsupported" && <p className="text-sm text-[#5B746F]">Este navegador no admite avisos.</p>}</div>{message && <p role="status" className="mt-3 text-sm text-[#5B746F]">{message}</p>}
      {events.filter(event => event.type === "CREATED" || event.type === "STATUS_CHANGED" || event.type === "MUNICIPAL_RESPONSE").length ? <ol className="mt-6 grid gap-4">{events.filter(event => event.type === "CREATED" || event.type === "STATUS_CHANGED" || event.type === "MUNICIPAL_RESPONSE").map(event => <li key={eventKey(event)} className="border-l-2 border-[#CBDCD4] pl-4"><p className="font-semibold">{eventTitle(event)}</p>{event.publicMessage && <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[#42615B]">{event.publicMessage}</p>}<time className="mt-1 block text-xs text-[#71857E]" dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" })}</time></li>)}</ol> : <p className="mt-5 text-sm text-[#5B746F]">Todavía no hay novedades.</p>}</div>
  </section>;
}
