-- CreateEnum
CREATE TYPE "VisitorEventKind" AS ENUM ('announced', 'door_prompt');

-- CreateEnum
CREATE TYPE "VisitorStatus" AS ENUM ('pending', 'confirmed', 'rejected', 'arrived', 'cancelled', 'expired');

-- CreateEnum
CREATE TYPE "RecurringAuthStatus" AS ENUM ('active', 'paused', 'revoked');

-- CreateEnum
CREATE TYPE "IssueKind" AS ENUM ('maintenance', 'noise', 'suspicious', 'panic', 'incident');

-- CreateEnum
CREATE TYPE "IssueSeverity" AS ENUM ('low', 'normal', 'high', 'critical');

-- CreateEnum
CREATE TYPE "IssueStatus" AS ENUM ('open', 'acknowledged', 'resolved');

-- CreateEnum
CREATE TYPE "LostFoundStatus" AS ENUM ('lost', 'claimed', 'disposed');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "vacationEnd" TIMESTAMP(3),
ADD COLUMN     "vacationStart" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "VisitorEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "kind" "VisitorEventKind" NOT NULL,
    "visitorName" TEXT NOT NULL,
    "vehiclePlate" TEXT,
    "expectedTime" TIMESTAMP(3),
    "status" "VisitorStatus" NOT NULL DEFAULT 'pending',
    "requestedByUserId" TEXT NOT NULL,
    "decidedByUserId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisitorEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatSession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'MENU',
    "context" JSONB NOT NULL DEFAULT '{}',
    "lastInboundAt" TIMESTAMP(3),
    "lastOutboundAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboundMessageDedupe" (
    "providerMessageId" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InboundMessageDedupe_pkey" PRIMARY KEY ("providerMessageId")
);

-- CreateTable
CREATE TABLE "RecurringAuthorization" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "daysOfWeek" INTEGER[],
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "validUntil" TIMESTAMP(3),
    "status" "RecurringAuthStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringAuthorization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Issue" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "unitId" TEXT,
    "kind" "IssueKind" NOT NULL,
    "severity" "IssueSeverity" NOT NULL DEFAULT 'normal',
    "status" "IssueStatus" NOT NULL DEFAULT 'open',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "reportedByUserId" TEXT NOT NULL,
    "reportedByRole" "Role" NOT NULL,
    "acknowledgedByUserId" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedByUserId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Issue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Broadcast" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sentByUserId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Broadcast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FaqEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FaqEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LostFoundItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "foundLocation" TEXT,
    "foundAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "postedByUserId" TEXT NOT NULL,
    "status" "LostFoundStatus" NOT NULL DEFAULT 'lost',
    "claimedByUserId" TEXT,
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LostFoundItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VisitorEvent_tenantId_status_createdAt_idx" ON "VisitorEvent"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "VisitorEvent_unitId_createdAt_idx" ON "VisitorEvent"("unitId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChatSession_userId_key" ON "ChatSession"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatSession_phone_key" ON "ChatSession"("phone");

-- CreateIndex
CREATE INDEX "ChatSession_tenantId_idx" ON "ChatSession"("tenantId");

-- CreateIndex
CREATE INDEX "RecurringAuthorization_tenantId_status_idx" ON "RecurringAuthorization"("tenantId", "status");

-- CreateIndex
CREATE INDEX "RecurringAuthorization_unitId_idx" ON "RecurringAuthorization"("unitId");

-- CreateIndex
CREATE INDEX "Issue_tenantId_status_createdAt_idx" ON "Issue"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Issue_tenantId_kind_status_idx" ON "Issue"("tenantId", "kind", "status");

-- CreateIndex
CREATE INDEX "Broadcast_tenantId_sentAt_idx" ON "Broadcast"("tenantId", "sentAt");

-- CreateIndex
CREATE INDEX "FaqEntry_tenantId_ordinal_idx" ON "FaqEntry"("tenantId", "ordinal");

-- CreateIndex
CREATE INDEX "LostFoundItem_tenantId_status_foundAt_idx" ON "LostFoundItem"("tenantId", "status", "foundAt");

-- AddForeignKey
ALTER TABLE "VisitorEvent" ADD CONSTRAINT "VisitorEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitorEvent" ADD CONSTRAINT "VisitorEvent_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitorEvent" ADD CONSTRAINT "VisitorEvent_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitorEvent" ADD CONSTRAINT "VisitorEvent_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringAuthorization" ADD CONSTRAINT "RecurringAuthorization_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringAuthorization" ADD CONSTRAINT "RecurringAuthorization_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringAuthorization" ADD CONSTRAINT "RecurringAuthorization_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_reportedByUserId_fkey" FOREIGN KEY ("reportedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_acknowledgedByUserId_fkey" FOREIGN KEY ("acknowledgedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Broadcast" ADD CONSTRAINT "Broadcast_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Broadcast" ADD CONSTRAINT "Broadcast_sentByUserId_fkey" FOREIGN KEY ("sentByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FaqEntry" ADD CONSTRAINT "FaqEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LostFoundItem" ADD CONSTRAINT "LostFoundItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LostFoundItem" ADD CONSTRAINT "LostFoundItem_postedByUserId_fkey" FOREIGN KEY ("postedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LostFoundItem" ADD CONSTRAINT "LostFoundItem_claimedByUserId_fkey" FOREIGN KEY ("claimedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
