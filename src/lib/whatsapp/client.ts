import { TEMPLATES, type TemplateName, assertParamCount } from "./templates";

export interface SendTemplateInput {
  to: string;
  template: TemplateName;
  params: string[];
}

export interface SendTemplateResult {
  providerMessageId: string;
}

export interface WhatsAppClient {
  sendTemplate(input: SendTemplateInput): Promise<SendTemplateResult>;
}

class MetaCloudClient implements WhatsAppClient {
  constructor(
    private readonly phoneNumberId: string,
    private readonly accessToken: string,
  ) {}

  async sendTemplate({ to, template, params }: SendTemplateInput): Promise<SendTemplateResult> {
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
        components: [
          {
            type: "body",
            parameters: params.map((text) => ({ type: "text", text })),
          },
        ],
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
  async sendTemplate({ to, template, params }: SendTemplateInput): Promise<SendTemplateResult> {
    assertParamCount(template, params);
    const fakeId = `dev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    console.log(`[whatsapp:dev] → ${to} template=${template} params=${JSON.stringify(params)} id=${fakeId}`);
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

// For tests.
export function setWhatsAppClient(client: WhatsAppClient): void {
  cached = client;
}
