import type { Metadata } from "next";
import { CONTACT_EMAIL } from "@/lib/contact";

export const metadata: Metadata = {
  title: "Política de privacidad | ReportAR",
  description: "Qué datos usa ReportAR, para qué y cómo pedir que se borren.",
};

const UPDATED = "7 de noviembre de 2026";

export default function PrivacyPage() {
  const mail = <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;
  return (
    <>
      <h1 className="page-title">Política de privacidad</h1>
      <p className="muted mt-4 text-sm">Última actualización: {UPDATED}</p>
      <p className="body-lead mt-5">
        ReportAR es un servicio para reportar problemas en la vía pública (baches, luminarias, basura,
        inundaciones, árboles) y seguir su estado. Funciona en la app para Android, la app para iPhone y por
        Telegram. No pedimos crear una cuenta ni tu nombre, mail o teléfono.
      </p>
      <p>Responsable de los datos: Francisco Pfeiffer, Argentina. Contacto: {mail}.</p>

      <h2>Qué datos usamos</h2>
      <ul>
        <li>
          <strong>El contenido del reporte:</strong> categoría, descripción, dirección, provincia, ciudad y,
          si lo marcás, el punto en el mapa (coordenadas).
        </li>
        <li>
          <strong>Ubicación:</strong> solo cuando tocás “Mi ubicación”, para completar el punto del reporte.
          No seguimos tu ubicación en segundo plano ni la guardamos aparte del reporte.
        </li>
        <li>
          <strong>Foto (opcional):</strong> la que sacás o elegís de tu galería para el reporte.
        </li>
        <li>
          <strong>Código de seguimiento:</strong> al enviar un reporte, la app guarda en tu teléfono su código
          y una clave para adjuntar la foto. En nuestro servidor guardamos solo una versión cifrada (hash) de
          esa clave.
        </li>
        <li>
          <strong>Dirección IP:</strong> la usamos para limitar los envíos (máximo 10 por hora) y evitar abusos.
          Guardamos solo un hash de la IP, no la IP en sí, y lo borramos después de un día sin actividad. Los
          registros técnicos del servidor pueden incluir la IP por un tiempo corto, para seguridad y
          diagnóstico.
        </li>
        <li>
          <strong>Telegram:</strong> si reportás por el bot, guardamos tu ID de usuario y de chat de Telegram
          para poder responderte en esa conversación.
        </li>
      </ul>
      <p>No usamos publicidad, no vendemos datos y no usamos herramientas de analítica ni rastreo.</p>

      <h2>Los reportes son públicos</h2>
      <p>
        La categoría, la descripción, la dirección, el punto en el mapa, la foto y el estado de cada reporte
        se muestran a cualquier persona en la app y al municipio que corresponde. No incluyas datos personales
        tuyos ni de otras personas en la descripción, y evitá fotos donde se vean caras o patentes.
      </p>

      <h2>Para qué los usamos</h2>
      <ul>
        <li>Registrar el reporte, mostrarlo a la comunidad y al municipio responsable, y dejarte seguir su estado.</li>
        <li>Estimar la urgencia del problema según la descripción y la categoría.</li>
        <li>Convertir direcciones en puntos del mapa y al revés.</li>
        <li>Prevenir abusos y mantener el servicio funcionando.</li>
      </ul>
      <p>
        La base legal es tu consentimiento al enviar el reporte y nuestro interés legítimo en prevenir abusos,
        según la Ley 25.326 de Protección de Datos Personales.
      </p>

      <h2>Con quién se comparten</h2>
      <ul>
        <li><strong>Municipios:</strong> ven los reportes de su zona para gestionarlos.</li>
        <li>
          <strong>TypeSafe:</strong> recibe la descripción y la categoría (no la dirección ni la foto) para
          estimar la urgencia.
        </li>
        <li>
          <strong>OpenStreetMap (Nominatim):</strong> recibe la dirección o las coordenadas que buscás, a través
          de nuestro servidor. Los mapas de la app de Android se descargan de OpenStreetMap, y los de iPhone de
          Apple Maps.
        </li>
        <li>
          <strong>Proveedores de infraestructura:</strong> Neon (base de datos en Brasil y almacenamiento de fotos
          en Estados Unidos), nuestro servidor privado y Vercel (panel web). Solo procesan los datos para
          prestarnos el servicio.
        </li>
        <li><strong>Telegram</strong>, si usás el bot.</li>
      </ul>
      <p>Algunos de estos proveedores están fuera de Argentina, así que los datos pueden transferirse a otros países.</p>

      <h2>Cuánto tiempo los guardamos</h2>
      <p>
        Guardamos los reportes y sus fotos mientras el servicio funcione, porque sirven de historial para la
        comunidad y los municipios, salvo que pidas borrarlos. Los datos guardados en tu teléfono (“Mis
        reportes”) se borran al deslizarlos en la app o al desinstalarla.
      </p>

      <h2>Tus derechos</h2>
      <p>
        Podés pedir acceder, corregir o borrar un reporte y su foto escribiendo a {mail} con el código del
        reporte. Respondemos dentro de los 10 días hábiles. Si no quedás conforme, podés reclamar ante la
        Agencia de Acceso a la Información Pública (AAIP), autoridad de control de la Ley 25.326.
      </p>

      <h2>Permisos de la app</h2>
      <ul>
        <li><strong>Ubicación:</strong> opcional, solo para “Mi ubicación”.</li>
        <li><strong>Cámara:</strong> opcional, solo para sacar la foto del reporte.</li>
        <li><strong>Fotos:</strong> se usa el selector del sistema; la app solo ve la foto que elegís.</li>
      </ul>
      <p>Podés negar cualquiera de estos permisos y seguir usando la app.</p>

      <h2>Menores de edad</h2>
      <p>ReportAR no está dirigido a menores de 13 años y no recolectamos datos de ellos a sabiendas.</p>

      <h2>Seguridad</h2>
      <p>
        Las conexiones usan HTTPS. Las fotos se guardan en almacenamiento privado y se muestran con enlaces
        temporales. Ningún sistema es infalible, pero limitamos los datos que guardamos al mínimo.
      </p>

      <h2>Cambios</h2>
      <p>
        Si cambiamos esta política, actualizamos la fecha de arriba. Si el cambio es importante, lo vamos a
        avisar en la app.
      </p>
    </>
  );
}
