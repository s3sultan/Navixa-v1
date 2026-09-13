import assert from "node:assert/strict";
import test from "node:test";
import {
  dispatchStudySuspensionEvent,
  isOfficialStudySuspensionEvent,
  matchesStudySuspensionEvent,
  studySuspensionDedupKey,
  type StudySuspensionDeliveryLedger,
  type StudySuspensionEvent,
  type StudySuspensionRecipient,
} from "../src/studySuspension.ts";
import {
  classifyStudySuspensionDecision,
  normalizeOfficialXPost,
  type StudySuspensionXSource,
} from "../src/studySuspensionX.ts";

function event(overrides: Partial<StudySuspensionEvent> = {}): StudySuspensionEvent {
  return {
    id: "event-1",
    sourcePostId: "post-100",
    source: {
      entityType: "education_admin",
      entityId: "riyadh-education",
      name: "إدارة تعليم الرياض",
      verified: true,
      officialAccountId: "123456789",
    },
    sourceUrl: "https://x.com/MOE_RYH/status/100",
    publishedAt: "2026-09-09T02:00:00+03:00",
    decisionType: "suspend",
    educationType: "general",
    scope: { type: "education_admin", ids: ["riyadh-education"] },
    audience: "all",
    verification: "official_primary",
    summary: "تعليق الدراسة الحضورية في مدارس تعليم الرياض.",
    ...overrides,
  };
}

function recipient(id: string, overrides: Partial<StudySuspensionRecipient> = {}): StudySuspensionRecipient {
  return {
    id,
    profile: {
      educationType: "general",
      role: "student",
      regionId: "riyadh",
      educationAdminId: "riyadh-education",
    },
    ...overrides,
  };
}

function memoryLedger() {
  const claimed = new Set<string>();
  const key = (input: { recipientId: string; channel: string; dedupKey: string }) => `${input.recipientId}|${input.channel}|${input.dedupKey}`;
  const ledger: StudySuspensionDeliveryLedger = {
    async claim(input) {
      const value = key(input);
      if (claimed.has(value)) return false;
      claimed.add(value);
      return true;
    },
    async release(input) {
      claimed.delete(key(input));
    },
  };
  return ledger;
}

test("core accepts only verified official events", () => {
  assert.equal(isOfficialStudySuspensionEvent(event()), true);
  assert.equal(isOfficialStudySuspensionEvent(event({ verification: "pending" })), false);
  assert.equal(isOfficialStudySuspensionEvent(event({ source: { ...event().source, verified: false } })), false);
  assert.equal(isOfficialStudySuspensionEvent(event({ sourceUrl: "http://example.com/post" })), false);
});

test("targeting keeps education administration exact", () => {
  assert.equal(matchesStudySuspensionEvent(recipient("riyadh").profile, event()), true);
  assert.equal(
    matchesStudySuspensionEvent({ ...recipient("qassim").profile, educationAdminId: "qassim-education", regionId: "qassim" }, event()),
    false,
  );
});

test("test mode is fail-closed and allows only explicit recipients", async () => {
  const calls: string[] = [];
  const recipients = [
    recipient("owner", { pushSubscription: { endpoint: "https://push.test/owner", p256dh: "p", auth: "a" }, telegramChatId: "12345678" }),
    recipient("other", { pushSubscription: { endpoint: "https://push.test/other", p256dh: "p", auth: "a" }, telegramChatId: "87654321" }),
  ];
  const transport = {
    sendPush: async (r: StudySuspensionRecipient) => { calls.push(`push:${r.id}`); return true; },
    sendTelegram: async (r: StudySuspensionRecipient) => { calls.push(`telegram:${r.id}`); return true; },
  };

  const closed = await dispatchStudySuspensionEvent(event(), recipients, { ledger: memoryLedger(), transport });
  assert.equal(closed.delivered, 0);
  assert.equal(closed.guardSkipped, 2);
  assert.deepEqual(calls, []);

  const allowed = await dispatchStudySuspensionEvent(event({ sourcePostId: "post-101" }), recipients, {
    ledger: memoryLedger(),
    transport,
    testRecipientIds: ["owner"],
  });
  assert.equal(allowed.delivered, 2);
  assert.equal(allowed.guardSkipped, 1);
  assert.deepEqual(calls, ["push:owner", "telegram:owner"]);
});

test("deduplication is stable and failed delivery can retry", async () => {
  assert.equal(studySuspensionDedupKey(event({ rawTextHash: "a" })), studySuspensionDedupKey(event({ rawTextHash: "b" })));

  const ledger = memoryLedger();
  const target = recipient("owner", { pushSubscription: { endpoint: "https://push.test/owner", p256dh: "p", auth: "a" } });
  let attempts = 0;
  const first = await dispatchStudySuspensionEvent(event(), [target], {
    ledger,
    testRecipientIds: ["owner"],
    transport: { sendPush: async () => { attempts += 1; return false; } },
  });
  const second = await dispatchStudySuspensionEvent(event(), [target], {
    ledger,
    testRecipientIds: ["owner"],
    transport: { sendPush: async () => { attempts += 1; return true; } },
  });
  assert.equal(first.failed, 1);
  assert.equal(second.delivered, 1);
  assert.equal(attempts, 2);
});

test("official X classifier keeps trusted registry scope", () => {
  assert.equal(classifyStudySuspensionDecision("دعوة لحضور معرض التعليم والتقنية"), null);
  assert.equal(classifyStudySuspensionDecision("تعليق الدراسة الحضورية وتحويل الدراسة عن بُعد عبر منصة مدرستي غدًا"), "remote");

  const source: StudySuspensionXSource = {
    sourceId: "education-admin:riyadh",
    source: {
      entityType: "education_admin",
      entityId: "riyadh-education",
      name: "إدارة تعليم الرياض",
      verified: true,
      officialAccountId: "123456789",
    },
    username: "MOE_RYH",
    accountId: "123456789",
    educationType: "general",
    scopeType: "education_admin",
    scopeIds: ["riyadh-education"],
  };
  const normalized = normalizeOfficialXPost(source, {
    id: "200",
    text: "تعليق الدراسة الحضورية حسب القرار الرسمي",
    created_at: "2026-09-09T01:00:00Z",
  });
  assert.ok(normalized);
  assert.deepEqual(normalized.scope, { type: "education_admin", ids: ["riyadh-education"] });
  assert.equal(normalized.sourceUrl, "https://x.com/MOE_RYH/status/200");
});
