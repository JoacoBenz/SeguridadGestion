import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { registerPackage } from "@/server/packages/register";
import { requireTenantRoleOrRedirect } from "@/lib/auth";
import { isTenantOperational } from "@/lib/subscription";
import { SubscriptionBlockedScreen } from "@/components/subscription-banner";
import { UnitTilePicker } from "@/components/conserjeria/unit-tile-picker";
import { SubmitButton } from "@/components/submit-button";
import { PhotoCapture } from "@/components/conserjeria/photo-capture";
import { CarrierField } from "@/components/conserjeria/carrier-field";
import { foldCarrierSuggestions } from "@/lib/carriers";
import { getStorageClient } from "@/lib/storage/client";
import { isPhotoRequired, photoMode, shouldShowPhotoField } from "@/lib/photo-policy";

export default async function IngresoPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { tenant: slug } = await params;
  const { error } = await searchParams;
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      settings: true,
      subscriptionStatus: true,
      trialEndsAt: true,
    },
  });
  if (!tenant) notFound();

  await requireTenantRoleOrRedirect(
    tenant.id,
    ["guard", "admin"],
    `/${slug}/conserjeria/ingreso`,
  );

  if (!isTenantOperational(tenant)) {
    return (
      <main className="mx-auto max-w-md px-4 pb-12 pt-6">
        <PageHeader slug={slug} tenantName={tenant.name} />
        <SubscriptionBlockedScreen tenantName={tenant.name} />
      </main>
    );
  }

  const [units, carrierRows] = await Promise.all([
    prisma.unit.findMany({
      where: { tenantId: tenant.id },
      orderBy: { label: "asc" },
      select: { id: true, label: true },
    }),
    // Transportistas ya usados en el edificio, para ofrecerlos como chips.
    prisma.package.groupBy({
      by: ["carrier"],
      where: { tenantId: tenant.id, carrier: { not: null } },
      _count: { _all: true },
    }),
  ]);
  const carrierSuggestions = foldCarrierSuggestions(
    carrierRows.map((r) => ({ carrier: r.carrier, count: r._count._all })),
  );

  const storageConfigured = getStorageClient().isConfigured;
  const mode = photoMode(tenant.settings);
  const photoEnabled = shouldShowPhotoField(storageConfigured, mode);
  const photoRequired = isPhotoRequired(storageConfigured, mode);

  async function action(formData: FormData) {
    "use server";
    const unitId = formData.get("unitId");
    if (typeof unitId !== "string" || !unitId) {
      redirect(`/${slug}/conserjeria/ingreso?error=Elegí+un+departamento`);
    }
    const carrier = formData.get("carrier");
    const notes = formData.get("notes");
    const photoUrl = formData.get("photoUrl");

    // La obligatoriedad la decide el admin del edificio. El chequeo va del lado
    // del server, independiente de la validación del navegador.
    if (photoRequired && (typeof photoUrl !== "string" || !photoUrl)) {
      redirect(
        `/${slug}/conserjeria/ingreso?error=${encodeURIComponent(
          "Sacale una foto al paquete antes de registrarlo.",
        )}`,
      );
    }

    // El redirect de éxito va FUERA del try: redirect() tira NEXT_REDIRECT
    // y un catch-all lo convertiría en ?error=.
    let pickupCode: string;
    let notified = 0;
    try {
      const result = await registerPackage({
        tenantId: tenant!.id,
        unitId,
        carrier: typeof carrier === "string" && carrier ? carrier : undefined,
        notes: typeof notes === "string" && notes ? notes : undefined,
        photoUrl: typeof photoUrl === "string" && photoUrl ? photoUrl : undefined,
      });
      pickupCode = result.pickupCode;
      notified = result.notifiedPhones.length;
    } catch (err) {
      const msg = registerErrorMessage(err);
      redirect(`/${slug}/conserjeria/ingreso?error=${encodeURIComponent(msg)}`);
    }
    // `avisados` decide el color del banner: 0 significa que TODOS los envíos
    // fallaron (Meta caído, número dado de baja) y el guardia tiene que avisar
    // a mano — el peor momento para un éxito verde falso.
    redirect(`/${slug}/conserjeria?codigo=${pickupCode}&avisados=${notified}`);
  }

  return (
    <main className="mx-auto max-w-md px-4 pb-12 pt-6">
      <PageHeader slug={slug} tenantName={tenant.name} />

      {error && (
        <p
          role="alert"
          className="mb-6 rounded-xl border border-critical/40 bg-critical/10 px-4 py-3 text-sm text-critical"
        >
          {error}
        </p>
      )}

      <form action={action} className="flex flex-col gap-8">
        {/* Cada paso completado desliza la pantalla al siguiente (advanceTo):
            depto → transportista → foto (si aplica) → registrar. */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-400">
            Para qué departamento
          </h2>
          <UnitTilePicker name="unitId" units={units} advanceToId="paso-transportista" />
        </section>

        <section id="paso-transportista" className="scroll-mt-4">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-widest text-ink-400">
            Transportista <span className="font-normal normal-case text-ink-500">(opcional)</span>
          </span>
          <CarrierField
            name="carrier"
            suggestions={carrierSuggestions}
            advanceToId={photoEnabled ? "paso-foto" : "paso-registrar"}
          />
        </section>

        {photoEnabled && (
          <section id="paso-foto" className="scroll-mt-4">
            <PhotoCapture
              slug={slug}
              name="photoUrl"
              label="Foto del paquete"
              required={photoRequired}
              advanceToId="paso-registrar"
            />
          </section>
        )}

        <details className="group">
          <summary className="flex cursor-pointer items-center gap-2 text-sm text-ink-400 transition-colors hover:text-ink-200 [&::-webkit-details-marker]:hidden">
            <span className="text-lg leading-none transition-transform group-open:rotate-45" aria-hidden>＋</span>
            más detalles
          </summary>
          <label className="mt-3 block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-widest text-ink-400">
              Notas
            </span>
            <textarea
              name="notes"
              rows={3}
              placeholder="Detalle del paquete…"
              className="w-full resize-none rounded-xl border border-ink-700 bg-ink-850 px-4 py-3 text-ink-100 placeholder:text-ink-500 focus:border-accent focus:outline-none"
            />
          </label>
        </details>

        <SubmitButton
          id="paso-registrar"
          pendingText="Registrando…"
          className="scroll-mt-4 rounded-2xl bg-accent px-4 py-4 text-lg font-bold text-accent-fg transition-transform active:scale-[0.98]"
        >
          Registrar y notificar
        </SubmitButton>
      </form>
    </main>
  );
}

