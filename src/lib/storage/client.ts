import { randomUUID } from "node:crypto";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  type PutObjectCommandInput,
} from "@aws-sdk/client-s3";

// Almacenamiento de fotos (paquete al ingreso, paquete al retiro).
// Igual patrón que el WhatsApp client: si hay credenciales S3/R2 usa el bucket
// real, si no un cliente dev que loguea y no persiste nada.
//
// Compatible con Cloudflare R2 (setear STORAGE_ENDPOINT al endpoint de R2) y con
// cualquier S3. El bucket tiene que ser de lectura pública o servido detrás de un
// dominio público (STORAGE_PUBLIC_BASE_URL), porque las fotos se ven en el panel.

export interface StorageClient {
  // Sube bytes y devuelve la URL pública para guardar en photoUrl / pickupPhotoUrl.
  put(input: {
    body: Buffer | Uint8Array;
    contentType: string;
    keyPrefix: string;
  }): Promise<{ url: string }>;
  // Borra por URL pública (la que quedó guardada en la fila del paquete).
  // Idempotente: borrar algo que ya no está no es un error.
  remove(url: string): Promise<void>;
  // ¿Esta URL la produjo este storage? El campo photoUrl viaja como input del
  // form y el cliente lo controla, así que hay que verificar el origen antes de
  // guardarlo o mandárselo a Meta.
  isOwnUrl(url: string): boolean;
  // La key del objeto, o null si la URL no es de este storage. El llamador la
  // usa para verificar que el archivo pertenece al tenant que pide borrarlo.
  keyOf(url: string): string | null;
  // Lista objetos bajo un prefijo. Sirve para encontrar huérfanos: archivos
  // subidos que nunca quedaron referenciados por una fila.
  list(prefix: string, max?: number): Promise<StoredObject[]>;
  // Indica si el storage está configurado (para esconder la UI de foto en dev).
  readonly isConfigured: boolean;
}

export interface StoredObject {
  key: string;
  url: string;
  lastModified: Date | null;
}

const ALLOWED_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function assertAllowedImageType(contentType: string): void {
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    throw new Error(`Tipo de imagen no permitido: ${contentType}`);
  }
}

class S3StorageClient implements StorageClient {
  readonly isConfigured = true;
  private readonly client: S3Client;

  constructor(
    private readonly bucket: string,
    private readonly publicBaseUrl: string,
    region: string,
    endpoint: string | undefined,
    accessKeyId: string,
    secretAccessKey: string,
  ) {
    this.client = new S3Client({
      region,
      endpoint,
      // R2 y varios S3-compat requieren path-style.
      forcePathStyle: Boolean(endpoint),
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  async put({
    body,
    contentType,
    keyPrefix,
  }: {
    body: Buffer | Uint8Array;
    contentType: string;
    keyPrefix: string;
  }): Promise<{ url: string }> {
    assertAllowedImageType(contentType);
    const ext = EXT_BY_TYPE[contentType];
    const key = `${keyPrefix}/${randomUUID()}.${ext}`;
    const params: PutObjectCommandInput = {
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    };
    await this.client.send(new PutObjectCommand(params));
    return { url: `${this.publicBaseUrl}/${key}` };
  }

  isOwnUrl(url: string): boolean {
    return this.keyOf(url) !== null;
  }

  keyOf(url: string): string | null {
    return keyFromPublicUrl(url, this.publicBaseUrl);
  }

  async list(prefix: string, max = 5000): Promise<StoredObject[]> {
    const out: StoredObject[] = [];
    let token: string | undefined;
    do {
      const page = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken: token,
        }),
      );
      for (const item of page.Contents ?? []) {
        if (!item.Key) continue;
        out.push({
          key: item.Key,
          url: `${this.publicBaseUrl}/${item.Key}`,
          lastModified: item.LastModified ?? null,
        });
        if (out.length >= max) return out;
      }
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
    return out;
  }

  async remove(url: string): Promise<void> {
    const key = keyFromPublicUrl(url, this.publicBaseUrl);
    // Una URL que no pertenece a este bucket (dev-storage://, o un bucket
    // anterior si se migró) no es un error: no hay nada nuestro que borrar.
    if (!key) return;
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}

/**
 * Saca la key del objeto a partir de la URL pública guardada en la DB.
 * Devuelve null si la URL no cuelga de este bucket.
 */
export function keyFromPublicUrl(url: string, publicBaseUrl: string): string | null {
  const base = publicBaseUrl.replace(/\/$/, "");
  if (!url.startsWith(`${base}/`)) return null;
  const key = url.slice(base.length + 1);
  return key.length > 0 ? key : null;
}

class DevStorageClient implements StorageClient {
  readonly isConfigured = false;

  async put({ contentType, keyPrefix }: { contentType: string; keyPrefix: string }) {
    assertAllowedImageType(contentType);
    // ponytail: dev no-op — sin bucket configurado no persistimos. Devolvemos una
    // URL placeholder para no romper el flujo; en prod S3StorageClient sube de verdad.
    const url = `dev-storage://${keyPrefix}/${randomUUID()}`;
    console.log(`[storage:dev] would upload ${contentType} to ${url}`);
    return { url };
  }

  isOwnUrl(url: string): boolean {
    return this.keyOf(url) !== null;
  }

  keyOf(url: string): string | null {
    const prefix = "dev-storage://";
    return url.startsWith(prefix) ? url.slice(prefix.length) || null : null;
  }

  async list(): Promise<StoredObject[]> {
    // Dev no persiste nada, así que nunca hay huérfanos que barrer.
    return [];
  }

  async remove(url: string): Promise<void> {
    console.log(`[storage:dev] would delete ${url}`);
  }
}

let cached: StorageClient | null = null;

export function getStorageClient(): StorageClient {
  if (cached) return cached;
  const bucket = process.env.STORAGE_BUCKET;
  const publicBaseUrl = process.env.STORAGE_PUBLIC_BASE_URL?.replace(/\/$/, "");
  const accessKeyId = process.env.STORAGE_ACCESS_KEY_ID;
  const secretAccessKey = process.env.STORAGE_SECRET_ACCESS_KEY;
  const region = process.env.STORAGE_REGION ?? "auto";
  const endpoint = process.env.STORAGE_ENDPOINT || undefined;

  if (bucket && publicBaseUrl && accessKeyId && secretAccessKey) {
    cached = new S3StorageClient(
      bucket,
      publicBaseUrl,
      region,
      endpoint,
      accessKeyId,
      secretAccessKey,
    );
  } else {
    cached = new DevStorageClient();
  }
  return cached;
}

// Para tests.
export function setStorageClient(client: StorageClient | null): void {
  cached = client;
}
