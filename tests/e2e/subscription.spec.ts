import { expect, test, type Page } from "@playwright/test";
import { typePickupCode } from "./helpers";

// Política de suscripción: suspendido bloquea SOLO el registro de paquetes
// nuevos; los retiros de pendientes siguen andando. Al final se reactiva
// (también cubre el botón Activar) para dejar la DB operativa.

test.describe.serial("gating de suscripción", () => {
  const carrier = `E2E-SUB-${Date.now().toString(36).toUpperCase()}`;
  let pendingCode: string;

  async function setSubscription(page: Page, action: "Suspender" | "Activar") {
    await page.goto("/superadmin");
    const row = page.locator("li", { hasText: "Edificio Libertad" });
    await row.locator(`button:has-text("${action}")`).click();
    await page.waitForURL(/subok=/);
  }

  test.describe(() => {
    test.use({ storageState: "tests/e2e/.auth/guard.json" });

    test("queda un paquete pendiente antes de suspender", async ({ page }) => {
      await page.goto("/edificio-libertad/seguridad/ingreso");
      await page.click('button:has-text("1A")');
      await page.fill('input[name="carrier"]', carrier);
      await page.click('button:has-text("Registrar y notificar")');
      await page.waitForURL(/codigo=/);
      pendingCode = new URL(page.url()).searchParams.get("codigo")!;
    });
  });

  test.describe(() => {
    test.use({ storageState: "tests/e2e/.auth/superadmin.json" });

    test("el superadmin suspende el edificio", async ({ page }) => {
      await setSubscription(page, "Suspender");
      await expect(
        page.locator("li", { hasText: "Edificio Libertad" }).getByText("Suspendida"),
      ).toBeVisible();
    });
  });

  test.describe(() => {
    test.use({ storageState: "tests/e2e/.auth/guard.json" });

    test("suspendido: el ingreso está bloqueado", async ({ page }) => {
      await page.goto("/edificio-libertad/seguridad/ingreso");
      await expect(page.getByText("Suscripción inactiva")).toBeVisible();
      await expect(page.locator('button:has-text("Registrar y notificar")')).toHaveCount(0);
    });

    test("suspendido: el retiro del pendiente sigue funcionando", async ({ page }) => {
      await page.goto("/edificio-libertad/seguridad/retiro");
      await page.click('button:has-text("Tipear código")');
      await typePickupCode(page, pendingCode);
      await page.click('button:has-text("Confirmar retiro")');
      await page.waitForURL(/ok=/);
      await expect(page.getByText("Depto 1A")).toBeVisible();
    });
  });

  test.describe(() => {
    test.use({ storageState: "tests/e2e/.auth/superadmin.json" });

    test("reactivar deja el edificio operativo", async ({ page }) => {
      await setSubscription(page, "Activar");
      await expect(
        page.locator("li", { hasText: "Edificio Libertad" }).getByText("Activa", { exact: true }),
      ).toBeVisible();
    });
  });

  test.describe(() => {
    test.use({ storageState: "tests/e2e/.auth/guard.json" });

    test("reactivado: el ingreso vuelve a estar disponible", async ({ page }) => {
      await page.goto("/edificio-libertad/seguridad/ingreso");
      await expect(page.locator('button:has-text("Registrar y notificar")')).toBeVisible();
    });
  });
});
