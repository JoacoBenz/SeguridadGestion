# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

PackItO is a multi-tenant PWA that digitizes package handoffs at residential building security desks. The 24/7 guard registers an incoming package; the resident gets an instant WhatsApp with a 6-character pickup code + QR; the guard processes pickup by scanning the QR or typing the code. Designed as a SaaS for many buildings (consorcios) from day 1, not a single-building tool.

The full design rationale lives in `/root/.claude/plans/hablando-con-la-seguridad-recursive-badger.md`. Read it before changing the data model, multi-tenancy model, or notification flow.

## Common commands

```bash
pnpm install
docker compose up -d postgres        # local Postgres on :5432
pnpm db:migrate                       # prisma migrate dev
pnpm db:seed                          # seeds tenant "edificio-libertad" with units + residents

pnpm dev                              # Next.js on :3000
pnpm typecheck                        # tsc --noEmit
pnpm lint
pnpm test                             # vitest run (unit + integration)
pnpm test -- tests/unit/codes.test.ts # single file
pnpm test:e2e                         # Playwright
pnpm db:studio                        # browse DB
```

There is no production deploy script yet. Target deploy: Vercel + Neon.

## Architecture — the parts that need cross-file context

### Multi-tenancy
- **Shared database, `tenantId` column on every domain table** (`User`, `Unit`, `UnitResident`, `Package`, `Notification`, `AuditLog`). `Tenant` = a building.
- The URL shape is `/{tenant-slug}/...`. Pages resolve the slug to a `tenantId` via `prisma.tenant.findUnique({ where: { slug } })` and use that ID for all queries.
- Server actions take `tenantId` explicitly and pass it to `requireTenantRole(tenantId, [...])` in `src/lib/auth.ts` before doing anything. **Never trust client-supplied `tenantId` without that check** — it's the only thing keeping tenants isolated until row-level security is added.
- Pickup-code uniqueness is per-tenant **and only across active packages** (`status = 'awaiting_pickup'`). The Prisma schema can't express a partial unique index, so it lives in a hand-written migration (`Package_tenantId_pickupCode_active_key`). `generateUniquePickupCode()` (`src/lib/codes.ts`) pre-checks to avoid collisions, and `registerPackage` retries on `P2002` for the race window between check and insert. Keep all three layers if you touch any of them.
- **Auth must be enforced per page, not per layout.** Next.js renders layouts and pages in parallel, so a guard in `layout.tsx` does not protect the page's own data fetching. Every page under `/[tenant]/admin`, `/[tenant]/seguridad` and `/superadmin` calls `requireTenantRoleOrRedirect()` / `requireSuperadminOrRedirect()` itself; the layout checks are defense in depth only. `src/middleware.ts` adds an *optimistic* cookie-presence redirect to `/login` — it never authorizes anything.

### Package lifecycle
A `Package` moves: `awaiting_pickup → picked_up | cancelled`. Three server actions in `src/server/packages/` own all transitions:
- `register.ts` — creates the package, generates code+token, fires WhatsApp to every resident of the unit. **Refuses to create the package if the unit has nobody reachable** (`UNIT_WITHOUT_RESIDENTS` / `UNIT_WITHOUT_PHONES`): a package nobody gets told about just sits on the counter until someone notices. Failing while the guard still holds the parcel is the only moment the problem is cheap to fix.
- `pickup.ts` — accepts either `pickupCode` (manual entry) or `pickupToken` (QR scan), marks `picked_up`, fires confirmation WhatsApp.
- `cancel.ts` — admin/guard escape hatch.

Report metrics live in `src/server/admin/reports.ts`, not inside the page, so the counting is testable. The subtlety worth keeping: `pickedUpFromCohort` (of the packages *received* this month, how many are picked up) is the only figure comparable against `received` — dividing by "pickups that happened this month" mixes cohorts and yields rates above 100%.

All three call `recordAudit()` and use `requireTenantRole()`. Adding any new state transition? Do it in `src/server/packages/`, not inline in pages.

