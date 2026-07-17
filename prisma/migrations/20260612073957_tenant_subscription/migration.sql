-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('trial', 'active', 'past_due', 'suspended');

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'trial',
ADD COLUMN     "trialEndsAt" TIMESTAMP(3);

-- Los tenants que ya existían antes del modelo de suscripción quedan activos:
-- eran pilotos operativos y no deben bloquearse retroactivamente.
UPDATE "Tenant" SET "subscriptionStatus" = 'active';
