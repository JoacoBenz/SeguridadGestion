# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

PaqueteOK is a multi-tenant PWA that digitizes package handoffs at residential building security desks. The 24/7 guard registers an incoming package; the resident gets an instant WhatsApp with a 6-character pickup code + QR; the guard processes pickup by scanning the QR or typing the code. Designed as a SaaS for many buildings (consorcios) from day 1, not a single-building tool.

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
- Pickup-code uniqueness is per-tenant **and only across active packages** (`status = 'awaiting_pickup'`). The Prisma schema can't express a partial unique index, so it is enforced at the application layer in `generateUniquePickupCode()` (`src/lib/codes.ts`) by retrying on collision. If you migrate this to a DB-level constraint, add a partial unique index in a custom migration.

### Package lifecycle
A `Package` moves: `awaiting_pickup → picked_up | cancelled`. Three server actions in `src/server/packages/` own all transitions:
- `register.ts` — creates the package, generates code+token, fires WhatsApp to every resident of the unit.
- `pickup.ts` — accepts either `pickupCode` (manual entry) or `pickupToken` (QR scan), marks `picked_up`, fires confirmation WhatsApp.
- `cancel.ts` — admin/guard escape hatch.

All three call `recordAudit()` and use `requireTenantRole()`. Adding any new state transition? Do it in `src/server/packages/`, not inline in pages.

### WhatsApp integration
- `src/lib/whatsapp/client.ts` exposes `getWhatsAppClient(): WhatsAppClient`. It returns `MetaCloudClient` if `WHATSAPP_PHONE_NUMBER_ID` and `WHATSAPP_ACCESS_TOKEN` are set, otherwise a `LoggingClient` that logs to stdout. **In dev with no creds, messages don't go anywhere — they're just logged.** Don't add fallback "console.warn" branches in business logic; the client abstraction handles it.
- `src/lib/whatsapp/templates.ts` declares the pre-approved Meta templates. Adding a new message means: (1) register the template in Meta Business Manager, (2) add it to `TEMPLATES` with the exact `bodyParamCount` and `hasImageHeader` flag, (3) `assertParamCount()` will throw at runtime if a caller passes the wrong number. Templates with `hasImageHeader: true` require `headerImageUrl` in `sendTemplate()`; the client builds a `header` component with `{ type: "image", image: { link } }`. Dev iteration on copy is blocked on Meta approval (1-3 days for text-only, 3-5 days for templates with media headers) — plan accordingly.
- `setWhatsAppClient()` is for tests only.
- Inbound delivery/read receipts hit `src/app/api/whatsapp/webhook/route.ts`. The route verifies `X-Hub-Signature-256` with `WHATSAPP_APP_SECRET` and updates `Notification.status` by `providerMessageId`.

### Resident notification — message, not page
- There is **no public page** for the resident. The full notification — QR + code + instructions — is delivered as a single WhatsApp template message (`paquete_recibido_v2`) with the QR as the header image. Forwarding the message also forwards the QR.
- The QR is served on demand by `src/app/api/qr/[token]/route.ts` as a PNG. Meta downloads it once when constructing the message. The endpoint is public (the token is the capability) and serves `Cache-Control: public, max-age=31536000, immutable` since a token's QR is invariant. It 404s for unknown tokens to avoid being a generic QR generator.
- **The QR encodes the raw token, not a URL.** `extractPickupToken()` accepts both shapes, but new packages emit raw-token QRs so the system has no implicit dependency on a webpage existing. If you reintroduce a resident-facing page, add it without touching the QR contract.

### Auth
- Auth.js v5 (NextAuth beta) is wired in `src/lib/auth/config.ts` using the Prisma adapter and the **Resend** email provider with database sessions. Magic links are the only sign-in method.
- In dev with no `RESEND_API_KEY`, magic links are **logged to stdout** instead of being emailed. Look for `[auth:dev] Magic link for ...` in the `pnpm dev` console — that's your "inbox".
- Auth.js requires `email` to be globally unique, which is why `User.email` carries `@unique` (not `@@unique([tenantId, email])`). One person across multiple buildings = multiple User rows. Don't reintroduce composite uniqueness on email.
- `src/lib/auth.ts` is the consumer-facing API: `getSession()`, `requireSession()`, `requireTenantRole()`. The default resolver delegates to Auth.js's `auth()`. Tests override with `setSessionResolver()` / `resetSessionResolver()`.
- Pages should use `requireSessionOrRedirect()` / `requireTenantRoleOrRedirect()` (redirect to `/login` or `/403`). Server actions use the throwing `requireSession()` / `requireTenantRole()` (Zod-style errors that the form handler turns into a redirect with `?error=`).
- Roles are an enum in Prisma: `superadmin | admin | guard | resident`. New users default to `resident` with `tenantId = null` and land on `/sin-edificio` until an admin assigns them. Tenant scoping is bypassed for `superadmin`; everyone else must match `session.tenantId === tenantId`.
- Device PIN flow (long-lived session per conserjería device + per-shift PIN) is **not yet implemented**. Guards sign in by email today.

