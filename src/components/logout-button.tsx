"use client";

import { useFormStatus } from "react-dom";
import { logoutAction } from "@/server/auth/logout";

// Botón "Salir" reutilizable (client component para poder usarlo también
// dentro de AdminNav, que es cliente). Cierra sesión y bloquea el device-PIN.
export function LogoutButton({ className }: { className?: string }) {
  return (
    <form action={logoutAction}>
      <LogoutInner className={className} />
    </form>
  );
}

function LogoutInner({ className }: { className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={
        className ??
        "rounded-xl border border-ink-700 px-3 py-2 text-xs text-ink-400 transition-colors hover:border-critical/60 hover:text-critical disabled:opacity-60"
      }
    >
      {pending ? "Saliendo…" : "Salir"}
    </button>
  );
}
