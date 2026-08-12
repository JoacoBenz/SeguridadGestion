# RUNBOOK — Backup y restore de la base de PackItO

La base de producción vive en Supabase (proyecto `njorckajlftgzruahqfo`). Este
documento es el procedimiento para (1) sacar backups lógicos propios y (2)
restaurar ante un desastre, con el checklist de verificación. **Fue ensayado
de punta a punta** — ver la sección "Ensayo" al final.

## Qué da Supabase y qué cubrimos nosotros

- Los backups automáticos de Supabase dependen del plan; en el plan free no
  hay backups gestionados accesibles. **No dependemos de eso**: el backup
  lógico con `pg_dump` funciona en cualquier plan y es portable (se puede
  restaurar en Supabase, en otro proveedor o en local).
- El bucket de fotos (Supabase Storage) es aparte y sus objetos expiran solos a los 30 días
  del cierre del paquete. Un restore de la base puede referenciar fotos que ya
  no están: no es un error, el panel simplemente no muestra esa foto.

## 1. Backup (correr periódicamente, ideal semanal o antes de cambios grandes)

Con la connection string de producción (la misma `DATABASE_URL` de Vercel;
usar la de **conexión directa**, no el pooler, para pg_dump):

```bash
pg_dump -Fc "$DATABASE_URL" -f "packito-$(date +%Y%m%d).dump"
```

- `-Fc` = formato custom comprimido; permite restore selectivo por tabla.
- Guardar el archivo FUERA de la máquina que corre la app (drive, otro disco).
- El dump incluye `_prisma_migrations`: el estado de migraciones viaja con los
  datos y un `db:deploy` posterior no re-aplica nada.
- Versiones: usar un `pg_dump` de versión mayor o igual a la del server de
  Supabase (dump con 16.x contra un server 15/16 funciona; al revés no).

## 2. Restore

**Nunca restaurar "encima" de una base con datos que importan.** Siempre a una
base vacía (proyecto nuevo de Supabase, o la misma después de un reset
consciente).

```bash
# 1. Base destino vacía (en Supabase: proyecto nuevo → su connection string).
# 2. Restaurar:
pg_restore --no-owner --no-acl -d "$DATABASE_URL_DESTINO" packito-YYYYMMDD.dump
```

- `--no-owner --no-acl` es obligatorio contra Supabase: los roles del origen
  no existen en el destino y sin esos flags el restore falla por permisos.
- Si el destino es un proyecto nuevo de Supabase: re-aplicar el RLS
  deny-by-default NO hace falta (viene en el dump, las policies son parte del
  schema), pero verificarlo está en el checklist.
- Actualizar `DATABASE_URL` en Vercel al nuevo proyecto y redeployar.

## 3. Checklist de verificación post-restore (en orden)

1. **Migraciones**: `DATABASE_URL=<destino> npx prisma migrate status` →
   "Database schema is up to date!". Si dice que hay pendientes, el dump era
   viejo: correr `pnpm db:deploy` antes de seguir.
2. **Conteos**: comparar contra el origen (o contra el último conocido):
   ```sql
   SELECT 'tenants' t, count(*) FROM "Tenant"
   UNION ALL SELECT 'users', count(*) FROM "User"
   UNION ALL SELECT 'units', count(*) FROM "Unit"
   UNION ALL SELECT 'packages', count(*) FROM "Package";
   ```
3. **Health**: `curl https://<dominio>/api/health` → `{"ok":true,"db":"up"}`.
4. **Login**: magic link con un usuario real → tiene que aterrizar en su
   panel. Las sesiones viejas del dump no molestan: el adapter usa
   `deleteMany` y una cookie huérfana no rompe el login (lección aprendida
   del incidente de agosto 2026).
5. **Ciclo funcional**: registrar un paquete de prueba en un edificio de
   test y retirarlo con el código. Si eso anda, el core está sano.
6. **Crons**: el panel de `/superadmin` va a mostrar los crons "vencidos"
   hasta la próxima corrida diaria — es esperable, no un error.

## Ensayo realizado (2026-08-12)

Procedimiento ejecutado tal cual arriba, con la base local como origen y una
base vacía como destino (misma mecánica; contra prod solo cambia la
connection string):

| Paso | Resultado | Tiempo |
|---|---|---|
| `pg_dump -Fc` (2 tenants, 109 users, 101 units, 9 packages) | 39 KB | < 1 s |
| `pg_restore --no-owner --no-acl` a base vacía | exit 0 | 1 s |
| Conteos origen vs destino | idénticos (7 tablas + `_prisma_migrations`) | — |
| `prisma migrate status` sobre el destino | "up to date", 6 migraciones | — |
| App levantada contra el destino → `/api/health` | `{"ok":true,"db":"up"}` | — |
| Login por magic link contra el destino | aterrizó en `/edificio-libertad/admin` | — |

Con el volumen actual, el RTO real de la parte de datos es de minutos; el
grueso del tiempo de un incidente va a estar en crear el proyecto nuevo de
Supabase y repuntar `DATABASE_URL` en Vercel.

## Pendiente recomendado

- Automatizar el backup semanal (GitHub Action con `pg_dump` + subida a un
  storage privado) para no depender de acordarse.
