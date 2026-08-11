import { test, expect } from "@playwright/test";

const SLUG = "edificio-libertad";

test("home page renders the pitch", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("PackItO").first()).toBeVisible();
});

test("login page renders", async ({ page }) => {
  const res = await page.goto("/login");
  expect(res?.status()).toBe(200);
});

test("health endpoint reports db up", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  expect(await res.json()).toMatchObject({ ok: true, db: "up" });
});

test("protected routes redirect to login when unauthenticated", async ({ page }) => {
  for (const path of [
    `/${SLUG}/seguridad`,
    `/${SLUG}/admin`,
    `/${SLUG}/residente/mis-paquetes`,
    "/superadmin",
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login/);
  }
});

test("unknown QR token 404s", async ({ request }) => {
  const res = await request.get("/api/qr/nonexistenttoken123", { maxRedirects: 0 });
  expect(res.status()).toBe(404);
});

test("device unlock page renders for a real tenant", async ({ page }) => {
  const res = await page.goto(`/${SLUG}/seguridad/desbloquear`);
  expect(res?.status()).toBe(200);
  await expect(page.getByText("Seguridad").first()).toBeVisible();
});
