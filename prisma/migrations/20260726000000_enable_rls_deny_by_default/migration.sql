-- RLS activado SIN políticas = denegar todo para roles sin BYPASSRLS.
-- La app accede vía Prisma con el rol dueño de las tablas (bypassa RLS), así
-- que esto no la afecta; lo que cierra es la Data API de Supabase (PostgREST
-- con la anon key), que expone las tablas públicas por defecto. Ya se aplicó
-- a mano en producción; esta migración da paridad en local/CI y en cualquier
-- entorno futuro. ENABLE ROW LEVEL SECURITY es idempotente (re-aplicar no falla).
ALTER TABLE "Tenant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Account" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VerificationToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Unit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UnitResident" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Package" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
