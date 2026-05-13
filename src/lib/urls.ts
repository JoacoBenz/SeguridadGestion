export function publicBaseUrl(): string {
  return process.env.PUBLIC_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
}

export function pickupPageUrl(token: string): string {
  return `${publicBaseUrl()}/p/${token}`;
}
