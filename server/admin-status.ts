import type { OrderStatus } from "@prisma/client";

export const STATUS_TONE: Record<OrderStatus, "neutral" | "ok" | "warn" | "ink"> = {
  CREATED: "neutral",
  AWAITING_PAYMENT: "neutral",
  PAYMENT_FAILED: "warn",
  CANCELED: "neutral",
  PAID: "ink",
  PREPARING: "ink",
  READY_FOR_PICKUP: "ok",
  SHIPPED: "ok",
  DELIVERED: "ok",
  PICKED_UP: "ok",
  REFUNDED: "warn",
};
