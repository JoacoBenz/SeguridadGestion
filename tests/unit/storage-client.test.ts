import { describe, it, expect } from "vitest";
import {
  assertAllowedImageType,
  getStorageClient,
  keyFromPublicUrl,
  sniffImageType,
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

  it("signedUrl en dev es passthrough — no hay bucket privado que proteger", async () => {
    const url = "dev-storage://packages/t1/foto.jpg";
    await expect(getStorageClient().signedUrl(url, 900)).resolves.toBe(url);
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

  it("keyOf devuelve la key, que es lo que permite chequear el prefijo del tenant", () => {
    const client = getStorageClient();
    expect(client.keyOf("dev-storage://packages/t1/abc.jpg")).toBe("packages/t1/abc.jpg");
    expect(client.keyOf("https://evil.example/packages/t1/abc.jpg")).toBeNull();
    // Sin key no hay forma de verificar el prefijo, así que el borrado se niega.
    expect(client.keyOf("dev-storage://")).toBeNull();
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

describe("sniffImageType — el Content-Type declarado no manda, los bytes sí", () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
  const webp = new Uint8Array([
    ...Array.from("RIFF", (c) => c.charCodeAt(0)), 0x24, 0x00, 0x00, 0x00,
    ...Array.from("WEBP", (c) => c.charCodeAt(0)),
  ]);

  it("reconoce los tres formatos permitidos", () => {
    expect(sniffImageType(jpeg)).toBe("image/jpeg");
    expect(sniffImageType(png)).toBe("image/png");
    expect(sniffImageType(webp)).toBe("image/webp");
  });

  it("rechaza lo que no es imagen aunque venga etiquetado como tal", () => {
    const html = new TextEncoder().encode("<html><script>alert(1)</script>");
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg">');
    const pdf = new TextEncoder().encode("%PDF-1.4");
    expect(sniffImageType(html)).toBeNull();
    // SVG ejecuta scripts al servirse inline: jamás debe entrar al bucket.
    expect(sniffImageType(svg)).toBeNull();
    expect(sniffImageType(pdf)).toBeNull();
    expect(sniffImageType(new Uint8Array([]))).toBeNull();
    expect(sniffImageType(new Uint8Array([0xff, 0xd8]))).toBeNull(); // JPEG truncado
  });

  it("un RIFF que no es WebP (ej. AVI) no pasa", () => {
    const avi = new Uint8Array([
      ...Array.from("RIFF", (c) => c.charCodeAt(0)), 0x24, 0x00, 0x00, 0x00,
      ...Array.from("AVI ", (c) => c.charCodeAt(0)),
    ]);
    expect(sniffImageType(avi)).toBeNull();
  });
});
