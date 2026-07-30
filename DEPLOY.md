# Deploy checklist

Producción actual: **Vercel** (app) + **Supabase** (Postgres + Storage) + **Meta WhatsApp Cloud API** + **Resend** (magic-link email).

Todo lo marcado **[vos]** necesita una cuenta/credencial que solo vos podés crear. El código ya está cableado para todo — seteás la env var y se activa; la dejás vacía y la función degrada con gracia (loguea a stdout / esconde la UI). El diagnóstico rápido de config está en `GET /api/health?debug=$CRON_SECRET` (reporta DB y qué `STORAGE_*` faltan, sin exponer valores).

## 1. Base de datos (Supabase)

- [x] Proyecto Supabase creado (`njorckajlftgzruahqfo`, región sa-east-1).
- [ ] **[vos]** `DATABASE_URL` = el URI del **Transaction pooler** (Connect → Transaction pooler, puerto 6543) con **`?pgbouncer=true`** al final. El "Direct connection" NO funciona desde Vercel (es IPv6-only en el plan free). Si la contraseña tiene símbolos (`@ # %`), reseteala a una alfanumérica para evitar URL-encoding.
- [x] Migraciones aplicadas (init + índice único parcial + suscripción). En un entorno nuevo: `pnpm prisma migrate deploy`. **Nunca `db push` en prod.**
- [x] RLS deny-by-default activado en todas las tablas (migración `enable_rls_deny_by_default`). La app usa Prisma (bypassa RLS); esto cierra la Data API pública de Supabase.
- Crear cada edificio real desde `/superadmin` — no correr el seed en prod (el seed es para dev).

## 2. Auth (Resend magic links)

- [x] Dominio `bexovar.com.ar` verificado en Resend.
- [ ] **[vos]** `RESEND_API_KEY` + `EMAIL_FROM` = `PackItO <no-reply@bexovar.com.ar>` (el dominio del From tiene que ser el verificado).
- [ ] `AUTH_SECRET` (`openssl rand -base64 32`). **No** setees `AUTH_URL` en Vercel salvo necesidad — Auth.js detecta el host solo; un `AUTH_URL` que apunte al `.vercel.app` rompe las cookies cuando entrás por el dominio propio.
- Sin `RESEND_API_KEY`, los magic links se imprimen en el log del server en vez de mandarse por email.

## 3. WhatsApp (Meta Cloud API) — **el camino más largo; arrancá temprano**

### 3a. Las 5 plantillas (aprobación 1–3 días texto, 3–5 con imagen)
Crear en Business Manager → categoría **Utility**, idioma **Spanish (ARG) / es_AR**, con estos nombres y **variables NOMBRADAS** exactas (Meta ya no acepta `{{1}}` posicional; el código emite `parameter_name` por posición según `src/lib/whatsapp/templates.ts`):

| Plantilla | Header | Variables (en orden) |
|---|---|---|
| `paquete_recibido_v3` | Image (QR) | `nombre`, `edificio`, `unidad` |
| `paquete_retirado_v1` | — | `fecha`, `hora` |
| `paquete_pendiente_v1` | — | `fecha` |
| `paquete_escalado_v1` | — | `unidad`, `fecha`, `recordatorios` |
| `paquete_foto_v1` | Image (foto real) | `unidad` |

- ⚠️ **Las plantillas pertenecen a una WABA, no a la cuenta.** Si el número de envío vive en una WABA y las plantillas se crearon en otra, Meta responde `132001 — template name does not exist in es_AR` aunque en WhatsApp Manager las veas aprobadas: estás mirando la otra cuenta. Antes de crear nada, confirmá en qué WABA está el número (API Setup → elegí el número en "From" → el *WhatsApp Business Account ID* de abajo es el que vale). `scripts/copy-templates.mjs` copia plantillas entre WABAs por API; las que tienen header de imagen fallan con `100 Invalid parameter` porque su `header_handle` no es transferible — esas se crean a mano.
- **El código de retiro NO va en ninguna plantilla**: Meta clasifica "código corto enviado a una persona" como Authentication y rechaza la Utility. El QR es el mecanismo del residente; el código de 6 caracteres lo ve el guardia en su pantalla y el residente en `mis-paquetes`.
- El idioma tiene que ser **es_AR** en las 5. Una creada como "Spanish" a secas queda en `es` y falla igual que si no existiera; `templates.ts` pide `es_AR` para todas.
- Si una plantilla se rechaza, Meta no deja reusar el nombre → subí el número de versión (por eso `recibido` es `v3`) y actualizá el nombre en `templates.ts`.

