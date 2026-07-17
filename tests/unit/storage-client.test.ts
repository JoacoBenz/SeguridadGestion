import { describe, it, expect } from "vitest";
import { assertAllowedImageType, getStorageClient } from "@/lib/storage/client";

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
});
