import { describe, it, expect } from "vitest";
import {
  assertAllowedImageType,
  getStorageClient,
  keyFromPublicUrl,
} from "@/lib/storage/client";

describe("storage client", () => {
  it("accepts jpeg/png/webp", () => {
    expect(() => assertAllowedImageType("image/jpeg")).not.toThrow();
    expect(() => assertAllowedImageType("image/png")).not.toThrow();
    expect(() => assertAllowedImageType("image/webp")).not.toThrow();
  });

  it("rejects non-image and disallowed types", () => {
    expect(() => assertAllowedImageType("image/gif")).toThrow();
    expect(() => assertAllowedImageType("application/pdf")).toThrow();
    expect(() => assertAllowedImageType("text/html")).toThrow();
  });

  it("falls back to dev client when unconfigured", async () => {
    // Sin STORAGE_* en el entorno de test, debe ser el cliente dev (no persiste).
    const client = getStorageClient();
    expect(client.isConfigured).toBe(false);
    const { url } = await client.put({
      body: Buffer.from("x"),
      contentType: "image/png",
      keyPrefix: "packages/t1",
    });
    expect(url).toMatch(/^dev-storage:\/\/packages\/t1\//);
  });

  it("el cliente dev acepta remove sin romper", async () => {
    await expect(getStorageClient().remove("dev-storage://packages/t1/x")).resolves
      .toBeUndefined();
  });
});

describe("isOwnUrl — el campo photoUrl lo controla el cliente", () => {
  it("el cliente dev sólo reconoce sus propias URLs", () => {
    const client = getStorageClient();
    expect(client.isOwnUrl("dev-storage://packages/t1/abc")).toBe(true);
    // Una URL ajena inyectada en el form no puede terminar enviada a Meta ni
    // renderizada en el panel del admin.
    expect(client.isOwnUrl("https://evil.example/track.png")).toBe(false);
    expect(client.isOwnUrl("http://169.254.169.254/latest/meta-data/")).toBe(false);
  });

  it("el cliente dev no lista nada (no persiste)", async () => {
    await expect(getStorageClient().list("packages/")).resolves.toEqual([]);
  });
});

describe("keyFromPublicUrl", () => {
  const base = "https://proj.supabase.co/storage/v1/object/public/paquetes";

  it("extrae la key de una URL del bucket", () => {
    expect(keyFromPublicUrl(`${base}/packages/t1/abc.jpg`, base)).toBe(
      "packages/t1/abc.jpg",
    );
  });

  it("tolera una barra final en el base url", () => {
    expect(keyFromPublicUrl(`${base}/packages/t1/abc.jpg`, `${base}/`)).toBe(
      "packages/t1/abc.jpg",
    );
  });

  it("devuelve null para URLs ajenas al bucket — no borramos lo que no es nuestro", () => {
    expect(keyFromPublicUrl("dev-storage://packages/t1/abc", base)).toBeNull();
    expect(keyFromPublicUrl("https://otro-host.com/packages/t1/abc.jpg", base)).toBeNull();
    // Prefijo parecido pero distinto bucket.
    expect(
      keyFromPublicUrl("https://proj.supabase.co/storage/v1/object/public/otros/x.jpg", base),
    ).toBeNull();
  });

  it("devuelve null si no queda key después del base", () => {
    expect(keyFromPublicUrl(`${base}/`, base)).toBeNull();
  });
});