### WhatsApp integration
- `src/lib/whatsapp/client.ts` exposes `getWhatsAppClient(): WhatsAppClient`. It returns `MetaCloudClient` if `WHATSAPP_PHONE_NUMBER_ID` and `WHATSAPP_ACCESS_TOKEN` are set, otherwise a `LoggingClient` that logs to stdout. **In dev with no creds, messages don't go anywhere — they're just logged.** Don't add fallback "console.warn" branches in business logic; the client abstraction handles it.
- `src/lib/whatsapp/templates.ts` declares the pre-approved Meta templates. Adding a new message means: (1) register the template in Meta Business Manager, (2) add it to `TEMPLATES` with the exact `bodyParamCount` and `hasImageHeader` flag, (3) `assertParamCount()` will throw at runtime if a caller passes the wrong number. Templates with `hasImageHeader: true` require `headerImageUrl` in `sendTemplate()`; the client builds a `header` component with `{ type: "image", image: { link } }`. Dev iteration on copy is blocked on Meta approval (1-3 days for text-only, 3-5 days for templates with media headers) — plan accordingly.
- `setWhatsAppClient()` is for tests only.
- Inbound delivery/read receipts hit `src/app/api/whatsapp/webhook/route.ts`. The route verifies `X-Hub-Signature-256` with `WHATSAPP_APP_SECRET` and updates `Notification.status` by `providerMessageId`.

### Resident notification — message, not page
- There is **no public page** for the resident. The full notification — QR + code + instructions — is delivered as a single WhatsApp template message (`paquete_recibido_v3`) with the QR as the header image. Forwarding the message also forwards the QR.
- The QR is served on demand by `src/app/api/qr/[token]/route.ts` as a PNG. Meta downloads it once when constructing the message. The endpoint is public (the token is the capability) and serves `Cache-Control: public, max-age=31536000, immutable` since a token's QR is invariant. It 404s for unknown tokens to avoid being a generic QR generator.
- **The QR encodes the raw token, not a URL.** `extractPickupToken()` accepts both shapes, but new packages emit raw-token QRs so the system has no implicit dependency on a webpage existing. If you reintroduce a resident-facing page, add it without touching the QR contract.

