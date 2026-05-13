import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getWhatsAppClient, setWhatsAppClient } from "@/lib/whatsapp/client";

describe("WhatsApp client (dev LoggingClient)", () => {
  const originalPhone = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const originalToken = process.env.WHATSAPP_ACCESS_TOKEN;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    // Re-importing isn't enough because the module caches the client; reset via setter.
    setWhatsAppClient(null);
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    if (originalPhone) process.env.WHATSAPP_PHONE_NUMBER_ID = originalPhone;
    if (originalToken) process.env.WHATSAPP_ACCESS_TOKEN = originalToken;
    setWhatsAppClient(null);
    logSpy.mockRestore();
  });

  it("loguea un mensaje y devuelve un id provider determinístico-ish", async () => {
    const client = getWhatsAppClient();
    const result = await client.sendTemplate({
      to: "+5491100000001",
      template: "paquete_recibido_v1",
      params: ["Juan", "3B", "Edificio Libertad", "ABCDEF", "https://example.test/p/abc1234"],
    });
    expect(result.providerMessageId).toMatch(/^dev-/);
    expect(logSpy).toHaveBeenCalled();
  });

  it("tira si el largo de params no coincide con la plantilla", async () => {
    const client = getWhatsAppClient();
    await expect(
      client.sendTemplate({
        to: "+5491100000001",
        template: "paquete_recibido_v1",
        params: ["solo uno"],
      }),
    ).rejects.toThrow();
  });
});
