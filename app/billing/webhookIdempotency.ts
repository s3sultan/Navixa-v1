export type WebhookEventStatus = "processing" | "processed" | "rejected" | "failed";
export type WebhookClaim = "owner" | "duplicate" | "conflict" | "busy";

export type StoredWebhookEvent = {
  payloadHash: string;
  status: WebhookEventStatus;
  leaseUntil: string | null;
};

export interface WebhookEventStore {
  insertIfAbsent(input: {
    provider: string;
    eventId: string;
    eventType: string;
    payloadHash: string;
    leaseUntil: string;
    receivedAt: string;
  }): Promise<boolean>;
  get(provider: string, eventId: string): Promise<StoredWebhookEvent | null>;
  takeExpiredLease(input: {
    provider: string;
    eventId: string;
    now: string;
    leaseUntil: string;
  }): Promise<boolean>;
  mark(provider: string, eventId: string, status: Exclude<WebhookEventStatus, "processing">, code?: string): Promise<void>;
}

export type WebhookProcessingResult = {
  httpStatus: 200 | 401 | 503;
  outcome: "processed" | "duplicate" | "rejected" | "busy" | "conflict" | "retry";
};

const validPart = (value: string, limit: number) => value.length > 0 && value.length <= limit && /^[a-zA-Z0-9_:.\-]+$/.test(value);

export async function claimWebhookEvent(
  store: WebhookEventStore,
  input: { provider: string; eventId: string; eventType: string; payloadHash: string; now?: Date; leaseMs?: number },
): Promise<WebhookClaim> {
  if (!validPart(input.provider, 40) || !validPart(input.eventId, 180) || !validPart(input.eventType, 80) || !/^[a-f0-9]{64}$/i.test(input.payloadHash)) {
    return "conflict";
  }

  const now = input.now ?? new Date();
  const nowIso = now.toISOString();
  const leaseUntil = new Date(now.getTime() + (input.leaseMs ?? 90_000)).toISOString();
  const created = await store.insertIfAbsent({
    provider: input.provider,
    eventId: input.eventId,
    eventType: input.eventType,
    payloadHash: input.payloadHash,
    leaseUntil,
    receivedAt: nowIso,
  });
  if (created) return "owner";

  const existing = await store.get(input.provider, input.eventId);
  if (!existing) return "busy";
  if (existing.payloadHash !== input.payloadHash) return "conflict";
  if (existing.status === "processed" || existing.status === "rejected") return "duplicate";

  return await store.takeExpiredLease({ provider: input.provider, eventId: input.eventId, now: nowIso, leaseUntil })
    ? "owner"
    : "busy";
}

export async function processWebhookOnce(input: {
  store: WebhookEventStore;
  provider: string;
  eventId: string;
  eventType: string;
  payloadHash: string;
  verify: () => Promise<boolean>;
  settle: () => Promise<void>;
  now?: Date;
}): Promise<WebhookProcessingResult> {
  const claim = await claimWebhookEvent(input.store, input);
  if (claim === "duplicate") return { httpStatus: 200, outcome: "duplicate" };
  if (claim === "conflict") return { httpStatus: 200, outcome: "conflict" };
  if (claim === "busy") return { httpStatus: 503, outcome: "busy" };

  try {
    if (!await input.verify()) {
      await input.store.mark(input.provider, input.eventId, "rejected", "verification_failed");
      return { httpStatus: 401, outcome: "rejected" };
    }
    await input.settle();
    await input.store.mark(input.provider, input.eventId, "processed");
    return { httpStatus: 200, outcome: "processed" };
  } catch {
    // لا يعاد إنشاء دفع ولا إعادة خصم هنا؛ 503 يسمح فقط بإعادة التسليم من المزود.
    await input.store.mark(input.provider, input.eventId, "failed", "transient").catch(() => undefined);
    return { httpStatus: 503, outcome: "retry" };
  }
}
