import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// Los orígenes del bucket de fotos entran a img-src. Se resuelve en build: en
// Vercel las env están presentes al compilar. Sin las vars (dev pelado) se
// permite https: para no romper el panel si el build y el runtime difieren.
// Van DOS orígenes porque las URLs firmadas apuntan al endpoint S3 del bucket
// (<account>.r2.cloudflarestorage.com), no al dominio público.
function storageImgSource(): string {
  const bases = [process.env.STORAGE_PUBLIC_BASE_URL, process.env.STORAGE_ENDPOINT].filter(
    Boolean,
  ) as string[];
  if (bases.length === 0) return "https:";
  const origins = new Set<string>();
  for (const base of bases) {
    try {
      origins.add(new URL(base).origin);
    } catch {
      return "https:";
    }
  }
  return [...origins].join(" ");
}

// CSP sin nonces: Next hidrata con <script> inline, así que script-src lleva
// 'unsafe-inline' — el CSP no frena ese vector (React escapando JSX es la
// defensa primaria contra XSS acá). Lo que SÍ aporta: connect-src 'self'
// corta la exfiltración por fetch a hosts ajenos, form-action/base-uri anclan
// los envíos al propio origen, y object/frame quedan cerrados.
// 'wasm-unsafe-eval' es para el decodificador de QR (zxing), que ahora se
// sirve como asset propio — ver pickup-flow.tsx.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' blob: data: ${storageImgSource()}`,
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  // data: es el beep de confirmación del scanner de QR (audio embebido).
  "media-src 'self' blob: data:",
  "object-src 'none'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

// Headers de seguridad base. camera=(self) queda permitido porque el scanner
// de QR del puesto de seguridad usa getUserMedia en el mismo origen.
const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // La ruta del puesto era /conserjeria; hay tablets con la URL vieja anclada
  // (PWA instalada, bookmarks). Redirect permanente para no dejarlas en un 404.
  async redirects() {
    return [
      {
        source: "/:tenant/conserjeria",
        destination: "/:tenant/seguridad",
        permanent: true,
      },
      {
        source: "/:tenant/conserjeria/:path*",
        destination: "/:tenant/seguridad/:path*",
        permanent: true,
      },
    ];
  },
};

// withSentryConfig: sube source maps en el build (si hay SENTRY_AUTH_TOKEN en
// Vercel; sin token el build sigue andando, sólo sin stack traces legibles) y
// habilita el tunnel: el browser manda los eventos a /monitoring del propio
// dominio y Next los reenvía a Sentry — así connect-src 'self' del CSP queda
// intacto y los ad-blockers no comen los reportes.
export default withSentryConfig(nextConfig, {
  org: "bexovar",
  project: "packito",
  silent: !process.env.CI,
  tunnelRoute: "/monitoring",
  disableLogger: true,
});
