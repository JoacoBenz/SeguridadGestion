// Plantillas pre-aprobadas en Meta Business Manager.
// Los nombres y orden de parámetros tienen que matchear exactamente lo aprobado.

export type TemplateName =
  | "paquete_recibido_v2"
  | "paquete_retirado_v1"
  | "paquete_pendiente_v1"
  | "paquete_escalado_v1"
  | "paquete_foto_v1";

export interface TemplateSpec {
  name: TemplateName;
  language: string;
  bodyParamCount: number;
  // Si la plantilla tiene un header image, hay que mandar headerImageUrl al
  // enviarla. El header no aporta a bodyParamCount.
  hasImageHeader?: boolean;
}

export const TEMPLATES: Record<TemplateName, TemplateSpec> = {
  // Header: image (QR). Body: nombre, edificio, unidad, código.
  paquete_recibido_v2: {
    name: "paquete_recibido_v2",
    language: "es_AR",
    bodyParamCount: 4,
    hasImageHeader: true,
  },
  paquete_retirado_v1: {
    name: "paquete_retirado_v1",
    language: "es_AR",
    bodyParamCount: 2, // fecha de ingreso, hora de retiro
  },
  paquete_pendiente_v1: {
    name: "paquete_pendiente_v1",
    language: "es_AR",
    bodyParamCount: 1, // fecha de ingreso
  },
  // Aviso al admin cuando un paquete lleva demasiados recordatorios sin retirar.
  // Body: unidad, fecha de ingreso, cantidad de recordatorios ya enviados.
  paquete_escalado_v1: {
    name: "paquete_escalado_v1",
    language: "es_AR",
    bodyParamCount: 3,
  },
  // Header: image (la foto real del paquete). Body: unidad. Se manda como
  // segundo mensaje después de paquete_recibido_v2 (una imagen por plantilla,
  // y el header de aquella lo ocupa el QR).
  paquete_foto_v1: {
    name: "paquete_foto_v1",
    language: "es_AR",
    bodyParamCount: 1,
    hasImageHeader: true,
  },
};

export function assertParamCount(name: TemplateName, params: string[]): void {
  const spec = TEMPLATES[name];
  if (params.length !== spec.bodyParamCount) {
    throw new Error(
      `Template ${name} espera ${spec.bodyParamCount} parámetros, recibió ${params.length}`,
    );
  }
}