### 3b. App, número y credenciales
- [ ] **[vos]** App en developers.facebook.com (tipo Business) + WhatsApp product. **Business verification** iniciada (trámite lento) y app en **Live** (necesita Privacy Policy URL → ya existe en `/privacidad`).
- [ ] **[vos]** Número dedicado registrado en la WABA (WhatsApp → Step 2 Production setup → Register phone number). **Tiene que ser un número que NO esté en la app de WhatsApp** — si lo está, borrá esa cuenta de WhatsApp y esperá ~3 min. Display name: `PackItO`.
- [ ] **[vos]** Método de pago cargado (obligatorio: los mensajes business-initiated se cobran).
- [ ] **[vos]** Token permanente vía System User (business.facebook.com/settings/system-users): Full control sobre la WABA, permisos `whatsapp_business_messaging` + `whatsapp_business_management`, expiración **Never**.
- [ ] Env vars — el código lee **exactamente estas 4** (`src/lib/whatsapp/client.ts` + `src/app/api/whatsapp/webhook/route.ts`): `WHATSAPP_PHONE_NUMBER_ID` (el ID interno del número, no el teléfono), `WHATSAPP_ACCESS_TOKEN` (el permanente del System User), `WHATSAPP_APP_SECRET` (App settings → Basic → Show), `WHATSAPP_WEBHOOK_VERIFY_TOKEN`. El WABA ID no se usa en runtime; guardalo aparte si lo necesitás para la API de plantillas.
- El cliente se activa sólo si están **`WHATSAPP_PHONE_NUMBER_ID` y `WHATSAPP_ACCESS_TOKEN`**; si falta cualquiera de las dos, cae al `LoggingClient` en silencio y los mensajes no salen. Un typo en el nombre de la var se ve igual que "no configurado".

### 3c. Webhook
- [ ] `WHATSAPP_WEBHOOK_VERIFY_TOKEN` = string random. Cargala en Vercel + Redeploy **antes** de verificar en Meta (Meta hace un GET a la URL y compara el token).
- [ ] En Meta (Configure Webhooks): Callback URL `https://packito.bexovar.com.ar/api/whatsapp/webhook`, el verify token, → Verify and save → suscribirse a `messages` (ticks entregado/leído → `Notification.status`).
- Modelo A (un número global para todos los edificios): el mensaje identifica al edificio por el texto. `getWhatsAppClient()` usa `WHATSAPP_PHONE_NUMBER_ID` global; sin creds usa el `LoggingClient`.

## 4. Fotos (Supabase Storage) — opcional, se esconde si falta

- [x] Bucket `paquetes` público en Supabase Storage.
- [ ] **[vos]** S3 Access Keys (Project Settings → Storage → S3 Access Keys). Las 6 vars:
  - `STORAGE_BUCKET` = `paquetes`
  - `STORAGE_ENDPOINT` = `https://njorckajlftgzruahqfo.supabase.co/storage/v1/s3`
  - `STORAGE_REGION` = `sa-east-1`
  - `STORAGE_ACCESS_KEY_ID` / `STORAGE_SECRET_ACCESS_KEY` = las S3 keys
  - `STORAGE_PUBLIC_BASE_URL` = `https://njorckajlftgzruahqfo.supabase.co/storage/v1/object/public/paquetes`
- Con storage configurado, la foto del paquete es **obligatoria** al registrar. Sin las vars, el campo se esconde y el registro sigue funcionando. Cuidado con el nombre EXACTO de cada var (un typo tipo `STORAGE_BUKCET` la deja invisible — verificá con `/api/health?debug=`).

## 5. Cron de recordatorios

- [ ] `CRON_SECRET` = string random. Vercel Cron lo manda como `Authorization: Bearer`; la ruta rechaza sin él en prod. **También habilita `/api/health?debug=` y protege el cron** — sin esta var los recordatorios no salen.
- [x] `vercel.json` agenda `GET /api/cron/reminders` diario 12:00 UTC (≈09:00 ART). Ajustá el horario si querés.
- Umbral de escalamiento por tenant vía `Tenant.settings.reminderEscalateAfter` (default 2).

## 6. Región y ops

- [x] Funciones en `gru1` (São Paulo, junto a la DB) vía `vercel.json` — evita ~140ms por query cross-continente.
- [ ] **[vos]** Monitor de uptime (UptimeRobot gratis) a `GET /api/health`.
- [ ] `PUBLIC_BASE_URL` = `https://packito.bexovar.com.ar` (arma la URL del QR que Meta descarga).
- [ ] **[vos]** `NEXT_PUBLIC_CONTACT_WHATSAPP` = tu número comercial en E.164 **sin `+` ni espacios** (ej. `5491133334444`). Es el destino de los 3 CTA de la landing (`wa.me` con mensaje pre-cargado). Sin esta var los botones caen a un `mailto:` — que en desktop sin cliente de mail configurado no abre nada. Es `NEXT_PUBLIC_*`, así que se inlinea en build: hay que **redeployar** para que tome un cambio.
- [ ] Sentry: no cableado; agregá `@sentry/nextjs` cuando lo necesites.

## 7. Onboarding de un edificio (sin deploy)

1. Crear el tenant en `/superadmin` (slug + email del primer admin; arranca en trial de 14 días).
2. El admin entra por magic link → `/[slug]/admin`.
3. Cargar unidades (`/admin/unidades`, formato `<números><letra>` ej. 3B) y residentes (`/admin/importar` con CSV `unidad,nombre,telefono,email`, o uno por uno).
4. Gestionar más admins/guardias por email en `/admin/equipo`.
5. Configurar el **PIN de conserjería** en `/[slug]/admin` para la tablet del mostrador.

## Pre-flight

- [ ] `pnpm typecheck && pnpm lint && pnpm test` en verde (81 unit tests).
- [ ] `pnpm test:e2e` en verde (20 tests; en sandbox sin CDN, `PW_CHROMIUM_EXECUTABLE`).
- [ ] `pnpm build` OK (CI ya lo corre sobre Postgres real + migraciones + seed).
