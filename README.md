# PackItO

PWA multi-tenant para reemplazar el cuaderno de la seguridad de los edificios. La guardia 24/7 registra cada paquete que llega; el residente recibe un WhatsApp con un código + QR únicos; el retiro se confirma escaneando el QR o tipeando el código.

## Estado

MVP en construcción. Ver `/root/.claude/plans/hablando-con-la-seguridad-recursive-badger.md` para el plan completo.

## Setup local

```bash
pnpm install
cp .env.example .env
docker compose up -d postgres
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Por defecto, sin credenciales de Meta, los mensajes de WhatsApp se loguean en consola en vez de enviarse de verdad. Ver `src/lib/whatsapp/client.ts`.

Edificio piloto sembrado: `edificio-libertad`.
- Seguridad: http://localhost:3000/edificio-libertad/seguridad
- Admin: http://localhost:3000/edificio-libertad/admin (próximamente)

## Scripts

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Servidor Next.js |
| `pnpm test` | Tests unit + integration (Vitest) |
| `pnpm test:e2e` | Tests E2E (Playwright) |
| `pnpm typecheck` | TypeScript en modo `--noEmit` |
| `pnpm lint` | ESLint |
| `pnpm db:migrate` | Aplica migraciones (dev) |
| `pnpm db:seed` | Reseed de datos del piloto |
| `pnpm db:studio` | Prisma Studio |

## Stack

Next.js 15 (App Router) · TypeScript · Prisma · PostgreSQL · Tailwind CSS · Auth.js · Meta WhatsApp Cloud API · Vitest · Playwright.
