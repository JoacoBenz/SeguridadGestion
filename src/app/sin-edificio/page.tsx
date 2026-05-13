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
      <h1 className="text-2xl font-bold">Cuenta sin edificio asignado</h1>
      <p className="mt-3 text-slate-600">
        Hola {session.name}, tu cuenta todavía no está vinculada a ningún edificio. Pedile al
        administrador de tu consorcio que te dé acceso.
      </p>
      <form action={action} className="mt-6">
        <button className="rounded border border-slate-300 px-4 py-2">Cerrar sesión</button>
      </form>
    </main>
  );
}