### Routing
- `src/app/[tenant]/conserjeria/...` — guard + admin: register, retire, list pending.
- `src/app/[tenant]/admin/...` — admin only. Layout gates with `requireTenantRoleOrRedirect(["admin"])`. Sub-routes: `unidades`, `residentes`, `paquetes`, `reportes`. Server actions live in `src/server/admin/{units,residents,packages}.ts` and re-resolve the tenant from the slug to verify membership before any write.
- `src/app/superadmin/...` — superadmin only (not under `[tenant]`). Lists tenants and creates new ones. `src/server/superadmin/tenants.ts::createTenantAction` creates the tenant + upserts an admin user with the supplied email; that user's first login is a magic link.
- `src/app/api/qr/[token]/route.ts` — public PNG of the pickup QR. See "Resident notification" above for the contract.
- `src/app/api/auth/[...nextauth]/route.ts` — Auth.js handlers.
- `src/app/api/whatsapp/webhook/route.ts` — Meta callbacks.
- `src/app/login`, `src/app/sin-edificio`, `src/app/403` — auth-related public/intermediate pages.

### Admin & superadmin
- **Admin server actions** all follow the same shape: `(slug: string, formData: FormData) => Promise<void>`, called via `action.bind(null, slug)` in the page. They re-resolve the tenant from the slug and call `requireTenantRole(tenantId, ["admin"])` — never trust the slug alone. On Prisma FK errors (`P2003`) they surface a friendly message ("la unidad tiene paquetes asociados, cancelalos primero") instead of letting Next.js error-boundary it. Every mutation writes a `recordAudit()` entry.
- **Cancel** uses the existing `src/server/packages/cancel.ts`; the admin page just wraps it. The audit log records who cancelled and why.
- **Residents**: creating a resident creates a `User` (role=resident, with tenantId) **and** the `UnitResident` join in a single action. "Borrar" deletes the User row; if they have `Package.receivedBy`/`pickedUpBy` history, the FK restrict bubbles up as a clear error pointing to "Desvincular" instead. "Desvincular" only deletes the `UnitResident` row, preserving package history.
- **Superadmin** does NOT receive a `tenantId` (they're cross-tenant); `requireTenantRole` bypasses tenant scoping for them, so they can land in any `/[tenant]/admin` directly. The `/superadmin/...` routes additionally check `session.role === "superadmin"` and bounce to `/403` otherwise.

### Pickup by QR vs code
- The conserjería has two parallel entry points for retiros: `PickupQrScanner` (client component, opens the rear camera via `@yudiel/react-qr-scanner`) and a plain text input.
- Both end up in `src/server/packages/pickup-actions.ts`. The QR path passes the scanned URL — `extractPickupToken()` in `src/server/packages/pickup-token.ts` (a pure module, kept separate from the `"use server"` boundary so it's unit-testable) strips host/query/fragment and validates the format. Random scanned strings never reach the DB.
- Don't bypass `pickup-actions.ts` to call `pickupPackage()` directly from a client — server actions are the auth/audit boundary.
- **`redirect()` in server actions throws `NEXT_REDIRECT`** — never wrap a success `redirect()` inside a `try/catch` that catches all errors, or the success path gets swallowed and converted into `?error=NEXT_REDIRECT`. Move success redirects outside the `try` block.

## Conventions specific to this project

- **Spanish in user-facing strings, English in code.** UI copy, audit `action` strings as user sees them, and template names are Spanish (`paquete_recibido_v2`). Identifiers, comments, and error codes thrown from server actions (`PACKAGE_NOT_FOUND`, `FORBIDDEN_TENANT`, `INVALID_CODE`) are English so they're greppable.
- **Pickup codes use a Crockford-ish alphabet** (`23456789ABCDEFGHJKMNPQRSTVWXYZ`) — no `0/O/1/I/L/U`. Don't expand the alphabet without changing `isValidPickupCode` and the unit tests; ambiguity at the desk is the whole reason it's restricted.
- **Audit everything that changes a `Package`.** `recordAudit()` is one line; skipping it loses the only durable trail for disputes ("ese paquete no llegó nunca").
- **Server actions validate input with Zod** at the boundary, then trust the parsed object. Don't re-validate downstream.
- **Timezone is `America/Argentina/Buenos_Aires` by default per tenant.** Format dates with `toLocaleString("es-AR")` for user display; store as UTC.

## What's intentionally not built yet

These are deferred to later phases — don't add them speculatively:
- Photo upload for the package or pickup (needs S3-compatible storage).
- Offline mode for the conserjería form (PWA + IndexedDB queue).
- Push notifications.
- Delegation links (separate from sharing the WhatsApp link).
- Reminder cron for >3-day-old pending packages.
- Admin pages: `/[tenant]/admin/{unidades,residentes,paquetes,reportes}` — only the route shells exist.
- Resident view: `/[tenant]/residente/mis-paquetes`.
- Superadmin tenant management.
- Device-PIN session for shared conserjería devices (see Auth section).
- DB-level partial unique index on `(tenantId, pickupCode) WHERE status='awaiting_pickup'` — enforced in app code via `generateUniquePickupCode()` until then.
