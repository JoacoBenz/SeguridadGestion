-- Unicidad del código de retiro SOLO entre paquetes activos del mismo tenant.
-- Prisma no puede expresar índices únicos parciales en el schema, por eso esta
-- migración es custom. La capa de aplicación (generateUniquePickupCode) sigue
-- reintentando ante colisión; este índice es la garantía final contra el race
-- de dos registros simultáneos eligiendo el mismo código.
CREATE UNIQUE INDEX "Package_tenantId_pickupCode_active_key"
  ON "Package" ("tenantId", "pickupCode")
  WHERE "status" = 'awaiting_pickup';
