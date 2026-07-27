import type { SubscriptionBlockReason } from "@/lib/subscription";

// Avisos de estado de suscripción. Server components puros (sin estado).

export function SubscriptionBlockedScreen({ tenantName }: { tenantName: string }) {
  return (
    <div className="rounded-2xl border border-critical/40 bg-critical/10 px-6 py-12 text-center">
      <p className="text-lg font-semibold text-critical">Suscripción inactiva</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink-300">
        La suscripción de <span className="text-ink-100">{tenantName}</span> está vencida o
        suspendida, así que no se pueden registrar paquetes nuevos. Los retiros de paquetes
        pendientes siguen funcionando.
      </p>
      <p className="mt-3 text-xs text-ink-500">
        El administrador del consorcio puede regularizarla escribiendo a bexovar@gmail.com.
      </p>
    </div>
  );
}

export function SubscriptionWarningBanner({
  reason,
  daysLeft,
}: {
  reason: SubscriptionBlockReason | null;
  daysLeft: number | null;
}) {
  if (reason) {
    return (
      <div className="mb-6 rounded-xl border border-critical/40 bg-critical/10 px-4 py-3 text-sm text-critical">
        Suscripción inactiva: se pueden entregar los paquetes pendientes, pero no registrar
        nuevos. Para regularizarla, escribí a bexovar@gmail.com.
      </div>
    );
  }
  if (daysLeft !== null && daysLeft <= 5) {
    return (
      <div className="mb-6 rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-warn">
        {daysLeft === 0
          ? "El período de prueba vence hoy."
          : `Quedan ${daysLeft} día${daysLeft === 1 ? "" : "s"} de prueba.`}{" "}
        Para seguir sin cortes, activá la suscripción con bexovar@gmail.com.
      </div>
    );
  }
  return null;
}
