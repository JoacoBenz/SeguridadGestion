import { expect, test } from "@playwright/test";
import { typePickupCode } from "./helpers";

// Camino feliz completo: el guardia registra un paquete, ve el código,
// lo retira por código, y el admin lo ve como Retirado en el historial.
// Serial: el retiro depende del código generado en el registro.

test.describe.serial("ciclo de vida del paquete", () => {
  // Carrier único por corrida para encontrar el paquete en listados.
  const carrier = `E2E-${Date.now().toString(36).toUpperCase()}`;
  let pickupCode: string;

  test.describe(() => {
    test.use({ storageState: "tests/e2e/.auth/guard.json" });

    test("el guardia registra un paquete y ve el código", async ({ page }) => {
      await page.goto("/edificio-libertad/conserjeria/ingreso");
      await page.click('button:has-text("3B")');
      await page.fill('input[name="carrier"]', carrier);
      await page.click('button:has-text("Registrar y notificar")');

      await page.waitForURL(/codigo=/);
      pickupCode = new URL(page.url()).searchParams.get("codigo")!;
      expect(pickupCode).toMatch(/^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{6}$/);

      // Banner de éxito + el paquete listado como pendiente.
      await expect(page.getByText("Paquete registrado")).toBeVisible();
      await expect(page.getByText(carrier)).toBeVisible();
    });

    test("el retiro por código funciona y desaparece de pendientes", async ({ page }) => {
      await page.goto("/edificio-libertad/conserjeria/retiro");
      await page.click('button:has-text("Tipear código")');
      await typePickupCode(page, pickupCode);
      await page.click('button:has-text("Confirmar retiro")');

      await page.waitForURL(/ok=/);
      await expect(page.getByText("Retirado")).toBeVisible();
      await expect(page.getByText("Depto 3B")).toBeVisible();

      await page.goto("/edificio-libertad/conserjeria");
      await expect(page.getByText(carrier)).toHaveCount(0);
    });

    test("un código inexistente da error amigable en castellano", async ({ page }) => {
      await page.goto("/edificio-libertad/conserjeria/retiro");
      await page.click('button:has-text("Tipear código")');
      await typePickupCode(page, "222222");
      await page.click('button:has-text("Confirmar retiro")');

      await page.waitForURL(/error=/);
      await expect(
        page.getByText("No hay ningún paquete pendiente con ese código"),
      ).toBeVisible();
    });
  });

  test.describe(() => {
    test.use({ storageState: "tests/e2e/.auth/admin.json" });

    test("el admin ve el paquete retirado en el historial", async ({ page }) => {
      await page.goto("/edificio-libertad/admin/paquetes?status=picked_up");
      const row = page.locator("li", { hasText: carrier });
      await expect(row).toBeVisible();
      await expect(row.getByText("Retirado", { exact: true })).toBeVisible();
      await expect(row.getByText(pickupCode)).toBeVisible();
    });
  });
});

// Los redirects de anónimos ya los cubre smoke.spec; acá probamos el caso
// autenticado con rol insuficiente.
test.describe("aislamiento de acceso", () => {
  test.describe(() => {
    test.use({ storageState: "tests/e2e/.auth/guard.json" });

    test("el guardia no entra al panel de admin", async ({ page }) => {
      await page.goto("/edificio-libertad/admin");
      await page.waitForURL(/\/403/);
    });
  });
});
