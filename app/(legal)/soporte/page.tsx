import type { Metadata } from "next";
import { CONTACT_EMAIL } from "@/lib/contact";

export const metadata: Metadata = {
  title: "Soporte | ReportAR",
  description: "Ayuda y contacto para la app ReportAR.",
};

export default function SupportPage() {
  return (
    <>
      <h1 className="page-title">Soporte</h1>
      <p className="body-lead mt-5">
        ¿Tenés un problema con la app o querés corregir o borrar un reporte? Escribinos a{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Respondemos en unos días hábiles.
      </p>

      <h2>Preguntas frecuentes</h2>
      <p><strong>¿Necesito una cuenta?</strong> No. Cualquiera puede reportar sin registrarse.</p>
      <p>
        <strong>¿Cómo sigo mi reporte?</strong> Al enviarlo recibís un código. Lo encontrás en “Mis reportes”
        o podés ingresarlo ahí para consultar el estado.
      </p>
      <p>
        <strong>Quiero borrar un reporte.</strong> Mandanos el código del reporte por mail y lo eliminamos,
        junto con su foto.
      </p>
      <p>
        <strong>La app no encuentra mi ubicación.</strong> Revisá que la ubicación del teléfono esté activada
        y que la app tenga permiso. También podés escribir la dirección o marcar el punto en el mapa.
      </p>
      <p>
        <strong>¿Quién resuelve el problema?</strong> ReportAR ordena los reclamos y los muestra al municipio
        que corresponde. La reparación depende de cada municipio.
      </p>
    </>
  );
}
