import { defineConfig, devices } from "@playwright/test";

// E2E contra el build de producción real (pnpm start), no el dev server: es lo
// mismo que corre en Vercel y lo que CI acaba de compilar. El webServer
// redirige stdout a un archivo porque los tests leen de ahí los magic links
// que la app loguea cuando no hay RESEND_API_KEY (el "inbox" de dev).
export const E2E_SERVER_LOG =
  process.env.E2E_SERVER_LOG ?? "/tmp/paqueteok-e2e-server.log";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://paqueteok:paqueteok@localhost:5432/paqueteok?schema=public";

export default defineConfig({
  // Solo tests/e2e (los unit tests viven en tests/unit y son de vitest).
  testDir: "./tests/e2e",
  // Serial: los specs comparten la DB seedeada y el log de magic links.
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : "list",
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    ...devices["Desktop Chrome"],
    launchOptions: {
      // El sandbox local corre como root; en CI el flag es inocuo.
      args: ["--no-sandbox"],
      // Sandboxes sin acceso al CDN de Playwright pueden apuntar a un
      // Chromium preexistente. En CI queda undefined y usa el instalado.
      executablePath: process.env.PW_CHROMIUM_EXECUTABLE || undefined,
    },
  },
  projects: [
    // Un login por rol, persistido como storageState (ver auth.setup.ts).
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
