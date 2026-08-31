import type { PremiumMessageEvent } from "./messagingPolicy";

export type NotificationChannel = "email" | "telegram" | "sms" | "whatsapp";

export type NotificationMessage = {
  text: string;
  subject?: string;
};

export type NotificationTarget = {
  address?: string;
  chatId?: string;
  phone?: string;
};

export type NotificationResult = {
  channel: NotificationChannel;
  ok: boolean;
  skipped?: boolean;
  reason?: string;
};

export type NotificationSendInput = {
  channel: NotificationChannel;
  message: NotificationMessage;
  target: NotificationTarget;
  eventType?: PremiumMessageEvent;
  subscriberId?: string;
};
