-- El teléfono deja de ser único global: la misma persona puede recibir avisos
-- en varios edificios con el mismo número. Sigue siendo único por edificio
-- para que una carga doble no duplique los WhatsApp.

-- DropIndex
DROP INDEX "User_phone_key";

-- CreateIndex
CREATE UNIQUE INDEX "User_tenantId_phone_key" ON "User"("tenantId", "phone");
