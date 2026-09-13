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

export type StudySuspensionTransport = {
  sendPush?(recipient: StudySuspensionRecipient, event: StudySuspensionEvent): Promise<boolean>;
  sendTelegram?(recipient: StudySuspensionRecipient, event: StudySuspensionEvent): Promise<boolean>;
};

export type StudySuspensionDispatchOptions = {
  mode?: "test" | "live";
  testRecipientIds?: readonly string[];
  ledger: StudySuspensionDeliveryLedger;
  transport: StudySuspensionTransport;
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

function normalizedIds(ids: readonly string[]) {
  return new Set(ids.map(value => value.trim()).filter(Boolean));
}

function hasScopeMatch(profileValue: string | undefined, ids: readonly string[]) {
  return Boolean(profileValue && normalizedIds(ids).has(profileValue));
}

function matchesAudience(profile: StudySuspensionProfile, audience: StudySuspensionAudience) {
  if (audience === "all") return true;
  if (audience === "students") return profile.role === "student";
  return profile.role === "staff";
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
  if (!matchesAudience(profile, event.audience)) return false;

  switch (event.scope.type) {
    case "national": return true;
    case "region": return hasScopeMatch(profile.regionId, event.scope.ids);
    case "city": return hasScopeMatch(profile.cityId, event.scope.ids);
    case "education_admin": return profile.educationType === "general" && hasScopeMatch(profile.educationAdminId, event.scope.ids);
    case "university": return profile.educationType === "higher" && hasScopeMatch(profile.universityId, event.scope.ids);
    case "school": return profile.educationType === "general" && hasScopeMatch(profile.schoolId, event.scope.ids);
  }
}

export function studySuspensionDedupKey(event: StudySuspensionEvent) {
  return ["study_suspension", event.source.entityType, event.source.entityId.trim(), event.sourcePostId.trim(), event.decisionType].join(":");
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

  for (const recipient of recipients) {
    if (!matchesStudySuspensionEvent(recipient.profile, event)) continue;
    result.matched += 1;

    if (mode === "test" && !testRecipients.has(recipient.id)) {
      result.guardSkipped += 1;
      continue;
    }

    const channels: Array<{ channel: StudySuspensionChannel; sender: () => Promise<boolean> }> = [];
    if (recipient.pushSubscription && options.transport.sendPush) {
      channels.push({ channel: "push", sender: () => options.transport.sendPush!(recipient, event) });
    }
    if (recipient.telegramChatId && options.transport.sendTelegram) {
      channels.push({ channel: "telegram", sender: () => options.transport.sendTelegram!(recipient, event) });
    }

    for (const channel of channels) {
      result.attempted += 1;
      const status = await deliverChannel({ recipient, event, channel: channel.channel, ledger: options.ledger, sender: channel.sender });
      if (status === "delivered") result.delivered += 1;
      else if (status === "duplicate") result.duplicateSkipped += 1;
      else result.failed += 1;
    }
  }

  return result;
}
