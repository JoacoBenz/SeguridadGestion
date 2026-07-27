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
  // Nombres de las variables del body, EN ORDEN. Meta ya no acepta variables
  // posicionales ({{1}}): las plantillas se crean con nombres ({{fecha}}) y al
  // enviar cada parámetro tiene que llevar su parameter_name. El largo de este
  // array es la cantidad de parámetros esperada; el orden es el de los params.
  bodyParamNames: readonly string[];
  // Si la plantilla tiene un header image, hay que mandar headerImageUrl al
  // enviarla. El header no aporta al body.
  hasImageHeader?: boolean;
}

export const TEMPLATES: Record<TemplateName, TemplateSpec> = {
  // Header: image (QR). Body: nombre, edificio, unidad. NO lleva el código de
  // retiro: Meta clasifica cualquier "código corto enviado a una persona" como
  // Authentication y rechaza la plantilla. El QR es el mecanismo de retiro del
  // residente; el código de 6 caracteres es una herramienta del guardia (lo ve
  // en su lista de pendientes) y sigue disponible en la vista mis-paquetes.
  paquete_recibido_v2: {
    name: "paquete_recibido_v2",
    language: "es_AR",
    bodyParamNames: ["nombre", "edificio", "unidad"],
    hasImageHeader: true,
  },
  paquete_retirado_v1: {
    name: "paquete_retirado_v1",
    language: "es_AR",
    bodyParamNames: ["fecha", "hora"],
  },
  paquete_pendiente_v1: {
    name: "paquete_pendiente_v1",
    language: "es_AR",
    bodyParamNames: ["fecha"],
  },
  // Aviso al admin cuando un paquete lleva demasiados recordatorios sin retirar.
  paquete_escalado_v1: {
    name: "paquete_escalado_v1",
    language: "es_AR",
    bodyParamNames: ["unidad", "fecha", "recordatorios"],
  },
  // Header: image (la foto real del paquete). Body: unidad. Se manda como
  // segundo mensaje después de paquete_recibido_v2 (una imagen por plantilla,
  // y el header de aquella lo ocupa el QR).
  paquete_foto_v1: {
    name: "paquete_foto_v1",
    language: "es_AR",
    bodyParamNames: ["unidad"],
    hasImageHeader: true,
  },
};

export function assertParamCount(name: TemplateName, params: string[]): void {
  const expected = TEMPLATES[name].bodyParamNames.length;
  if (params.length !== expected) {
    throw new Error(
      `Template ${name} espera ${expected} parámetros, recibió ${params.length}`,
    );
  }
}
