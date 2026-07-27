import Link from "next/link";

// CTA de contacto. `NEXT_PUBLIC_CONTACT_WHATSAPP` = número en E.164 sin `+`
// ni espacios (ej. 5491133334444) → abre WhatsApp con el mensaje pre-cargado,
// que funciona igual en desktop y en celular. Sin esa var cae a un mailto al
// buzón real; un `mailto:` no abre nada en desktop sin cliente de mail
// configurado, así que en prod seteá el número.
const CONTACT_PHONE = process.env.NEXT_PUBLIC_CONTACT_WHATSAPP;
const CONTACT_MESSAGE = "Hola! Quiero PackItO en mi edificio.";
const CONTACT_HREF = CONTACT_PHONE
  ? `https://wa.me/${CONTACT_PHONE}?text=${encodeURIComponent(CONTACT_MESSAGE)}`
  : `mailto:bexovar@gmail.com?subject=${encodeURIComponent(
      "Quiero PackItO en mi edificio",
    )}`;

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-6">
      <Nav />
      <Hero />
      <ComoFunciona />
      <Features />
      <Pricing />
      <CierreCta />
      <Footer />
    </main>
  );
}

function Nav() {
  return (
    <nav className="flex items-center justify-between py-6">
      <div className="flex items-center gap-3">
        <LogoMark />
        <span className="text-lg font-bold tracking-tight">
          Pack<span className="text-accent">ItO</span>
        </span>
      </div>
      <Link
        href="/login"
        className="rounded-xl border border-ink-700 bg-ink-850 px-4 py-2 text-sm font-medium text-ink-200 transition-colors hover:border-ink-500"
      >
        Iniciar sesión
      </Link>
    </nav>
  );
}

function Hero() {
  return (
    <section className="flex flex-col items-start gap-8 py-20 sm:py-28">
      <span className="rounded-full border border-accent/40 bg-accent/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-accent">
        14 días gratis · sin tarjeta
      </span>
      <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
        Los paquetes de tu edificio,
        <br />
        <span className="text-ink-400">ordenados y trazables.</span>
      </h1>
      <p className="max-w-2xl text-lg text-ink-300 sm:text-xl">
        El guardia registra el paquete en segundos, el residente recibe un WhatsApp con QR y
        código al instante, y cada retiro queda auditado. Sin apps para los residentes, sin
        cuadernos para la conserjería.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <a
          href={CONTACT_HREF}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-2xl bg-accent px-7 py-4 text-center font-semibold text-accent-fg transition-transform active:scale-[0.98]"
        >
          Sumá tu edificio
        </a>
        <a
          href="#como-funciona"
          className="rounded-2xl border border-ink-700 bg-ink-850 px-7 py-4 text-center font-medium text-ink-100 transition-colors hover:border-ink-500"
        >
          Ver cómo funciona
        </a>
      </div>
    </section>
  );
}