function PageHeader({ slug, tenantName }: { slug: string; tenantName: string }) {
  return (
    <header className="mb-8 flex items-center gap-3">
      <Link
        href={`/${slug}/conserjeria`}
        aria-label="Volver"
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-ink-700 bg-ink-800 text-ink-300 transition-colors hover:text-ink-100"
      >
        ←
      </Link>
      <div>
        <p className="text-xs text-ink-400">{tenantName}</p>
        <h1 className="text-xl font-bold">Nuevo paquete</h1>
      </div>
    </header>
  );
}

// Los códigos internos son ingleses y greppables; al guardia le mostramos
// castellano con qué hacer al respecto.
function registerErrorMessage(err: unknown): string {
  const code = err instanceof Error ? err.message : "";
  switch (code) {
    case "SUBSCRIPTION_INACTIVE":
      return "La suscripción del edificio está inactiva: no se pueden registrar paquetes nuevos.";
    case "UNIT_WITHOUT_RESIDENTS":
      return "Ese departamento no tiene residentes cargados, así que no hay a quién avisarle. Pedile al administrador que lo cargue antes de recibir el paquete.";
    case "UNIT_WITHOUT_PHONES":
      return "Los residentes de ese departamento no tienen teléfono cargado, así que no se les puede avisar. Avisale al administrador.";
    default:
      return "No se pudo registrar el paquete. Probá de nuevo.";
  }
}
