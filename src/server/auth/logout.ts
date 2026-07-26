"use server";

import { cookies } from "next/headers";
import { signOut } from "@/lib/auth/config";
import { DEVICE_COOKIE } from "@/lib/auth/device";

// Cierra la sesión de Auth.js Y bloquea el dispositivo de conserjería si lo
// hubiera (borra la cookie del PIN): en una tablet compartida, "Salir" tiene
// que dejar el equipo pidiendo PIN de nuevo, no solo cerrar el email login.
export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(DEVICE_COOKIE);
  // signOut redirige tirando NEXT_REDIRECT — no envolver en try/catch.
  await signOut({ redirectTo: "/login" });
}
