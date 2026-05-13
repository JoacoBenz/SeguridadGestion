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
- `src/lib/whatsapp/templates.ts` declares the pre-approved Meta templates. Adding a new message means: (1) register the template in Meta Business Manager, (2) add it to `TEMPLATES` with the exact `paramCount`, (3) `assertParamCount()` will throw at runtime if a caller passes the wrong number. Dev iteration on copy is blocked on Meta approval (1-3 days) — plan accordingly.
- `setWhatsAppClient()` is for tests only.
- Inbound delivery/read receipts hit `src/app/api/whatsapp/webhook/route.ts`. The route verifies `X-Hub-Signature-256` with `WHATSAPP_APP_SECRET` and updates `Notification.status` by `providerMessageId`.

### Auth
- `src/lib/auth.ts` exposes a `Session` shape and `getSession()` / `requireSession()` / `requireTenantRole()`. The actual provider wiring (Auth.js) is not implemented yet — there is a stubbable `setSessionResolver()` used by tests. Until Auth.js is wired, **all server actions will throw `UNAUTHENTICATED`** unless a resolver is set. Wire Auth.js in `src/lib/auth.ts` rather than rewriting the call sites.
- Roles are an enum in Prisma: `superadmin | admin | guard | resident`. Tenant scoping is bypassed for `superadmin`; everyone else must match `session.tenantId === tenantId`.

### Routing
- `src/app/[tenant]/...` — tenant-scoped (conserjería, admin, residente).
- `src/app/(public)/p/[token]/page.tsx` — the public pickup page that the resident opens from the WhatsApp link. **Do not put tenant info in this URL** — the token is the capability; revealing the tenant slug to anyone who got the link forwarded is unnecessary surface area.
- `src/app/api/whatsapp/webhook/route.ts` — Meta callbacks.

## Conventions specific to this project

- **Spanish in user-facing strings, English in code.** UI copy, audit `action` strings as user sees them, and template names are Spanish (`paquete_recibido_v1`). Identifiers, comments, and error codes thrown from server actions (`PACKAGE_NOT_FOUND`, `FORBIDDEN_TENANT`, `INVALID_CODE`) are English so they're greppable.
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
- Auth.js provider wiring (the abstraction is there; the implementation isn't).
