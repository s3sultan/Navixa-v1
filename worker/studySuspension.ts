import { sendFeaturePush } from "./generalPush.ts";
import {
  sendOfficialTelegramMessage,
  telegramRuntimeEnv,
  validTelegramChatId,
} from "./telegramBot.ts";

export type StudySuspensionDecisionType = "suspend" | "remote" | "delay" | "resume" | "cancel";
export type StudySuspensionScopeType = "national" | "region" | "city" | "education_admin" | "university" | "school";
export type StudySuspensionVerification = "official_primary" | "official_secondary" | "pending" | "superseded" | "cancelled";
export type StudySuspensionEducationType = "general" | "higher" | "all";
export type StudySuspensionAudience = "students" | "staff" | "all";
export type StudySuspensionChannel = "push" | "telegram";

type PushSubscription = { endpoint: string; p256dh: string; auth: string };

export type StudySuspensionSource = {
  entityType: "moe" | "education_admin" | "university";
  entityId: string;
  name: string;
  verified: boolean;
  officialAccountId?: string;
};

export type StudySuspensionEvent = {
  id: string;
  sourcePostId: string;
  source: StudySuspensionSource;
  sourceUrl: string;
  publishedAt: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  decisionType: StudySuspensionDecisionType;
  educationType: StudySuspensionEducationType;
  scope: { type: StudySuspensionScopeType; ids: string[] };
  audience: StudySuspensionAudience;
  verification: StudySuspensionVerification;
  summary: string;
  rawTextHash?: string;
};

export type StudySuspensionProfile = {
  educationType: "general" | "higher";
  role?: "student" | "staff";
  regionId?: string;
  cityId?: string;
  educationAdminId?: string;
  universityId?: string;
  schoolId?: string;
};

export type StudySuspensionRecipient = {
  id: string;
  profile: StudySuspensionProfile;
  pushSubscription?: PushSubscription;
  telegramChatId?: string;
};

export type StudySuspensionDeliveryLedger = {
  claim(input: { recipientId: string; channel: StudySuspensionChannel; dedupKey: string }): Promise<boolean>;
  release(input: { recipientId: string; channel: StudySuspensionChannel; dedupKey: string }): Promise<void>;
};

type PushSender = (recipient: StudySuspensionRecipient, event: StudySuspensionEvent) => Promise<boolean>;
type TelegramSender = (recipient: StudySuspensionRecipient, event: StudySuspensionEvent) => Promise<boolean>;

export type StudySuspensionDispatchOptions = {
  mode?: "test" | "live";
  testRecipientIds?: readonly string[];
  ledger: StudySuspensionDeliveryLedger;
  sendPush?: PushSender;
  sendTelegram?: TelegramSender;
};

export type StudySuspensionDispatchResult = {
  matched: number;
  attempted: number;
  delivered: number;
  duplicateSkipped: number;
  guardSkipped: number;
  failed: number;
};

const dispatchableVerification = new Set<StudySuspensionVerification>(["official_primary", "official_secondary"]);

const decisionLabels: Record<StudySuspensionDecisionType, string> = {
  suspend: "تعليق الدراسة",
  remote: "تحويل الدراسة عن بُعد",
  delay: "تأخير الدراسة",
  resume: "استئناف الدراسة",
  cancel: "إلغاء قرار سابق",
};

function normalizedIds(ids: readonly string[]) {
  return new Set(ids.map(value => value.trim()).filter(Boolean));
}

function hasScopeMatch(profileValue: string | undefined, ids: readonly string[]) {
  return Boolean(profileValue && normalizedIds(ids).has(profileValue));
}

