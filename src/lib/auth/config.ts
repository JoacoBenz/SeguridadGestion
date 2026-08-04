import NextAuth, { type NextAuthConfig } from "next-auth";
import Resend from "next-auth/providers/resend";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter } from "next-auth/adapters";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { renderMagicLinkEmail } from "@/lib/auth/magic-link-email";
import { sendEmail } from "@/lib/email";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      tenantId: string | null;
      role: Role;
      name: string;
      email?: string | null;
    };
  }
}

// PrismaAdapter borra la sesión con `delete()`, que tira P2025 si la fila no
// existe. Una cookie que apunta a una sesión ya borrada —limpieza de vencidas,
// restore de un backup, borrado manual— hace fallar TODO el login con
// `AdapterError`, que la UI muestra como "problema de configuración": el
// usuario queda afuera y la única salida es que borre las cookies a mano, cosa
// que no tiene por qué saber. Cerrar una sesión que ya no está es exactamente
// el resultado buscado, así que `deleteMany` (idempotente) es lo correcto.
const prismaAdapter = PrismaAdapter(prisma);
const resilientAdapter: Adapter = {
  ...prismaAdapter,
  async deleteSession(sessionToken) {
    await prisma.session.deleteMany({ where: { sessionToken } });
    return null;
  },
};

const authConfig: NextAuthConfig = {
  adapter: resilientAdapter,
  session: { strategy: "database" },
  pages: { signIn: "/login", error: "/login" },
  providers: [
    Resend({
      from: process.env.EMAIL_FROM ?? "PackItO <no-reply@bexovar.com.ar>",
      // El copy del email promete "vence en 10 minutos"; el default de Auth.js
      // es 24h. Esto alinea la realidad con la promesa y acota la ventana de
      // un magic link interceptado.
      maxAge: 10 * 60,
      // Required by Auth.js typing. The actual send happens in sendVerificationRequest,
      // which short-circuits to console in dev when this is empty.
      apiKey: process.env.RESEND_API_KEY ?? "",
      async sendVerificationRequest({ identifier, url }) {
        if (!process.env.RESEND_API_KEY) {
          console.log("");
          console.log("[auth:dev] ───── Magic link ─────");
          console.log(`[auth:dev] Para:  ${identifier}`);
          console.log(`[auth:dev] Link:  ${url}`);
          console.log("[auth:dev] ──────────────────────");
          console.log("");
          return;
        }
        const email = renderMagicLinkEmail(url);
        // Auth.js espera que esto tire si el envío falla: sin mail no hay
        // acceso, así que acá el fallo SÍ tiene que llegar al usuario — al
        // revés que en el mail de bienvenida, donde el alta ya está hecha.
        const ok = await sendEmail({ to: identifier, ...email });
        if (!ok) throw new Error("No se pudo enviar el magic link");
      },
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { tenantId: true, role: true, name: true },
      });
      if (dbUser) {
        session.user.id = user.id;
        session.user.tenantId = dbUser.tenantId;
        session.user.role = dbUser.role;
        session.user.name = dbUser.name;
      }
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