function ComoFunciona() {
  const pasos = [
    {
      n: "1",
      title: "El guardia lo registra",
      body: "Elige el depto, opcionalmente el transportista, y listo. El código de retiro se genera solo.",
    },
    {
      n: "2",
      title: "El residente recibe un WhatsApp",
      body: "QR + código de 6 caracteres en un solo mensaje. ¿Lo retira otra persona? Se reenvía el mensaje y ya.",
    },
    {
      n: "3",
      title: "Retiro con QR o código",
      body: "El guardia escanea el QR o tipea el código. Queda registrado quién recibió, quién entregó y cuándo.",
    },
  ];
  return (
    <section id="como-funciona" className="border-t border-ink-800 py-20">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-400">
        Cómo funciona
      </h2>
      <p className="mb-10 text-3xl font-bold tracking-tight">Tres pasos, cero fricción.</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {pasos.map((p) => (
          <div key={p.n} className="rounded-2xl border border-ink-700 bg-ink-850 p-6">
            <span className="font-mono text-3xl font-bold text-accent">{p.n}</span>
            <h3 className="mt-3 text-lg font-semibold text-ink-100">{p.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-400">{p.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Features() {
  const features = [
    {
      title: "WhatsApp instantáneo",
      body: "El residente se entera al momento, en la app que ya usa. Sin instalar nada.",
    },
    {
      title: "Auditoría completa",
      body: "Cada alta, retiro y cancelación queda registrada para resolver cualquier disputa.",
    },
    {
      title: "Recordatorios automáticos",
      body: "Si un paquete lleva más de 3 días esperando, el residente recibe un recordatorio solo.",
    },
    {
      title: "Reportes para la administración",
      body: "Pendientes, tiempos de retiro, transportistas y deptos con más actividad, mes a mes.",
    },
    {
      title: "Multi-edificio",
      body: "Una administración puede operar varios consorcios con datos completamente aislados.",
    },
    {
      title: "Códigos sin ambigüedad",
      body: "Alfabeto sin 0/O ni 1/I/L: el código se dicta por teléfono sin confusiones en la guardia.",
    },
  ];
  return (
    <section className="border-t border-ink-800 py-20">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-400">
        Qué incluye
      </h2>
      <p className="mb-10 text-3xl font-bold tracking-tight">
        Pensado para la guardia de las 3 AM.
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <div key={f.title} className="rounded-2xl border border-ink-700 bg-ink-850 p-6">
            <h3 className="font-semibold text-ink-100">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-400">{f.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Pricing() {
  const incluye = [
    "Unidades y residentes ilimitados",
    "Notificaciones por WhatsApp incluidas",
    "Conserjería + panel de administración + reportes",
    "Auditoría completa de cada movimiento",
    "Soporte por WhatsApp y email",
  ];
  return (
    <section className="border-t border-ink-800 py-20">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-400">
        Precio
      </h2>
      <p className="mb-10 text-3xl font-bold tracking-tight">
        Un precio simple, por edificio.
      </p>
      <div className="mx-auto max-w-lg rounded-2xl border border-accent/40 bg-ink-850 p-8">
        <div className="flex items-baseline justify-between">
          <h3 className="text-xl font-bold text-ink-100">Plan Edificio</h3>
          <span className="rounded-md border border-accent/40 bg-accent/10 px-2 py-1 text-xs font-semibold text-accent">
            14 días gratis
          </span>
        </div>
        <p className="mt-2 text-sm text-ink-400">
          Suscripción mensual por edificio. Cancelás cuando quieras; tus datos y el historial
          de paquetes siguen siendo tuyos.
        </p>
        <ul className="mt-6 flex flex-col gap-3">
          {incluye.map((item) => (
            <li key={item} className="flex items-start gap-3 text-sm text-ink-200">
              <span aria-hidden className="mt-0.5 text-positive">
                ✓
              </span>
              {item}
            </li>
          ))}
        </ul>
        <a
          href={CONTACT_HREF}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-8 block rounded-2xl bg-accent px-6 py-4 text-center font-semibold text-accent-fg transition-transform active:scale-[0.98]"
        >
          Empezar la prueba gratis
        </a>
        <p className="mt-3 text-center text-xs text-ink-500">
          Te contestamos en el día con la cotización para tu consorcio.
        </p>
      </div>
    </section>
  );
}

function CierreCta() {
  return (
    <section className="border-t border-ink-800 py-20 text-center">
      <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
        Dejá el cuaderno. <span className="text-ink-400">Quedate con la trazabilidad.</span>
      </h2>
      <p className="mx-auto mt-4 max-w-xl text-ink-300">
        En menos de un día tu conserjería registra paquetes con QR y tus residentes reciben
        WhatsApp automáticos.
      </p>
      <a
        href={CONTACT_HREF}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-8 inline-block rounded-2xl bg-accent px-8 py-4 font-semibold text-accent-fg transition-transform active:scale-[0.98]"
      >
        Sumá tu edificio
      </a>
    </section>
  );
}

function Footer() {
  return (
    <footer className="flex flex-col items-center gap-2 border-t border-ink-800 py-10 text-sm text-ink-500 sm:flex-row sm:justify-between">
      <div className="flex items-center gap-2">
        <LogoMark size={20} />
        <span>
          PackItO · un producto de{" "}
          <a
            href="https://www.bexovar.com.ar"
            className="text-ink-300 underline-offset-4 hover:underline"
          >
            BEXOVAR
          </a>
        </span>
      </div>
      <div className="flex items-center gap-4">
        <Link href="/privacidad" className="text-ink-400 hover:text-ink-200">
          Privacidad
        </Link>
        <Link href="/login" className="text-ink-400 hover:text-ink-200">
          Iniciar sesión
        </Link>
      </div>
    </footer>
  );
}

function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden>
      <path
        d="M256 96 416 176v160l-160 80-160-80V176z"
        fill="none"
        stroke="#FBBF24"
        strokeWidth={30}
        strokeLinejoin="round"
      />
      <path
        d="M96 176l160 80 160-80M256 256v160"
        fill="none"
        stroke="#FBBF24"
        strokeWidth={30}
        strokeLinejoin="round"
      />
      <circle cx={400} cy={400} r={86} fill="#FBBF24" />
      <path
        d="M364 400l26 26 48-52"
        fill="none"
        stroke="#0A0A0B"
        strokeWidth={26}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
