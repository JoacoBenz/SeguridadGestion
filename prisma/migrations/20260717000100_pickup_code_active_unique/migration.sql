-- Pickup-code uniqueness is per-tenant and ONLY across active packages
-- (status = 'awaiting_pickup'). Prisma's schema can't express a partial unique
-- index, so it lives here. This replaces the app-level-only guarantee in
-- generateUniquePickupCode() with a real DB constraint; the retry loop there
-- still handles the collision case gracefully.
CREATE UNIQUE INDEX "Package_tenantId_pickupCode_active_key"
  ON "Package" ("tenantId", "pickupCode")
  WHERE status = 'awaiting_pickup';
