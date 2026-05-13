export function publicBaseUrl(): string {
  return process.env.PUBLIC_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
}

// URL pública del PNG del QR. Se la pasamos a Meta como header image de la
// plantilla; Meta la descarga al armar el mensaje. El token mismo es la
// capability — no hay auth en ese endpoint a propósito.
export function qrImageUrl(token: string): string {
  return `${publicBaseUrl()}/api/qr/${token}`;
}
