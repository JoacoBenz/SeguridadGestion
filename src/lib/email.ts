// Envío de mails por Resend. Mismo patrón que los clientes de WhatsApp y
// storage: con `RESEND_API_KEY` manda de verdad, sin ella loguea a stdout y
// devuelve ok. Así el flujo completo se puede probar en dev sin credenciales.

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

const DEFAULT_FROM = "PackItO <no-reply@bexovar.com.ar>";

/**
 * Manda un mail. Devuelve `false` si no se pudo — nunca tira.
 *
 * Los llamadores son acciones cuyo resultado principal ya está persistido
 * (se creó el edificio, se invitó al admin): que Resend esté caído no puede
 * deshacer eso ni romperle la pantalla al superadmin. El fallo se loguea para
 * que quede en los logs del server.
 */
export async function sendEmail(email: OutgoingEmail): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? DEFAULT_FROM;

  if (!apiKey) {
    console.log("");
    console.log("[email:dev] ───── Mail no enviado (sin RESEND_API_KEY) ─────");
    console.log(`[email:dev] Para:    ${email.to}`);
    console.log(`[email:dev] Asunto:  ${email.subject}`);
    console.log(`[email:dev] ${email.text.split("\n").join("\n[email:dev] ")}`);
    console.log("[email:dev] ──────────────────────────────────────────────");
    console.log("");
    return true;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: email.to,
        subject: email.subject,
        html: email.html,
        // La versión de texto plano mejora deliverability y accesibilidad.
        text: email.text,
      }),
    });
    if (!res.ok) {
      console.error(`[email] Resend ${res.status} para ${email.to}: ${await res.text()}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(
      `[email] no se pudo mandar a ${email.to}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    return false;
  }
}
