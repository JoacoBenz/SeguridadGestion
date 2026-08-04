import { publicBaseUrl } from "@/lib/urls";

// Mail de bienvenida: se manda cuando alguien queda dado de alta como admin o
// guardia de un edificio.
//
// A propósito NO lleva un magic link. Los links viven 10 minutos, y entre que
// el superadmin crea el edificio y la persona abre el mail suele pasar más que
// eso: recibiría un link muerto y el cartel de "ese link ya no sirve" como
// primer contacto con el producto. En vez de eso lo mandamos a /login, donde
// pide el suyo en el momento en que está sentado frente a la pantalla.
//
// Módulo puro y testeable, igual que magic-link-email.ts.

export interface WelcomeEmail {
  subject: string;
  html: string;
  text: string;
}

export type WelcomeRole = "admin" | "guard";

export interface WelcomeEmailInput {
  /** Nombre del edificio, tal como lo va a ver la persona. */
  tenantName: string;
  /** El email con el que tiene que entrar — es su usuario. */
  recipientEmail: string;
  role: WelcomeRole;
  /** Quién le dio el acceso. Sin esto el mail parece spam. */
  invitedByName?: string;
}

const ACCENT = "#FBBF24";
const INK = "#0A0A0B";
const TEXT_SOFT = "#A1A1AA";
const TEXT_DIM = "#71717A";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const ROLE_COPY: Record<WelcomeRole, { title: string; blurb: string }> = {
  admin: {
    title: "administrar",
    blurb:
      "Vas a poder cargar las unidades y los residentes, ver el historial de paquetes y los reportes del edificio.",
  },
  guard: {
    title: "usar",
    blurb:
      "Vas a poder registrar los paquetes que llegan y procesar los retiros desde la conserjería.",
  },
};

export function renderWelcomeEmail(input: WelcomeEmailInput): WelcomeEmail {
  const { tenantName, recipientEmail, role, invitedByName } = input;
  const loginUrl = `${publicBaseUrl()}/login`;
  const logoUrl = `${publicBaseUrl()}/icon-192.png`;
  const copy = ROLE_COPY[role];

  const invitedBy = invitedByName
    ? `${escapeHtml(invitedByName)} te dio acceso a PackItO para ${copy.title} <strong style="color:#F4F4F5;">${escapeHtml(tenantName)}</strong>.`
    : `Te dieron acceso a PackItO para ${copy.title} <strong style="color:#F4F4F5;">${escapeHtml(tenantName)}</strong>.`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<title>Tu acceso a PackItO</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
    Ya ten&eacute;s acceso a PackItO &#8212; ${escapeHtml(tenantName)}.
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;">
          <tr>
            <td style="background-color:${INK};border-radius:16px;padding:40px 32px;text-align:center;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
              <img src="${logoUrl}" width="56" height="56" alt="PackItO" style="display:inline-block;border-radius:14px;">
              <p style="margin:16px 0 0;font-size:13px;letter-spacing:4px;color:${ACCENT};font-weight:600;">PACK<span style="color:#F4F4F5;">ITO</span></p>
              <h1 style="margin:24px 0 8px;font-size:24px;line-height:1.3;color:#F4F4F5;font-weight:700;">Ya ten&eacute;s acceso</h1>
              <p style="margin:0 0 8px;font-size:15px;line-height:1.5;color:${TEXT_SOFT};">${invitedBy}</p>
              <p style="margin:0 0 28px;font-size:15px;line-height:1.5;color:${TEXT_SOFT};">${copy.blurb}</p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="background-color:${ACCENT};border-radius:14px;">
                    <a href="${loginUrl}" style="display:inline-block;padding:15px 44px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;font-weight:700;color:${INK};text-decoration:none;">Entrar a PackItO</a>
                  </td>
                </tr>
              </table>
              <p style="margin:28px 0 0;font-size:13px;line-height:1.5;color:${TEXT_DIM};">Ingres&aacute; con este email:<br><strong style="color:${TEXT_SOFT};">${escapeHtml(recipientEmail)}</strong></p>
              <p style="margin:12px 0 0;font-size:13px;line-height:1.5;color:${TEXT_DIM};">No hay contrase&ntilde;a: te mandamos un link para iniciar sesi&oacute;n.</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;">
                <tr><td style="border-top:1px solid #27272A;"></td></tr>
              </table>
              <p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:${TEXT_DIM};word-break:break-all;">Si el bot&oacute;n no funciona, entr&aacute; a<br><a href="${loginUrl}" style="color:${TEXT_SOFT};text-decoration:underline;">${loginUrl}</a></p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 8px 0;text-align:center;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
              <p style="margin:0;font-size:12px;line-height:1.6;color:#71717A;">Si no esperabas este acceso, ignor&aacute; este mensaje.<br>PackItO &#183; un producto de <a href="https://www.bexovar.com.ar" style="color:#71717A;text-decoration:underline;">BEXOVAR</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const invitedByText = invitedByName
    ? `${invitedByName} te dio acceso a PackItO para ${copy.title} ${tenantName}.`
    : `Te dieron acceso a PackItO para ${copy.title} ${tenantName}.`;

  const text = [
    "Ya tenés acceso a PackItO",
    "",
    invitedByText,
    copy.blurb,
    "",
    `Entrá a: ${loginUrl}`,
    `Ingresá con este email: ${recipientEmail}`,
    "",
    "No hay contraseña: te mandamos un link para iniciar sesión.",
    "",
    "Si no esperabas este acceso, ignorá este mensaje.",
    "PackItO · un producto de BEXOVAR",
  ].join("\n");

  return { subject: `Tu acceso a PackItO — ${tenantName}`, html, text };
}
