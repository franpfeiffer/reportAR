import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL } from "@/lib/contact";

export const metadata: Metadata = {
  title: "Condiciones de uso | ReportAR",
  description: "Reglas para publicar reportes en ReportAR.",
};

const UPDATED = "7 de noviembre de 2026";

export default function TermsPage() {
  const mail = <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;
  return (
    <>
      <h1 className="page-title">Condiciones de uso</h1>
      <p className="muted mt-4 text-sm">Última actualización: {UPDATED}</p>
      <p className="body-lead mt-5">
        Al enviar un reporte en ReportAR (en la app o por Telegram) aceptás estas condiciones. Si no estás de
        acuerdo, no envíes reportes.
      </p>

      <h2>Para qué sirve</h2>
      <p>
        ReportAR sirve para reportar problemas en la vía pública y seguir su estado. Es un proyecto independiente:
        no es un servicio oficial de ningún gobierno ni municipio, y no garantiza que el problema se resuelva ni
        en qué plazo.
      </p>

      <h2>Tolerancia cero con el contenido abusivo</h2>
      <p>Los reportes son públicos. No está permitido publicar:</p>
      <ul>
        <li>insultos, amenazas, acoso o discriminación;</li>
        <li>contenido sexual, violento o ilegal;</li>
        <li>datos personales de otras personas (nombres, teléfonos, caras o patentes reconocibles);</li>
        <li>spam, publicidad o reportes falsos o en broma;</li>
        <li>fotos que no muestren el problema reportado.</li>
      </ul>
      <p>
        Filtramos automáticamente el lenguaje ofensivo. Cualquier persona puede denunciar un reporte desde la app,
        y los reportes con varias denuncias se ocultan hasta que los revisamos. Revisamos las denuncias dentro de
        las 24 horas y eliminamos el contenido que no cumpla estas reglas. Podemos bloquear el envío de reportes
        a quien las incumpla.
      </p>

      <h2>Tu contenido</h2>
      <p>
        Sos responsable de lo que publicás. Al enviar un reporte nos permitís mostrarlo públicamente y compartirlo
        con el municipio que corresponde para que pueda gestionarlo. Podés pedir que lo borremos en cualquier
        momento escribiendo a {mail} con el código del reporte.
      </p>

      <h2>Privacidad</h2>
      <p>
        Cómo tratamos los datos está explicado en la <Link href="/privacidad">política de privacidad</Link>.
      </p>

      <h2>Cambios y contacto</h2>
      <p>
        Podemos actualizar estas condiciones; la fecha de arriba indica la última versión. Para cualquier consulta
        o para denunciar contenido, escribinos a {mail}.
      </p>
    </>
  );
}
