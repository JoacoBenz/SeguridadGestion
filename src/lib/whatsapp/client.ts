import { TEMPLATES, type TemplateName, assertParamCount } from "./templates";

export interface SendTemplateInput {
  to: string;
  template: TemplateName;
  params: string[];
  // Requerido para plantillas con hasImageHeader. Meta descarga la imagen al
  // armar el mensaje, así que tiene que ser una URL pública.
  headerImageUrl?: string;
}

export interface SendTemplateResult {
  providerMessageId: string;
}

export interface WhatsAppClient {
  sendTemplate(input: SendTemplateInput): Promise<SendTemplateResult>;
}

interface TemplateComponent {
  type: "header" | "body";
  parameters: Array<
    | { type: "text"; parameter_name: string; text: string }
    | { type: "image"; image: { link: string } }
  >;
}

// Exportado para test: es la forma exacta del payload que Meta valida.
export function buildComponents(
  template: TemplateName,
  params: string[],
  headerImageUrl?: string,
): TemplateComponent[] {
  const spec = TEMPLATES[template];
  const components: TemplateComponent[] = [];

  if (spec.hasImageHeader) {
    if (!headerImageUrl) {
      throw new Error(`Template ${template} requires headerImageUrl`);
    }
    components.push({
      type: "header",
      parameters: [{ type: "image", image: { link: headerImageUrl } }],
    });
  }

  // Named parameters: Meta exige parameter_name por cada variable del body,
  // apareado por posición con los nombres declarados en la plantilla.
  components.push({
    type: "body",
    parameters: params.map((text, i) => ({
      type: "text",
      parameter_name: spec.bodyParamNames[i]!,
      text,
    })),
  });

  return components;
}

class MetaCloudClient implements WhatsAppClient {
  constructor(
    private readonly phoneNumberId: string,
    private readonly accessToken: string,
  ) {}

  async sendTemplate({
    to,
    template,
    params,
    headerImageUrl,
  }: SendTemplateInput): Promise<SendTemplateResult> {
    assertParamCount(template, params);
    const spec = TEMPLATES[template];
    const url = `https://graph.facebook.com/v21.0/${this.phoneNumberId}/messages`;

    const body = {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: spec.name,
        language: { code: spec.language },
        components: buildComponents(template, params, headerImageUrl),
      },
    };

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Meta API ${res.status}: ${errorText}`);
    }

    const json = (await res.json()) as { messages?: Array<{ id: string }> };
    const messageId = json.messages?.[0]?.id;
    if (!messageId) {
      throw new Error("Meta API no devolvió message id");
    }
    return { providerMessageId: messageId };
  }
}

class LoggingClient implements WhatsAppClient {
  async sendTemplate({
    to,
    template,
    params,
    headerImageUrl,
  }: SendTemplateInput): Promise<SendTemplateResult> {
    assertParamCount(template, params);
    if (TEMPLATES[template].hasImageHeader && !headerImageUrl) {
      throw new Error(`Template ${template} requires headerImageUrl`);
    }
    const fakeId = `dev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    console.log(
      `[whatsapp:dev] → ${to} template=${template} params=${JSON.stringify(params)}${
        headerImageUrl ? ` headerImage=${headerImageUrl}` : ""
      } id=${fakeId}`,
    );
    return { providerMessageId: fakeId };
  }
}

let cached: WhatsAppClient | null = null;

export function getWhatsAppClient(): WhatsAppClient {
  if (cached) return cached;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (phoneNumberId && accessToken) {
    cached = new MetaCloudClient(phoneNumberId, accessToken);
  } else {
    cached = new LoggingClient();
  }
  return cached;
}

// For tests. Pass null to clear the cache and let getWhatsAppClient() re-resolve from env.
export function setWhatsAppClient(client: WhatsAppClient | null): void {
  cached = client;
}
