import { signOut } from "@/lib/auth/config";
import { requireSessionOrRedirect } from "@/lib/auth";

export default async function SinEdificioPage() {
  const session = await requireSessionOrRedirect("/sin-edificio");

  async function action() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-ink-700 bg-ink-850 text-ink-400">
        ⌛
      </div>
      <h1 className="text-2xl font-bold tracking-tight">Sin edificio asignado</h1>
      <p className="mt-3 text-ink-400">
        Hola <span className="text-ink-100">{session.name}</span>, tu cuenta todavía no está
        vinculada a ningún edificio. Pedile al administrador del consorcio que te dé acceso.
      </p>
      <form action={action} className="mt-8">
        <button className="rounded-xl border border-ink-700 bg-ink-800 px-4 py-2 text-sm text-ink-300 transition-colors hover:text-ink-100">
          Cerrar sesión
        </button>
      </form>
    </main>
  );
}
