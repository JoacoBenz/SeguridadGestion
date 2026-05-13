// Plantillas pre-aprobadas en Meta Business Manager.
// Los nombres y orden de parámetros tienen que matchear exactamente lo aprobado.

export type TemplateName =
  | "paquete_recibido_v1"
  | "paquete_retirado_v1"
  | "paquete_pendiente_v1";

export interface TemplateSpec {
  name: TemplateName;
  language: string;
  paramCount: number;
}

export const TEMPLATES: Record<TemplateName, TemplateSpec> = {
  paquete_recibido_v1: {
    name: "paquete_recibido_v1",
    language: "es_AR",
    paramCount: 5, // nombre, unidad, edificio, código, link
  },
  paquete_retirado_v1: {
    name: "paquete_retirado_v1",
    language: "es_AR",
    paramCount: 2, // fecha de ingreso, hora de retiro
  },
  paquete_pendiente_v1: {
    name: "paquete_pendiente_v1",
    language: "es_AR",
    paramCount: 1, // fecha de ingreso
  },
};

export function assertParamCount(name: TemplateName, params: string[]): void {
  const spec = TEMPLATES[name];
  if (params.length !== spec.paramCount) {
    throw new Error(
      `Template ${name} espera ${spec.paramCount} parámetros, recibió ${params.length}`,
    );
  }
}
