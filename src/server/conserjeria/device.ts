"use server";

import { z } from "zod";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireTenantRole } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import {
  DEVICE_COOKIE,
  DEVICE_COOKIE_MAX_AGE,
  encodeDeviceCookie,
  hashPin,
  verifyPin,
} from "@/lib/auth/device";

const PinSchema = z.string().regex(/^\d{4,8}$/, "El PIN son 4 a 8 dígitos");

// --- Admin: fija o borra el PIN de conserjería del edificio ---

export async function setGuardPinAction(slug: string, formData: FormData) {
  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!tenant) throw new Error("TENANT_NOT_FOUND");
  const session = await requireTenantRole(tenant.id, ["admin"]);

  const parsed = PinSchema.safeParse(formData.get("pin"));
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "PIN inválido";
    redirect(`/${slug}/admin?error=${encodeURIComponent(msg)}`);
  }

  // Guard sintético del dispositivo (uno por tenant). Es el actor de los audits
  // hechos desde la tablet. Se crea la primera vez que se fija el PIN.
  const deviceUser = await prisma.user.upsert({
    where: { email: `device+${tenant.id}@paqueteok.device` },
    update: {},
    create: {
      email: `device+${tenant.id}@paqueteok.device`,
      tenantId: tenant.id,
      role: "guard",
      name: "Conserjería (dispositivo)",
    },
    select: { id: true },
  });

  const current = await prisma.tenant.findUniqueOrThrow({
    where: { id: tenant.id },
    select: { settings: true },
  });
  const settings = (current.settings as Record<string, unknown>) ?? {};

  await prisma.tenant.update({
    where: { id: tenant.id },
    data: {
      settings: {
        ...settings,
        guardPinHash: hashPin(parsed.data),
        deviceUserId: deviceUser.id,
      } as Prisma.InputJsonValue,
    },
  });

  await recordAudit({
    tenantId: tenant.id,
    actorUserId: session.userId,
    action: "device.pin_set",
    entityType: "Tenant",
    entityId: tenant.id,
    metadata: {},
  });

  redirect(`/${slug}/admin?ok=${encodeURIComponent("PIN de conserjería actualizado")}`);
}

export async function clearGuardPinAction(slug: string, formData: FormData) {
  void formData;
  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!tenant) throw new Error("TENANT_NOT_FOUND");
  const session = await requireTenantRole(tenant.id, ["admin"]);

  const current = await prisma.tenant.findUniqueOrThrow({
    where: { id: tenant.id },
    select: { settings: true },
  });
  const settings = { ...((current.settings as Record<string, unknown>) ?? {}) };
  delete settings.guardPinHash;

  await prisma.tenant.update({
    where: { id: tenant.id },
    data: { settings: settings as Prisma.InputJsonValue },
  });

  await recordAudit({
    tenantId: tenant.id,
    actorUserId: session.userId,
    action: "device.pin_cleared",
    entityType: "Tenant",
    entityId: tenant.id,
    metadata: {},
  });

  redirect(`/${slug}/admin?ok=${encodeURIComponent("PIN de conserjería borrado")}`);
}

// --- Dispositivo: desbloquea con el PIN y deja la cookie de sesión ---

export async function unlockDeviceAction(slug: string, formData: FormData) {
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true, settings: true },
  });
  if (!tenant) {
    redirect(`/${slug}/conserjeria/desbloquear?error=${encodeURIComponent("Edificio no encontrado")}`);
  }

  const settings = (tenant!.settings as Record<string, unknown>) ?? {};
  const pinHash = settings.guardPinHash as string | undefined;
  const deviceUserId = settings.deviceUserId as string | undefined;

  const pin = formData.get("pin");
  if (!pinHash || !deviceUserId || typeof pin !== "string" || !verifyPin(pin, pinHash)) {
    redirect(`/${slug}/conserjeria/desbloquear?error=${encodeURIComponent("PIN incorrecto")}`);
  }

  const cookie = encodeDeviceCookie({ tenantId: tenant!.id, userId: deviceUserId!, role: "guard" });
  const store = await cookies();
  store.set(DEVICE_COOKIE, cookie, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: DEVICE_COOKIE_MAX_AGE,
    path: "/",
  });

  redirect(`/${slug}/conserjeria`);
}

export async function lockDeviceAction(slug: string, formData: FormData) {
  void formData;
  const store = await cookies();
  store.delete(DEVICE_COOKIE);
  redirect(`/${slug}/conserjeria/desbloquear`);
}
