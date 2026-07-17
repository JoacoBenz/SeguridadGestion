import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireTenantRoleOrRedirect } from "@/lib/auth";
import { subscriptionBlockReason, trialDaysLeft } from "@/lib/subscription";
import { SubscriptionWarningBanner } from "@/components/subscription-banner";
import { AdminNav } from "@/components/admin/admin-nav";

export default async function AdminLayout({
  params,
  children,
}: {
  params: Promise<{ tenant: string }>;
  children: React.ReactNode;
}) {
  const { tenant: slug } = await params;
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true, name: true, subscriptionStatus: true, trialEndsAt: true },
  });
  if (!tenant) notFound();

  await requireTenantRoleOrRedirect(tenant.id, ["admin"], `/${slug}/admin`);

  return (
    <div className="min-h-screen">
      <AdminNav slug={slug} tenantName={tenant.name} />
      <div className="mx-auto max-w-6xl px-4 pb-16 pt-6">
        {/* Aviso informativo, no es control de acceso (eso vive en cada page). */}
        <SubscriptionWarningBanner
          reason={subscriptionBlockReason(tenant)}
          daysLeft={trialDaysLeft(tenant)}
        />
        {children}
      </div>
    </div>
  );
}
