import { z } from "zod";
import { signIn } from "@/lib/auth/config";
import { getSession, type Session } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";

const EmailSchema = z.string().trim().toLowerCase().email();

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string; sent?: string }>;
}) {
  const { callbackUrl, error, sent } = await searchParams;

  const session = await getSession();
  if (session) redirect(await landingPathFor(session));

  async function action(formData: FormData) {
    "use server";
    const parsed = EmailSchema.safeParse(formData.get("email"));
    if (!parsed.success) {
      redirect(`/login?error=${encodeURIComponent("Email inválido")}`);
    }
    const email = parsed.data;
    try {
      await signIn("resend", {
        email,
        redirect: false,
        redirectTo: callbackUrl ?? "/",
      });
    } catch (err) {
      console.error("[login] signIn failed", err);
      redirect(`/login?error=${encodeURIComponent("No pudimos enviar el link. Probá de nuevo.")}`);
    }
    redirect(`/login?sent=${encodeURIComponent(email)}`);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <div className="mb-2 inline-block">
        <span className="font-mono text-xs uppercase tracking-[0.3em] text-accent">
          PaqueteOK
        </span>
      </div>
      <h1 className="text-3xl font-bold tracking-tight">Entrar</h1>
      <p className="mt-2 text-ink-400">
        Te mandamos un link al email para iniciar sesión.
      </p>

      {sent && (
        <p className="mt-6 rounded-xl border border-positive/40 bg-positive/10 px-4 py-3 text-sm text-positive">
          Te mandamos un link a <strong className="text-ink-100">{sent}</strong>. Revisá tu casilla.
        </p>
      )}
      {error && (
        <p className="mt-6 rounded-xl border border-critical/40 bg-critical/10 px-4 py-3 text-sm text-critical">
          {error}
        </p>
      )}

      <form action={action} className="mt-8 flex flex-col gap-4">
        <label className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-ink-400">
            Email
          </span>
          <input
            name="email"
            type="email"
            required
            autoFocus
            placeholder="tu@email.com"
            className="rounded-xl border border-ink-700 bg-ink-850 px-4 py-3 text-ink-100 placeholder:text-ink-500 focus:border-accent focus:outline-none"
          />
        </label>
        <button
          type="submit"
          className="rounded-2xl bg-accent px-4 py-4 text-lg font-bold text-accent-fg transition-transform active:scale-[0.98]"
        >
          Enviar link de acceso
        </button>
      </form>
    </main>
  );
}

async function landingPathFor(session: Session): Promise<string> {
  if (session.role === "superadmin") return "/superadmin";
  if (!session.tenantId) return "/sin-edificio";
  const t = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: { slug: true },
  });
  // Sin slug no se puede armar una ruta de tenant; un "" generaría
  // "//conserjeria", que el browser trata como URL externa.
  if (!t) return "/sin-edificio";
  return session.role === "admin" ? `/${t.slug}/admin` : `/${t.slug}/conserjeria`;
}
