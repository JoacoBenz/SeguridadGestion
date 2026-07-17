import type { NotificationStatus } from "@prisma/client";

// Meta puede entregar callbacks fuera de orden (un "delivered" después del
// "read"). El estado de una Notification solo avanza: queued → sent →
// delivered → read; failed puede pisar cualquier estado salvo read.
// Módulo puro, separado del route handler para poder unit-testearlo.

export type IncomingWebhookStatus = "sent" | "delivered" | "read" | "failed";

export function mapWebhookStatus(s: string): IncomingWebhookStatus | null {
  switch (s) {
    case "sent":
    case "delivered":
    case "read":
    case "failed":
      return s;
    default:
      return null;
  }
}

// Estados actuales que el status entrante tiene permitido sobreescribir.
export function overwritableStatuses(
  incoming: IncomingWebhookStatus,
): NotificationStatus[] {
  switch (incoming) {
    case "sent":
      return ["queued"];
    case "delivered":
      return ["queued", "sent"];
    case "read":
      return ["queued", "sent", "delivered"];
    case "failed":
      return ["queued", "sent", "delivered"];
  }
}