export function isOfficialStudySuspensionEvent(event: StudySuspensionEvent) {
  if (!event.id.trim() || !event.sourcePostId.trim() || !event.source.entityId.trim() || !event.source.name.trim()) return false;
  if (!event.source.verified || !dispatchableVerification.has(event.verification)) return false;
  if (!/^https:\/\//i.test(event.sourceUrl)) return false;
  if (!event.summary.trim()) return false;
  if (event.scope.type !== "national" && normalizedIds(event.scope.ids).size === 0) return false;
  if (event.source.entityType === "education_admin" && event.educationType !== "general") return false;
  if (event.source.entityType === "university" && event.educationType !== "higher") return false;
  return true;
}

export function matchesStudySuspensionEvent(profile: StudySuspensionProfile, event: StudySuspensionEvent) {
  if (!isOfficialStudySuspensionEvent(event)) return false;
  if (event.educationType !== "all" && profile.educationType !== event.educationType) return false;
  if (event.source.entityType === "education_admin" && profile.educationType !== "general") return false;
  if (event.source.entityType === "university" && profile.educationType !== "higher") return false;
  if (event.audience !== "all" && profile.role !== event.audience.slice(0, -1)) return false;

  switch (event.scope.type) {
    case "national":
      return true;
    case "region":
      return hasScopeMatch(profile.regionId, event.scope.ids);
    case "city":
      return hasScopeMatch(profile.cityId, event.scope.ids);
    case "education_admin":
      return profile.educationType === "general" && hasScopeMatch(profile.educationAdminId, event.scope.ids);
    case "university":
      return profile.educationType === "higher" && hasScopeMatch(profile.universityId, event.scope.ids);
    case "school":
      return profile.educationType === "general" && hasScopeMatch(profile.schoolId, event.scope.ids);
  }
}

export function studySuspensionDedupKey(event: StudySuspensionEvent) {
  return [
    "study_suspension",
    event.source.entityType,
    event.source.entityId.trim(),
    event.sourcePostId.trim(),
    event.decisionType,
    event.rawTextHash?.trim() || "nohash",
  ].join(":");
}

export function formatStudySuspensionNotification(event: StudySuspensionEvent) {
  const label = decisionLabels[event.decisionType];
  return {
    title: `${label} | ${event.source.name}`,
    body: event.summary.trim(),
    sourceUrl: event.sourceUrl,
    telegramText: `${label}\n${event.source.name}\n${event.summary.trim()}\n${event.sourceUrl}`,
  };
}

async function defaultPushSender(recipient: StudySuspensionRecipient, event: StudySuspensionEvent) {
  if (!recipient.pushSubscription) return false;
  const notification = formatStudySuspensionNotification(event);
  const result = await sendFeaturePush(recipient.pushSubscription, {
    kind: "study_suspension",
    title: notification.title,
    body: notification.body,
    url: notification.sourceUrl,
    tag: studySuspensionDedupKey(event),
    requireInteraction: true,
    urgency: "high",
    ttl: 3600,
  });
  return result.ok;
}

async function defaultTelegramSender(recipient: StudySuspensionRecipient, event: StudySuspensionEvent) {
  if (!recipient.telegramChatId || !validTelegramChatId(recipient.telegramChatId)) return false;
  const env = await telegramRuntimeEnv();
  const token = env.NAVIXA_TELEGRAM_BOT_TOKEN?.trim();
  if (!token) return false;
  return sendOfficialTelegramMessage({
    chatId: recipient.telegramChatId,
    token,
    text: formatStudySuspensionNotification(event).telegramText,
  });
}

async function deliverChannel(input: {
  recipient: StudySuspensionRecipient;
  event: StudySuspensionEvent;
  channel: StudySuspensionChannel;
  ledger: StudySuspensionDeliveryLedger;
  sender: () => Promise<boolean>;
}) {
  const dedupKey = studySuspensionDedupKey(input.event);
  const claimed = await input.ledger.claim({ recipientId: input.recipient.id, channel: input.channel, dedupKey });
  if (!claimed) return "duplicate" as const;
  try {
    const delivered = await input.sender();
    if (delivered) return "delivered" as const;
    await input.ledger.release({ recipientId: input.recipient.id, channel: input.channel, dedupKey });
    return "failed" as const;
  } catch {
    await input.ledger.release({ recipientId: input.recipient.id, channel: input.channel, dedupKey });
    return "failed" as const;
  }
}

export async function dispatchStudySuspensionEvent(
  event: StudySuspensionEvent,
  recipients: readonly StudySuspensionRecipient[],
  options: StudySuspensionDispatchOptions,
): Promise<StudySuspensionDispatchResult> {
  const result: StudySuspensionDispatchResult = {
    matched: 0,
    attempted: 0,
    delivered: 0,
    duplicateSkipped: 0,
    guardSkipped: 0,
    failed: 0,
  };
  if (!isOfficialStudySuspensionEvent(event)) return result;

  const mode = options.mode || "test";
  const testRecipients = new Set(options.testRecipientIds || []);
  const pushSender = options.sendPush || defaultPushSender;
  const telegramSender = options.sendTelegram || defaultTelegramSender;

  for (const recipient of recipients) {
    if (!matchesStudySuspensionEvent(recipient.profile, event)) continue;
    result.matched += 1;

    if (mode === "test" && !testRecipients.has(recipient.id)) {
      result.guardSkipped += 1;
      continue;
    }

    const channels: Array<{ channel: StudySuspensionChannel; sender: () => Promise<boolean> }> = [];
    if (recipient.pushSubscription) channels.push({ channel: "push", sender: () => pushSender(recipient, event) });
    if (recipient.telegramChatId) channels.push({ channel: "telegram", sender: () => telegramSender(recipient, event) });

    for (const channel of channels) {
      result.attempted += 1;
      const status = await deliverChannel({
        recipient,
        event,
        channel: channel.channel,
        ledger: options.ledger,
        sender: channel.sender,
      });
      if (status === "delivered") result.delivered += 1;
      else if (status === "duplicate") result.duplicateSkipped += 1;
      else result.failed += 1;
    }
  }

  return result;
}
