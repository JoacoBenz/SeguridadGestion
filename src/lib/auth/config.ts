import NextAuth, { type NextAuthConfig } from "next-auth";
import Resend from "next-auth/providers/resend";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";

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

const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  pages: { signIn: "/login", error: "/login" },
  providers: [
    Resend({
      from: process.env.EMAIL_FROM ?? "PaqueteOK <no-reply@paqueteok.app>",
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
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: process.env.EMAIL_FROM,
            to: identifier,
            subject: "Tu acceso a PaqueteOK",
            html: `<p>Hola,</p><p>Hacé clic para entrar a PaqueteOK:</p><p><a href="${url}">${url}</a></p><p>El link vence en 10 minutos.</p>`,
          }),
        });
        if (!res.ok) {
          const body = await res.text();
          throw new Error(`Resend ${res.status}: ${body}`);
        }
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
