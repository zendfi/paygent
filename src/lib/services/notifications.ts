import { addActivityEvent } from "@/lib/services/activity";
import { getBusinessById } from "@/lib/services/businesses";
import { readStore, writeStore } from "@/lib/storage/store";
import type { OwnerNotificationRecord } from "@/lib/storage/types";

function makeId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

export async function listOwnerNotificationsByBusiness(
  businessId: string,
  limit = 30,
): Promise<OwnerNotificationRecord[]> {
  const store = await readStore();
  return store.ownerNotifications
    .filter((notification) => notification.businessId === businessId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export async function sendOwnerNotification(input: {
  businessId: string;
  intentId: string;
  eventType: OwnerNotificationRecord["eventType"];
  message: string;
}): Promise<OwnerNotificationRecord> {
  const business = await getBusinessById(input.businessId);
  if (!business) {
    throw new Error("business_not_found");
  }

  const timestamp = nowIso();
  const notification: OwnerNotificationRecord = {
    id: makeId("notif"),
    businessId: input.businessId,
    intentId: input.intentId,
    eventType: input.eventType,
    channel: "in_app",
    status: "sent",
    message: input.message,
    createdAt: timestamp,
  };

  const store = await readStore();
  store.ownerNotifications.push(notification);
  await writeStore(store);

  await addActivityEvent({
    businessId: input.businessId,
    type: "notification_sent",
    message: `Owner notification sent (${input.eventType}) for intent ${input.intentId}.`,
    metadata: {
      notificationId: notification.id,
      ownerPhone: business.ownerPhone,
      eventType: input.eventType,
    },
  });

  return notification;
}
