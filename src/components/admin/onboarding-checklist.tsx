import Link from "next/link";
import type { OnboardingState, OnboardingStep } from "@/lib/onboarding";

// Guía de arranque para el admin que acaba de recibir su edificio: aterriza en
// un dashboard vacío y esto le dice qué cargar y en qué orden. Server
// component sin estado — la lógica vive en src/lib/onboarding.ts.
//
// El primer paso pendiente va resaltado: la pregunta del admin nuevo no es
// "qué me falta" sino "qué hago AHORA".

const COPY: Record<
  OnboardingStep["key"],
  { title: string; description: string; cta: string; href: (slug: string) => string }
> = {
  unidades: {
    title: "Cargá las unidades",
    description:
      "Los departamentos del edificio (1A, 3B, PB 2…). Todo lo demás cuelga de acá: cada paquete y cada residente pertenecen a una unidad.",
    cta: "Ir a Unidades",
    href: (slug) => `/${slug}/admin/unidades`,
  },
  residentes: {
    title: "Cargá los residentes con su WhatsApp",
    description:
      "A ese número les llega el aviso con el QR cuando tienen un paquete. Si tenés una planilla, el importador carga todo el edificio de una: pegás las filas y listo.",
    cta: "Importar residentes",
    href: (slug) => `/${slug}/admin/importar`,
  },
  pin: {
    title: "Configurá el PIN del puesto (opcional)",
    description:
      "Un PIN por edificio desbloquea la tablet del mostrador sin pedirle mail a cada guardia. También podés invitar guardias con email desde Equipo.",
    cta: "Configurar PIN",
    href: () => "#pin-seguridad",
  },
  paquete: {
    title: "Registrá un paquete de prueba",
    description:
      "Andá al puesto de seguridad, registrá un paquete para tu propio depto y fijate que llegue el WhatsApp. Después retiralo mostrando el QR. Ese ida y vuelta es todo el sistema.",
    cta: "Ir al puesto de seguridad",
    href: (slug) => `/${slug}/seguridad/ingreso`,
  },
};

export function OnboardingChecklist({ state, slug }: { state: OnboardingState; slug: string }) {
  if (!state.show) return null;

  const firstPending = state.steps.find((s) => !s.done)?.key;

  return (
    <section
      aria-label="Primeros pasos"
      className="rounded-2xl border border-accent/30 bg-ink-850 p-5"
    >
      <div className="mb-1 flex items-baseline justify-between">
        <h2 className="text-base font-bold text-ink-100">Primeros pasos</h2>
        <span className="text-xs text-ink-400">
          {state.doneCount} de {state.steps.length}
        </span>
      </div>
      <p className="mb-4 text-sm text-ink-400">
        Con estos pasos el edificio queda funcionando. Cuando estén listos, esta guía
        desaparece sola.
      </p>

      <ol className="flex flex-col gap-2">
        {state.steps.map((step, i) => {
          const copy = COPY[step.key];
          const isCurrent = step.key === firstPending;
          return (
            <li
              key={step.key}
              className={
                isCurrent
                  ? "rounded-xl border border-accent/50 bg-ink-900 px-4 py-3"
                  : "rounded-xl border border-ink-800 bg-ink-900 px-4 py-3"
              }
            >
              <div className="flex items-start gap-3">
                <span
                  aria-hidden
                  className={
                    step.done
                      ? "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-positive/20 text-sm text-positive"
                      : isCurrent
                        ? "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/20 text-sm font-bold text-accent"
                        : "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink-800 text-sm text-ink-500"
                  }
                >
                  {step.done ? "✓" : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className={
                      step.done
                        ? "font-semibold text-ink-500 line-through decoration-ink-600"
                        : "font-semibold text-ink-100"
                    }
                  >
                    {copy.title}
                  </p>
                  {/* El detalle sólo en el paso actual: cuatro párrafos juntos
                      son un manual; uno solo es una instrucción. */}
                  {isCurrent && (
                    <>
                      <p className="mt-1 text-sm text-ink-400">{copy.description}</p>
                      <Link
                        href={copy.href(slug)}
                        className="mt-2 inline-block rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-fg transition-transform active:scale-[0.98]"
                      >
                        {copy.cta} →
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
