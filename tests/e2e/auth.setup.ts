import { test as setup } from "@playwright/test";
import { loginViaMagicLink } from "./helpers";

// Un login por rol, sesión persistida en storageState. Además de acelerar,
// evita chocar con el throttle de magic links (máx 3 vigentes por email).

setup("login guardia", async ({ page }) => {
  await loginViaMagicLink(page, "guardia@edificio-libertad.test");
  await page.context().storageState({ path: "tests/e2e/.auth/guard.json" });
});

setup("login admin", async ({ page }) => {
  await loginViaMagicLink(page, "admin@edificio-libertad.test");
  await page.context().storageState({ path: "tests/e2e/.auth/admin.json" });
});

setup("login superadmin", async ({ page }) => {
  await loginViaMagicLink(page, "super@paqueteok.test");
  await page.context().storageState({ path: "tests/e2e/.auth/superadmin.json" });
});
