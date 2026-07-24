import fs from "node:fs";
import type { Page } from "@playwright/test";
import { E2E_SERVER_LOG } from "../../playwright.config";

// El server (sin RESEND_API_KEY) loguea cada magic link a stdout, que el
// webServer de Playwright redirige a E2E_SERVER_LOG. Este helper hace el
// ciclo completo: pedir el link para un email y navegarlo.

function lastMagicLink(): string | null {
  if (!fs.existsSync(E2E_SERVER_LOG)) return null;
  const log = fs.readFileSync(E2E_SERVER_LOG, "utf8");
  const matches = [...log.matchAll(/\[auth:dev\] Link:\s+(\S+)/g)];
  return matches.length ? matches[matches.length - 1]![1]! : null;
}

export async function loginViaMagicLink(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.fill("input[name=email]", email);
  const before = lastMagicLink();

  await page.click("button[type=submit]");

  let link: string | null = null;
  for (let i = 0; i < 50; i++) {
    await page.waitForTimeout(300);
    link = lastMagicLink();
    if (link && link !== before) break;
  }
  if (!link || link === before) {
    throw new Error(`No apareció el magic link para ${email} en ${E2E_SERVER_LOG}`);
  }
  await page.goto(link);
  await page.waitForLoadState("networkidle");
}

export async function typePickupCode(page: Page, code: string): Promise<void> {
  await page.click('input[aria-label="Carácter 1 de 6"]');
  await page.keyboard.type(code, { delay: 60 });
}
