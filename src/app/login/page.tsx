import { signIn } from "@/lib/auth/config";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string; sent?: string }>;
}) {
  const { callbackUrl, error, sent } = await searchParams;

  const session = await getSession();
  if (session) {
    if (session.role === "superadmin") redirect("/superadmin");
    if (!session.tenantId) redirect("/sin-edificio");
    redirect(`/${await tenantSlugFor(session.tenantId)}/conserjeria`);
  }

  async function action(formData: FormData) {
    "use server";
    const email = formData.get("email");
    if (typeof email !== "string" || !email.includes("@")) {
      redirect("/login?error=Email%20inv%C3%A1lido");
    }
    await signIn("resend", {
      email,
      redirect: false,
      redirectTo: callbackUrl ?? "/",
    });
    redirect(`/login?sent=${encodeURIComponent(email)}`);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <h1 className="text-2xl font-bold">Entrar a PaqueteOK</h1>
      <p className="mt-2 text-slate-600">Te enviamos un link al email para iniciar sesión.</p>

      {sent && (
        <p className="mt-4 rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-emerald-900">
          Te mandamos un link a <strong>{sent}</strong>. Revisá tu casilla.
        </p>
      )}
      {error && (
        <p className="mt-4 rounded border border-rose-300 bg-rose-50 px-3 py-2 text-rose-900">
          {error}
        </p>
      )}

      <form action={action} className="mt-6 flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Email</span>
          <input
            name="email"
            type="email"
            required
            autoFocus
            placeholder="tu@email.com"
            className="rounded border border-slate-300 px-3 py-2"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-brand px-4 py-3 font-semibold text-brand-fg"
        >
          Enviar link de acceso
        </button>
      </form>
    </main>
  );
}

async function tenantSlugFor(tenantId: string): Promise<string> {
  const { prisma } = await import("@/lib/db");
  const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { slug: true } });
  return t?.slug ?? "";
}
