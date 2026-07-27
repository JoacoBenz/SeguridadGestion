import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getWhatsAppClient, setWhatsAppClient } from "@/lib/whatsapp/client";

describe("WhatsApp client (dev LoggingClient)", () => {
  const originalPhone = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const originalToken = process.env.WHATSAPP_ACCESS_TOKEN;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    setWhatsAppClient(null);
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    if (originalPhone) process.env.WHATSAPP_PHONE_NUMBER_ID = originalPhone;
    if (originalToken) process.env.WHATSAPP_ACCESS_TOKEN = originalToken;
    setWhatsAppClient(null);
    logSpy.mockRestore();
  });

  it("loguea con headerImageUrl cuando la plantilla lo requiere", async () => {
    const client = getWhatsAppClient();
    const result = await client.sendTemplate({
      to: "+5491100000001",
      template: "paquete_recibido_v3",
      params: ["Juan", "Edificio Libertad", "3B"],
      headerImageUrl: "https://example.test/api/qr/abc1234",
    });
    expect(result.providerMessageId).toMatch(/^dev-/);
    expect(logSpy).toHaveBeenCalled();
    const logged = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(logged).toContain("headerImage=https://example.test/api/qr/abc1234");
  });

  it("tira si la plantilla con header image no recibe headerImageUrl", async () => {
    const client = getWhatsAppClient();
    await expect(
      client.sendTemplate({
        to: "+5491100000001",
        template: "paquete_recibido_v3",
        params: ["Juan", "Edificio Libertad", "3B"],
        // headerImageUrl omitida a propósito
      }),
    ).rejects.toThrow(/headerImageUrl/);
  });

  it("tira si el largo de params no coincide con la plantilla", async () => {
    const client = getWhatsAppClient();
    await expect(
      client.sendTemplate({
        to: "+5491100000001",
        template: "paquete_recibido_v3",
        params: ["solo uno"],
        headerImageUrl: "https://example.test/api/qr/abc1234",
      }),
    ).rejects.toThrow();
  });

  it("no requiere headerImageUrl para plantillas sin header image", async () => {
    const client = getWhatsAppClient();
    const result = await client.sendTemplate({
      to: "+5491100000001",
      template: "paquete_retirado_v1",
      params: ["13/05/2026", "09:42"],
    });
    expect(result.providerMessageId).toMatch(/^dev-/);
  });
});