### Auth
- Auth.js v5 (NextAuth beta) is wired in `src/lib/auth/config.ts` using the Prisma adapter and the **Resend** email provider with database sessions. Magic links are the only sign-in method.
- All outbound mail goes through `sendEmail()` in `src/lib/email.ts` (same degrade-to-stdout pattern as the WhatsApp and storage clients). It returns `false` instead of throwing, because its callers already persisted their result — Resend being down must not undo a building that was just created. The magic-link provider is the one exception: it re-throws, since without the mail there is no access.
- **Creating a tenant or adding a team member sends a welcome email** (`src/lib/auth/welcome-email.ts`). It deliberately carries **no magic link**: links live 10 minutes and this mail is typically read hours later, so the recipient would meet the product through an "este link ya no sirve" screen. It points at `/login?email=…`, which prefills the form so the first link is one click away. That URL deliberately does **not** send the mail by itself: mail clients prefetch links to scan them, which would burn the 3-pending-token throttle before the recipient ever clicks.
- In dev with no `RESEND_API_KEY`, magic links are **logged to stdout** instead of being emailed. Look for `[auth:dev] Magic link for ...` in the `pnpm dev` console — that's your "inbox".
- Auth.js requires `email` to be globally unique, which is why `User.email` carries `@unique` (not `@@unique([tenantId, email])`). One person across multiple buildings = multiple User rows. Don't reintroduce composite uniqueness on email.
- `User.phone` is the opposite: unique **per tenant** (`@@unique([tenantId, phone])`), NOT global. The same number must be able to receive WhatsApp in several buildings (a son getting notifications for his mother's building); within one building it stays unique so a double-add can't duplicate the sends. Don't make phone globally unique again — `duplicateMessage()` in `src/server/admin/residents.ts` maps the composite P2002 to a per-field message.
- **The Prisma adapter is wrapped** (`config.ts`): its stock `deleteSession` uses `delete()`, which throws `P2025` when the row is gone. A cookie pointing at a session that no longer exists — pruned, restored from backup, deleted by hand — then fails the *whole* login with `AdapterError`, which the UI renders as "problema de configuración"; the only escape is clearing cookies, which no user will figure out. `deleteMany` is idempotent and is the correct semantics for "close this session". Same class of trap as `User.name`, which needs its `@default("")` because Auth.js calls `createUser` with only `{ id, email, emailVerified }`.
- `src/lib/auth.ts` is the consumer-facing API: `getSession()`, `requireSession()`, `requireTenantRole()`. The default resolver delegates to Auth.js's `auth()`. Tests override with `setSessionResolver()` / `resetSessionResolver()`.
- Pages should use `requireSessionOrRedirect()` / `requireTenantRoleOrRedirect()` (redirect to `/login` or `/403`). Server actions use the throwing `requireSession()` / `requireTenantRole()` (Zod-style errors that the form handler turns into a redirect with `?error=`).
- Roles are an enum in Prisma: `superadmin | admin | guard | resident`. New users default to `resident` with `tenantId = null` and land on `/sin-edificio` until an admin assigns them. Tenant scoping is bypassed for `superadmin`; everyone else must match `session.tenantId === tenantId`.
- **Device-PIN flow is implemented** (see "Device-PIN" under Operational pieces): a long-lived signed cookie per seguridad device, unlocked by a per-building PIN. `getSession()` falls back to it as a `guard` session. Guards can still sign in by email.

### Routing
- `src/app/[tenant]/seguridad/...` — guard + admin: register, retire, list pending.
- `src/app/[tenant]/admin/...` — admin only. Layout gates with `requireTenantRoleOrRedirect(["admin"])`. Sub-routes: `unidades`, `residentes`, `paquetes`, `reportes`. Server actions live in `src/server/admin/{units,residents,packages}.ts` and re-resolve the tenant from the slug to verify membership before any write.
- `src/app/superadmin/...` — superadmin only (not under `[tenant]`). Lists tenants and creates new ones. `src/server/superadmin/tenants.ts::createTenantAction` creates the tenant + upserts an admin user with the supplied email; that user's first login is a magic link.
- `src/app/api/qr/[token]/route.ts` — public PNG of the pickup QR. See "Resident notification" above for the contract.
- `src/app/api/auth/[...nextauth]/route.ts` — Auth.js handlers.
- `src/app/api/whatsapp/webhook/route.ts` — Meta callbacks.
- `src/app/login`, `src/app/sin-edificio`, `src/app/403` — auth-related public/intermediate pages.

### Admin & superadmin
- **Admin server actions** all follow the same shape: `(slug: string, formData: FormData) => Promise<void>`, called via `action.bind(null, slug)` in the page. They re-resolve the tenant from the slug and call `requireTenantRole(tenantId, ["admin"])` — never trust the slug alone. On Prisma FK errors (`P2003`) they surface a friendly message ("la unidad tiene paquetes asociados, cancelalos primero") instead of letting Next.js error-boundary it. Every mutation writes a `recordAudit()` entry.
- **Cancel** uses the existing `src/server/packages/cancel.ts`; the admin page just wraps it. The audit log records who cancelled and why.
- **Residents list** is built for hundreds of rows: search (a query that parses as a unit label matches that unit *exactly*), pagination, a collapsed create form, and compact rows whose edit/delete live in a native `<dialog>`. Expanding a form inline pushed the list and hid the person being edited; a modal centers over everything and keeps the row two lines tall. Delete asks for confirmation.
- **Residents**: creating a resident creates a `User` (role=resident, with tenantId) **and** the `UnitResident` join in a single action. "Borrar" deletes the User row; if they have `Package.receivedBy`/`pickedUpBy` history, the FK restrict bubbles up as a clear error pointing to "Desvincular" instead. "Desvincular" only deletes the `UnitResident` row, preserving package history.
- **Superadmin** does NOT receive a `tenantId` (they're cross-tenant); `requireTenantRole` bypasses tenant scoping for them, so they can land in any `/[tenant]/admin` directly. The `/superadmin/...` routes additionally check `session.role === "superadmin"` and bounce to `/403` otherwise.

### Pickup by QR vs code
- The seguridad has two parallel entry points for retiros: `PickupQrScanner` (client component, opens the rear camera via `@yudiel/react-qr-scanner`) and a plain text input.
- Both end up in `src/server/packages/pickup-actions.ts`. The QR path passes the scanned URL — `extractPickupToken()` in `src/server/packages/pickup-token.ts` (a pure module, kept separate from the `"use server"` boundary so it's unit-testable) strips host/query/fragment and validates the format. Random scanned strings never reach the DB.
- Don't bypass `pickup-actions.ts` to call `pickupPackage()` directly from a client — server actions are the auth/audit boundary.
- **`redirect()` in server actions throws `NEXT_REDIRECT`** — never wrap a success `redirect()` inside a `try/catch` that catches all errors, or the success path gets swallowed and converted into `?error=NEXT_REDIRECT`. Move success redirects outside the `try` block.

## Conventions specific to this project

- **Spanish in user-facing strings, English in code.** UI copy, audit `action` strings as user sees them, and template names are Spanish (`paquete_recibido_v3`). Identifiers, comments, and error codes thrown from server actions (`PACKAGE_NOT_FOUND`, `FORBIDDEN_TENANT`, `INVALID_CODE`) are English so they're greppable.
- **Pickup codes use a Crockford-ish alphabet** (`23456789ABCDEFGHJKMNPQRSTVWXYZ`) — no `0/O/1/I/L/U`. Don't expand the alphabet without changing `isValidPickupCode` and the unit tests; ambiguity at the desk is the whole reason it's restricted.
- **Audit everything that changes a `Package`.** `recordAudit()` is one line; skipping it loses the only durable trail for disputes ("ese paquete no llegó nunca").
- **Server actions validate input with Zod** at the boundary, then trust the parsed object. Don't re-validate downstream.
- **Timezone is `America/Argentina/Buenos_Aires` by default per tenant** (`Tenant.timezone`). Store UTC; format through `src/lib/datetime.ts`, never `toLocaleString` directly — the bare call formats in the *server's* zone (UTC on Vercel) and es-AR defaults to 12h without a meridiem, so 13:52 renders as "01:52" and looks plausible. The same applies to date *maths*: `startOfMonthInTimeZone()` exists because `new Date(y, m, 1)` starts the month at 21:00 of the previous day in Argentina, putting three hours of packages in the wrong month.

### Subscription / billing (manual for now)
- `Tenant.subscriptionStatus` (`trial | active | past_due | suspended`) + `trialEndsAt`. No payment gateway yet: the **superadmin flips states** from `/superadmin` (Activar / Suspender / +14 días). New tenants start as 14-day `trial`; `past_due` still operates (grace).
- **Policy: a blocked tenant (suspended or expired trial) cannot REGISTER new packages, but pickups and cancellations of pending packages always work** — residents never lose access to packages already at the desk. The gate lives in `registerPackage` (throws `SUBSCRIPTION_INACTIVE`) + a blocked screen on the ingreso page; seguridad/admin show warning banners. Pure rules in `src/lib/subscription.ts` (unit-tested).

### Reminders cron + escalation
- `/api/cron/reminders` (Vercel Cron daily, see `vercel.json`; auth `Bearer ${CRON_SECRET}`) sends `paquete_pendiente_v1` for packages awaiting pickup ≥3 days. Cooldown of 3 days between reminders per package, deduced from the latest `Notification` with that template — idempotent across runs. Policy is pure in `src/server/packages/reminder-policy.ts`; sender in `reminders.ts`. Non-operational tenants are skipped.
- **Escalation**: once a package has ≥ `Tenant.settings.reminderEscalateAfter` (default 2) resident reminders and is still pending, `sendPendingReminders` notifies the tenant's admins once via `paquete_escalado_v1` (guarded by an existing escalation notification) instead of nudging the resident again, and writes a `package.reminder_escalated` audit entry.

### Photo upload
- `src/lib/storage/client.ts` mirrors the WhatsApp-client pattern — real S3/R2 client when `STORAGE_*` env is set, else a dev no-op returning `dev-storage://` URLs. Upload via `POST /api/upload?slug=` (guard/admin auth, 8MB cap, jpeg/png/webp). Only the URL lands in `Package.photoUrl`/`pickupPhotoUrl`; the bytes live in the bucket under `packages/{tenantId}/{uuid}.{ext}`. Admin paquetes list renders the photo. Pickup-photo capture is deferred (column + action support exist).
- **The bucket is PRIVATE; reads go through short-lived signed URLs.** `Package.photoUrl` stores the canonical unsigned URL — signing happens only at the two consumption points: `register.ts` signs a 6h URL for Meta (which downloads the image once and re-hosts it on WhatsApp's CDN, so expiry never affects recipients) and the admin paquetes page signs 15-min URLs per render. **Never persist a signed URL**: retention, the orphan sweep and `PHOTO_IN_USE` all compare exact canonical strings. Signed URLs point at the S3 ENDPOINT host (not the public domain), which is why `storageImgSource()` in `next.config.ts` puts both origins in `img-src`. Deploy order when rotating buckets: deploy code first, flip the bucket to private after (signed URLs work against a public bucket; the reverse breaks sends).
- **What the building chooses vs. what the system fixes.** Per-tenant (`Tenant.settings`, edited in `/[tenant]/admin`): `photoMode` (`required` | `optional` | `disabled`, default `required`). Fixed by the system and deliberately NOT exposed: `PHOTO_RETENTION_DAYS` (30) — a privacy decision, not an operational preference. The front-desk copy (`Tenant.settings.seguridadPhone`, a number that gets a `paquete_foto_v1` copy of each package photo) is **hidden**: `photoCopyPhone()` and the send path in `register.ts` still work if the setting exists in the DB, but the admin UI no longer offers the field, so no tenant can set it. Re-exposing it = adding the input back in `/[tenant]/admin` + the field in `setPhotoSettingsAction`. Pure rules in `src/lib/photo-policy.ts`; `shouldShowPhotoField()` / `isPhotoRequired()` fold in whether storage is configured at all, so callers ask those two rather than combining flags themselves.
- **`photoMode` gates the guard's UI, not the send.** `registerPackage` decides by the presence of `photoUrl`, so flipping the mode while a form is open can't leave a package with a stored photo and no message. Locked by `tests/integration/register-package.test.ts`.
- **`photoUrl` / `pickupPhotoUrl` arrive as client-controlled form fields.** `registerPackage` and `pickupPackage` reject anything `storage.isOwnUrl()` doesn't recognise (`INVALID_PHOTO_URL`). Without that check a guard could point them at any host: the URL is sent to Meta as the message's header image (arbitrary content from the building's official number) and rendered as `<img src>` in the admin panel.
- **Retention**: `/api/cron/photo-retention` (daily, same `CRON_SECRET` auth as reminders) deletes bucket objects for `picked_up`/`cancelled` packages past the 30-day window and nulls the column. Photos of *pending* packages are never deleted regardless of age. Order matters — bucket first, row second: the reverse would orphan files with nothing referencing them. `storage.remove()` no-ops on URLs outside the configured bucket (`keyFromPublicUrl` returns null), so a dev URL or a stale bucket can't cause a wrong delete. The same route then runs `purgeOrphanPhotos()`: `PhotoCapture` uploads on file pick, before the form is submitted, so a retaken photo or an abandoned form leaves a file no row references — and the row-driven pass can't see it. The sweep lists the bucket, skips anything newer than 24h (a form may still be open), and deletes what no `Package` points at.

### CSV import
- `/[tenant]/admin/importar` — paste `unidad,nombre,telefono,email`, dry-run preview, then confirm. Pure parser in `src/server/admin/import-parse.ts` (unit-tested, like `pickup-token.ts`); `importResidentsAction` upserts units by label, creates residents, **skips duplicate phones/emails**, aborts writing nothing if any row has a format error.

### Device-PIN (shared seguridad device)
- Admin sets a per-building PIN in `/[tenant]/admin` (scrypt-hashed in `Tenant.settings.guardPinHash`); the device unlocks at `/[tenant]/seguridad/desbloquear` and gets a **signed cookie** (`src/lib/auth/device.ts`, HMAC over `AUTH_SECRET`). `getSession()`'s default resolver falls back to that cookie → a `guard` session for a synthetic per-tenant device user. **Single insertion point** — no page/action changed. Guards can still sign in by email.

## Operational pieces

- **Migrations are committed** (`prisma/migrations/`) with a baseline (`20260717000000_init`). `pnpm db:migrate` for dev, `pnpm db:deploy` for prod/CI. Don't `db push` against a DB that has the `_prisma_migrations` table. The partial unique index on active pickup codes lives in a custom migration (`(tenantId, pickupCode) WHERE status='awaiting_pickup'`) — Prisma can't model it, so a `prisma migrate dev` after schema edits will NOT try to drop it, but double-check generated SQL. `generateUniquePickupCode()` still pre-checks and `registerPackage` retries on `P2002`; the index is the backstop.
- **CI** (`.github/workflows/ci.yml`) runs typecheck, lint, unit tests, then applies migrations + seed against a real Postgres service container and finishes with `next build`. If you add a migration, CI is what proves it applies cleanly on an empty DB.
- **Rate limiting**: magic-link sends are throttled durably by counting unexpired `VerificationToken` rows per email (max 3 in flight; tokens last 10 min via `maxAge` in the Resend provider). `/api/qr/[token]`, the login action and the PIN unlock use `src/lib/rate-limit.ts` (async), which picks its backend per call: with `UPSTASH_REDIS_REST_URL`+`UPSTASH_REDIS_REST_TOKEN` set it's a fixed window in Upstash Redis via REST (INCR+PEXPIRE pipeline, plain fetch, no dependency) — a real cross-instance limit; without them it falls back to the in-memory per-instance map (dev, or until the account exists). Both backends fail open: a broken store lets traffic through, never blocks legitimate users.
- **`/api/health`** — DB-touching health check for uptime monitors; returns `{ok,db}` with 200/503, no data.
- **Sentry** (`@sentry/nextjs`, org `bexovar` / project `packito`): errors only — tracing and replay deliberately off (quota + bundle). Off entirely when `NEXT_PUBLIC_SENTRY_DSN` is unset (dev). Server/RSC/action errors via `onRequestError` in `src/instrumentation.ts`; browser errors via `src/instrumentation-client.ts` **tunneled through `/monitoring`** so the CSP keeps `connect-src 'self'` — don't add Sentry's ingest host to the CSP, the tunnel exists for that. `error.tsx` / `global-error.tsx` call `Sentry.captureException` because React error boundaries swallow exceptions (they still log the `digest`, which ties what the user saw to the server log line). Source maps upload needs `SENTRY_AUTH_TOKEN` at build; without it the build still passes.
- **Instalación como app**: `InstallHint` en `/login` explica el gesto según la plataforma. Es sólo instructivo a propósito — sin service worker no hay `beforeinstallprompt` en Chrome, y en iOS la API no existe con o sin él. Se esconde solo si ya corre en standalone, y el descarte queda en `localStorage`. Ojo con iPadOS 13+: se presenta como "Macintosh" y `maxTouchPoints` es lo único que lo distingue de una Mac (`src/lib/install-hint.ts`, unit-tested).
- **PWA**: `public/manifest.webmanifest` + `icon.svg`/`icon-192.png`/`icon-512.png` (dark background `#0A0A0B`, amber accent — regenerate the PNGs from the SVG if the brand changes). `start_url` is `/login` so an installed app lands wherever the session dictates.
- **e2e** (`tests/e2e/`, `pnpm test:e2e`, wired into CI after `next build`): needs a built app and a migrated+seeded DB. Playwright starts `next start` itself, redirecting stdout to a file so tests can read the logged magic links (`loginViaMagicLink` in `helpers.ts`). Sessions are created once per role in `auth.setup.ts` and persisted as storageState — don't log in inside specs, it burns the 3-magic-links-per-email throttle. `smoke.spec.ts` covers unauthenticated surfaces; `package-lifecycle` and `subscription` cover the authenticated flows. `tests/integration` (vitest, misma corrida que unit) prueba `registerPackage`, `pickupPackage`, `cancelPackage` y `sendPendingReminders` contra el Postgres real con WhatsApp y storage stubeados — es donde se fijan invariantes que ningún módulo puro puede cubrir, como que sin `photoUrl` **no** salga `paquete_foto_v1` ni la copia a la seguridad. Por eso CI corre `db:deploy` antes de `pnpm test`. Unit tests stay in `tests/unit` (vitest); `testDir` scopes Playwright to `tests/e2e` so the two never collide. In sandboxes without access to Playwright's CDN, point `PW_CHROMIUM_EXECUTABLE` at an existing Chromium.

See `DEPLOY.md` for the full prod checklist (Neon, Resend, Meta templates incl. `paquete_escalado_v1`, R2, cron secret).

## What's intentionally not built yet

These are deferred to later phases — don't add them speculatively:
- Offline mode for the seguridad form (PWA + IndexedDB queue).
- Push notifications.
- Delegation links (separate from sharing the WhatsApp link).
- Payment gateway (Stripe/MercadoPago) — subscription state exists but is flipped manually by superadmin.
- Postgres row-level security as a second tenant-isolation layer.
- Pickup-photo capture UI (the storage backend and `pickupPhotoUrl` column support it; only the retiro-flow UI is missing).
