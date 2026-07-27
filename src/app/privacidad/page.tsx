import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de privacidad · PackItO",
  description: "Cómo PackItO recolecta, usa y protege los datos.",
};

const UPDATED = "Julio de 2026";
const CONTACT = "hola@bexovar.com";

export default function PrivacidadPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link
        href="/"
        className="text-sm text-ink-400 transition-colors hover:text-ink-200"
      >
        ← Volver a PackItO
      </Link>

      <h1 className="mt-6 text-3xl font-bold tracking-tight">Política de privacidad</h1>
      <p className="mt-2 text-sm text-ink-500">Última actualización: {UPDATED}</p>

      <div className="mt-8 flex flex-col gap-8 text-ink-300 leading-relaxed">
        <Section title="Quiénes somos">
          PackItO es un servicio de gestión de paquetes para edificios residenciales, operado
          por BEXOVAR. Digitaliza la recepción y el retiro de paquetes en la conserjería de
          cada edificio (consorcio) que contrata el servicio. Esta política describe qué datos
          tratamos y con qué fin.
        </Section>

        <Section title="Qué datos recolectamos">
          <ul className="ml-5 list-disc space-y-1.5">
            <li>
              <strong className="text-ink-100">De los administradores y guardias:</strong>{" "}
              nombre y correo electrónico, para el inicio de sesión y la operación del panel.
            </li>
            <li>
              <strong className="text-ink-100">De los residentes:</strong> nombre, número de
              teléfono y, opcionalmente, correo electrónico, cargados por la administración del
              edificio para poder notificar la llegada de paquetes.
            </li>
            <li>
              <strong className="text-ink-100">De los paquetes:</strong> unidad de destino,
              transportista, fecha y hora de recepción y retiro, y una foto opcional del
              paquete tomada por la conserjería.
            </li>
            <li>
              <strong className="text-ink-100">Registros de actividad:</strong> quién registró
              y quién entregó cada paquete, con fecha y hora, para trazabilidad.
            </li>
          </ul>
        </Section>

        <Section title="Cómo usamos los datos">
          <ul className="ml-5 list-disc space-y-1.5">
            <li>
              Enviar al residente una notificación por <strong className="text-ink-100">WhatsApp</strong>{" "}
              cuando llega un paquete a su nombre, con un código QR para el retiro.
            </li>
            <li>Enviar recordatorios cuando un paquete permanece sin retirar.</li>
            <li>Permitir a la conserjería procesar el retiro y llevar el registro.</li>
            <li>Autenticar el acceso de administradores y guardias por enlace de correo.</li>
          </ul>
          <p className="mt-3">
            No vendemos ni alquilamos datos personales, ni los usamos para publicidad.
          </p>
        </Section>

        <Section title="Mensajes de WhatsApp">
          Las notificaciones se envían a través de la WhatsApp Business Platform de Meta. El
          número de teléfono del residente se utiliza exclusivamente para entregar avisos
          relacionados con sus paquetes. El residente puede pedir a la administración de su
          edificio que deje de enviarle mensajes en cualquier momento.
        </Section>

        <Section title="Con quién los compartimos">
          Solo con los proveedores necesarios para operar el servicio: Meta (WhatsApp) para los
          mensajes, y proveedores de infraestructura para el alojamiento de la aplicación, la
          base de datos, el envío de correos y el almacenamiento de las fotos. Cada edificio
          ve únicamente los datos de su propio consorcio; los datos no se comparten entre
          edificios.
        </Section>

        <Section title="Conservación">
          Conservamos los datos mientras el edificio mantenga activo el servicio, para
          preservar el historial y la trazabilidad de los paquetes. Si un edificio deja de usar
          PackItO, sus datos pueden eliminarse a pedido.
        </Section>

        <Section title="Tus derechos">
          Podés solicitar acceder, corregir o eliminar tus datos personales escribiéndonos a{" "}
          <a href={`mailto:${CONTACT}`} className="text-accent underline-offset-4 hover:underline">
            {CONTACT}
          </a>
          . Los residentes también pueden gestionar estos pedidos a través de la administración
          de su edificio.
        </Section>

        <Section title="Seguridad">
          Aplicamos medidas técnicas para proteger los datos: conexiones cifradas, control de
          acceso por rol, aislamiento de la información entre edificios y registros de
          auditoría. Ningún sistema es infalible, pero trabajamos para minimizar los riesgos.
        </Section>

        <Section title="Cambios">
          Podemos actualizar esta política. La fecha de arriba indica la última revisión. Los
          cambios relevantes se comunicarán a los administradores de los edificios.
        </Section>

        <Section title="Contacto">
          Por cualquier consulta sobre privacidad, escribinos a{" "}
          <a href={`mailto:${CONTACT}`} className="text-accent underline-offset-4 hover:underline">
            {CONTACT}
          </a>
          .
        </Section>
      </div>

      <footer className="mt-12 border-t border-ink-800 pt-6 text-sm text-ink-500">
        PackItO · un producto de{" "}
        <a href="https://bexovar.com" className="text-ink-300 underline-offset-4 hover:underline">
          BEXOVAR
        </a>
      </footer>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-lg font-semibold text-ink-100">{title}</h2>
      <div className="text-sm sm:text-base">{children}</div>
    </section>
  );
}
