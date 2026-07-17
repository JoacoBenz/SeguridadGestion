# Deploy checklist

Target: **Vercel + Neon** (Postgres) + **Cloudflare R2** (photos) + **Meta WhatsApp Cloud API** + **Resend** (magic-link email).

Everything below marked **[you]** needs an account/credential only you can create. The code is already wired for all of it — set the env var and it activates; leave it empty and the feature degrades gracefully (logs to stdout / hides the UI).

## 1. Database (Neon)

- [ ] **[you]** Create a Neon project, copy the pooled connection string into `DATABASE_URL`.
- [ ] Run migrations against it: `pnpm prisma migrate deploy` (there are now 2 migrations — a baseline and the partial unique index). **Do NOT use `db push` in prod.**
- [ ] Seed only if you want the demo tenant: `pnpm db:seed` (creates `edificio-libertad` + test users). Skip for a real first tenant; create it via `/superadmin`.

## 2. Auth (Resend magic links)

- [ ] **[you]** Create a Resend account, verify your sending domain, get an API key.
- [ ] Set `RESEND_API_KEY`, `EMAIL_FROM` (e.g. `PaqueteOK <no-reply@tudominio.com>`).
- [ ] Set `AUTH_SECRET` (generate: `openssl rand -base64 32`) and `AUTH_URL` = your prod URL.
- Without `RESEND_API_KEY`, magic links print to the server log instead of emailing — fine for staging, not for real users.

## 3. WhatsApp (Meta Cloud API) — **start early, approval takes days**

- [ ] **[you]** Meta Business account + WhatsApp Business Platform app. Get `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN` (permanent token), `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_APP_SECRET`.
- [ ] **[you]** Submit the message templates for approval in Meta Business Manager. Names/params must match `src/lib/whatsapp/templates.ts` exactly:
  - `paquete_recibido_v2` — **image header** (the QR) + 4 body params `{nombre, edificio, unidad, código}`. Media-header templates take **3–5 days**.
  - `paquete_retirado_v1` — 2 body params `{fecha ingreso, hora retiro}`. Text-only, 1–3 days.
  - `paquete_pendiente_v1` — 1 body param `{fecha ingreso}`.
  - `paquete_escalado_v1` — **NEW**, 3 body params `{unidad, fecha ingreso, cantidad de recordatorios}`. Submit this one too or escalation sends will fail.
- [ ] Set `WHATSAPP_WEBHOOK_VERIFY_TOKEN` (any long random string), then register the webhook in Meta:
  - Callback URL: `https://<prod>/api/whatsapp/webhook`
  - Verify token: the value you set.
  - Subscribe to `messages` (delivery/read receipts).
- Without WhatsApp creds, sends log to stdout (`[whatsapp:dev]`) — the app still works, residents just don't get real messages.

## 4. Photo storage (Cloudflare R2) — optional, hides itself if unset

- [ ] **[you]** Create an R2 bucket + an API token (Access Key ID / Secret).
- [ ] Make the bucket publicly readable (r2.dev subdomain or a custom domain) — photos are viewed in the admin panel and must be fetchable.
- [ ] Set: `STORAGE_BUCKET`, `STORAGE_ENDPOINT` (`https://<accountid>.r2.cloudflarestorage.com`), `STORAGE_REGION=auto`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`, `STORAGE_PUBLIC_BASE_URL` (the public bucket URL).
- If any are empty, the photo-capture UI is hidden in the conserjería and nothing breaks. (Works with any S3-compatible provider, not just R2.)

## 5. Reminder cron

- [ ] Set `CRON_SECRET` (any long random string). Vercel Cron sends it as `Authorization: Bearer <CRON_SECRET>`; the route rejects requests without it in production.
- [ ] `vercel.json` already schedules `GET /api/cron/reminders` daily at 12:00 UTC. Adjust the time if you want it in AR business hours (e.g. `0 13 * * *` ≈ 10am ART).
- Escalation threshold is per-tenant via `Tenant.settings.reminderEscalateAfter` (default 2). No env needed.

## 6. Ops (recommended before a real pilot) — **[you]**

- [ ] **Sentry** (or similar) for error tracking. Not yet wired — add `@sentry/nextjs` when you're ready.
- [ ] **Uptime monitor** pointed at `GET /api/health` (returns `{status:"ok",db:"up"}`, 503 if DB down).
- [ ] **Neon backup/PITR** policy — confirm retention is on for the plan you pick.
- [ ] Set `PUBLIC_BASE_URL` to your prod URL (used to build the QR image URL Meta downloads).

## 7. Per-building onboarding (no deploy, but worth documenting for yourself)

1. Create the tenant in `/superadmin` (sets slug + first admin email).
2. Admin logs in via magic link → `/[slug]/admin`.
3. Bulk-load units + residents via **`/[slug]/admin/importar`** (paste CSV: `unidad,nombre,telefono,email`).
4. Set the **conserjería PIN** in `/[slug]/admin` so the desk tablet can unlock at `/[slug]/conserjeria/desbloquear` without per-guard email.

## Pre-flight

- [ ] `pnpm typecheck && pnpm lint && pnpm test` green.
- [ ] `pnpm test:e2e` green (needs `npx playwright install chromium` once).
- [ ] `pnpm build` succeeds (not yet run in this session — do it before first deploy).
