import { publicBaseUrl } from "@/lib/urls";

// Email del magic link, con la identidad visual de la app (card oscura,
// acento ámbar). HTML de email = tablas + estilos inline: es lo único que
// renderiza consistente en Gmail/Outlook/Apple Mail. Módulo puro y testeable.

export interface MagicLinkEmail {
  subject: string;
  html: string;
  text: string;
}

const ACCENT = "#FBBF24";
const INK = "#0A0A0B";
const CARD = "#141416";
const TEXT_SOFT = "#A1A1AA";
const TEXT_DIM = "#71717A";

function escapeHtmlAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

export function renderMagicLinkEmail(url: string): MagicLinkEmail {
  const safeUrl = escapeHtmlAttr(url);
  const logoUrl = `${publicBaseUrl()}/icon-192.png`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<title>Tu acceso a PackItO</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;">
  <!-- preheader oculto: es el texto de preview en la bandeja de entrada -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
    Tu link para entrar a PackItO &#8212; vence en 10 minutos.
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;">
          <tr>
            <td style="background-color:${INK};border-radius:16px;padding:40px 32px;text-align:center;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
              <img src="${logoUrl}" width="56" height="56" alt="PackItO" style="display:inline-block;border-radius:14px;">
              <p style="margin:16px 0 0;font-size:13px;letter-spacing:4px;color:${ACCENT};font-weight:600;">PACK<span style="color:#F4F4F5;">ITO</span></p>
              <h1 style="margin:24px 0 8px;font-size:24px;line-height:1.3;color:#F4F4F5;font-weight:700;">Entr&aacute; a PackItO</h1>
              <p style="margin:0 0 28px;font-size:15px;line-height:1.5;color:${TEXT_SOFT};">Un clic y listo &#8212; sin contrase&ntilde;as.</p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="background-color:${ACCENT};border-radius:14px;">
                    <a href="${safeUrl}" style="display:inline-block;padding:15px 44px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;font-weight:700;color:${INK};text-decoration:none;">Iniciar sesi&oacute;n</a>
                  </td>
                </tr>
              </table>
              <p style="margin:28px 0 0;font-size:13px;line-height:1.5;color:${TEXT_DIM};">El link vence en <strong style="color:${TEXT_SOFT};">10 minutos</strong> y se puede usar una sola vez.</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;">
                <tr><td style="border-top:1px solid #27272A;"></td></tr>
              </table>
              <p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:${TEXT_DIM};word-break:break-all;">Si el bot&oacute;n no funciona, copi&aacute; y peg&aacute; este link:<br><a href="${safeUrl}" style="color:${TEXT_SOFT};text-decoration:underline;">${safeUrl}</a></p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 8px 0;text-align:center;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
              <p style="margin:0;font-size:12px;line-height:1.6;color:#71717A;">Si no pediste este acceso, ignor&aacute; este mensaje &#8212; nadie puede entrar sin este link.<br>PackItO &#183; un producto de <a href="https://www.bexovar.com.ar" style="color:#71717A;text-decoration:underline;">BEXOVAR</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    "Entrá a PackItO",
    "",
    "Abrí este link para iniciar sesión (vence en 10 minutos, un solo uso):",
    url,
    "",
    "Si no pediste este acceso, ignorá este mensaje.",
    "PackItO · un producto de BEXOVAR",
  ].join("\n");

  return { subject: "Tu acceso a PackItO", html, text };
}
