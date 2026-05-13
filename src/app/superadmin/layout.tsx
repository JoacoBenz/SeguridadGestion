import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function SuperadminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login?callbackUrl=%2Fsuperadmin");
  if (session.role !== "superadmin") redirect("/403");

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
          <Link href="/superadmin" className="block">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-accent">
              PaqueteOK
            </p>
            <h1 className="text-lg font-bold tracking-tight">Superadmin</h1>
          </Link>
          <Link
            href="/superadmin/tenants/new"
            className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-fg"
          >
            + Nuevo edificio
          </Link>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-4 pb-16 pt-6">{children}</div>
    </div>
  );
}
