import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import { pickupPageUrl } from "@/lib/urls";

export default async function PickupPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const pkg = await prisma.package.findFirst({
    where: { pickupToken: token },
    include: {
      unit: { select: { label: true } },
      tenant: { select: { name: true } },
    },
  });
  if (!pkg) notFound();

  const qrDataUrl = await QRCode.toDataURL(pickupPageUrl(pkg.pickupToken), {
    margin: 1,
    width: 320,
  });

  const isPicked = pkg.status === "picked_up";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center px-4 py-8 text-center">
      <p className="text-sm text-slate-500">{pkg.tenant.name}</p>
      <h1 className="text-2xl font-bold">
        Paquete para depto {pkg.unit.label}
      </h1>

      {isPicked ? (
        <p className="mt-6 rounded border border-emerald-300 bg-emerald-50 px-4 py-3 text-emerald-900">
          Ya fue retirado el {pkg.pickedUpAt?.toLocaleString("es-AR")}.
        </p>
      ) : (
        <>
          <div className="mt-6 rounded-xl bg-white p-4 shadow">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} alt="QR de retiro" width={320} height={320} />
          </div>
          <p className="mt-4 text-sm text-slate-500">o tipeá este código en la conserjería:</p>
          <p className="mt-1 font-mono text-3xl font-bold tracking-widest">{pkg.pickupCode}</p>
          <p className="mt-6 text-xs text-slate-400">
            Compartir este link equivale a autorizar el retiro. Se registra quién lo presenta.
          </p>
        </>
      )}
    </main>
  );
}
