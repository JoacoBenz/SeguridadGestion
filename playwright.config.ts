import { defineConfig } from "@playwright/test";

// E2E contra el build de producción real. El webServer arranca `next start`
// con stdout redirigido a un archivo: los tests leen de ahí los magic links
// que la app loguea cuando no hay RESEND_API_KEY (el "inbox" de dev).
export const E2E_SERVER_LOG =
  process.env.E2E_SERVER_LOG ?? "/tmp/paqueteok-e2e-server.log";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://paqueteok:paqueteok@localhost:5432/paqueteok?schema=public";

export default defineConfig({
  testDir: "tests/e2e",
  // Serial: los tests comparten la DB seedeada y el log de magic links.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:3000",
    launchOptions: {
      // El contenedor local corre como root; en CI el flag es inocuo.
      args: ["--no-sandbox"],
      // Sandboxes sin acceso al CDN de Playwright pueden apuntar a un
      // Chromium preexistente. En CI queda undefined y usa el instalado.
      executablePath: process.env.PW_CHROMIUM_EXECUTABLE || undefined,
    },
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    { name: "chromium", dependencies: ["setup"] },
  ],
  webServer: {
    command: `sh -c 'pnpm start > ${E2E_SERVER_LOG} 2>&1'`,
    url: "http://localhost:3000/api/health",
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      ...process.env,
      DATABASE_URL,
      AUTH_SECRET: process.env.AUTH_SECRET ?? "e2e-only-not-secret",
      AUTH_URL: "http://localhost:3000",
      AUTH_TRUST_HOST: "true",
      PUBLIC_BASE_URL: "http://localhost:3000",
      // Sin RESEND_API_KEY ni credenciales de Meta: magic links y WhatsApp
      // van al log del server, que es exactamente lo que los tests esperan.
      RESEND_API_KEY: "",
      WHATSAPP_PHONE_NUMBER_ID: "",
      WHATSAPP_ACCESS_TOKEN: "",
    },
  },
});
