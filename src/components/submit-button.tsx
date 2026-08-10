"use client";

import { useFormStatus } from "react-dom";

// Botón de submit con estado pending: se deshabilita y cambia el texto
// mientras la server action corre. Evita el doble-tap en funciones frías
// (que en conserjería significaría registrar el mismo paquete dos veces).
// Tiene que renderizarse DENTRO del <form> cuya action observa.
export function SubmitButton({
  children,
  pendingText = "Procesando…",
  className,
  id,
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
  id?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      id={id}
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`${className ?? ""} ${pending ? "cursor-wait opacity-60" : ""}`}
    >
      {pending ? pendingText : children}
    </button>
  );
}
