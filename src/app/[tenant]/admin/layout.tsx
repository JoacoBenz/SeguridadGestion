import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireTenantRoleOrRedirect } from "@/lib/auth";
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
    select: { id: true, name: true },
  });
  if (!tenant) notFound();

  // Guards have read+write on a subset (paquetes, autorizaciones, incidentes,
  // reportes, objetos). Per-page guards refuse them on admin-only routes.
  const session = await requireTenantRoleOrRedirect(
    tenant.id,
    ["admin", "guard"],
    `/${slug}/admin`,
  );
  const isGuardOnly = session.role === "guard";

  return (
    <div className="min-h-screen">
      <AdminNav slug={slug} tenantName={tenant.name} isGuardOnly={isGuardOnly} />
      <div className="mx-auto max-w-6xl px-4 pb-16 pt-6">{children}</div>
    </div>
  );
}
