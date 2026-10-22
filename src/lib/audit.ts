import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { clientIp } from "./request";

export async function audit(params: {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
}) {
  await db.auditLog.create({
    data: {
      actorId: params.actorId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      before: (params.before ?? undefined) as Prisma.InputJsonValue | undefined,
      after: (params.after ?? undefined) as Prisma.InputJsonValue | undefined,
      ip: await clientIp(),
    },
  });
}
