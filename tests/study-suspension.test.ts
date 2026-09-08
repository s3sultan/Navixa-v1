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
} from "../worker/studySuspension.ts";

function event(overrides: Partial<StudySuspensionEvent> = {}): StudySuspensionEvent {
  return {
    id: "event-1",
    sourcePostId: "post-100",
    source: {
      entityType: "education_admin",
      entityId: "riyadh-education",
      name: "إدارة تعليم الرياض",
      verified: true,
      officialAccountId: "x-riyadh-education",
    },
    sourceUrl: "https://x.com/official/status/100",
    publishedAt: "2026-09-09T02:00:00+03:00",
    effectiveFrom: "2026-09-09T06:00:00+03:00",
    decisionType: "suspend",
    educationType: "general",
    scope: { type: "region", ids: ["riyadh"] },
    audience: "all",
    verification: "official_primary",
    summary: "تعليق الدراسة الحضورية في مدارس منطقة الرياض لهذا اليوم.",
    rawTextHash: "hash-a",
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
      cityId: "riyadh-city",
      educationAdminId: "riyadh-education",
      schoolId: "school-1",
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
  return { ledger, claimed };
}

test("only verified official events are dispatchable", () => {
  assert.equal(isOfficialStudySuspensionEvent(event()), true);
  assert.equal(isOfficialStudySuspensionEvent(event({ verification: "pending" })), false);
  assert.equal(isOfficialStudySuspensionEvent(event({ source: { ...event().source, verified: false } })), false);
  assert.equal(isOfficialStudySuspensionEvent(event({ sourceUrl: "http://example.com/post" })), false);
  assert.equal(isOfficialStudySuspensionEvent(event({ scope: { type: "city", ids: [] } })), false);
});

test("regional education decision targets only matching general-education users", () => {
  const officialEvent = event();
  assert.equal(matchesStudySuspensionEvent(recipient("riyadh").profile, officialEvent), true);
  assert.equal(matchesStudySuspensionEvent({ ...recipient("jeddah").profile, regionId: "makkah" }, officialEvent), false);
  assert.equal(matchesStudySuspensionEvent({ educationType: "higher", role: "student", regionId: "riyadh", universityId: "ksu" }, officialEvent), false);
});

test("education-admin and university scopes require the exact selected entity", () => {
  const adminEvent = event({ scope: { type: "education_admin", ids: ["riyadh-education"] } });
  assert.equal(matchesStudySuspensionEvent(recipient("a").profile, adminEvent), true);
  assert.equal(matchesStudySuspensionEvent({ ...recipient("b").profile, educationAdminId: "qassim-education" }, adminEvent), false);

  const universityEvent = event({
    source: { entityType: "university", entityId: "ksu", name: "جامعة الملك سعود", verified: true, officialAccountId: "x-ksu" },
    educationType: "higher",
    scope: { type: "university", ids: ["ksu"] },
  });
  assert.equal(matchesStudySuspensionEvent({ educationType: "higher", role: "student", regionId: "riyadh", universityId: "ksu" }, universityEvent), true);
  assert.equal(matchesStudySuspensionEvent({ educationType: "higher", role: "student", regionId: "riyadh", universityId: "iau" }, universityEvent), false);
});

test("student and staff audience filters are explicit", () => {
  const staffEvent = event({ audience: "staff" });
  assert.equal(matchesStudySuspensionEvent({ ...recipient("staff").profile, role: "staff" }, staffEvent), true);
  assert.equal(matchesStudySuspensionEvent(recipient("student").profile, staffEvent), false);

  const studentsEvent = event({ audience: "students" });
  assert.equal(matchesStudySuspensionEvent(recipient("student").profile, studentsEvent), true);
  assert.equal(matchesStudySuspensionEvent({ ...recipient("staff").profile, role: "staff" }, studentsEvent), false);
});

test("test mode defaults closed and sends only to explicitly allowed test recipient", async () => {
  const { ledger } = memoryLedger();
  const recipients = [
    recipient("owner", { pushSubscription: { endpoint: "https://push.test/owner", p256dh: "p", auth: "a" }, telegramChatId: "12345678" }),
    recipient("other", { pushSubscription: { endpoint: "https://push.test/other", p256dh: "p", auth: "a" }, telegramChatId: "87654321" }),
  ];
  const calls: string[] = [];

  const closed = await dispatchStudySuspensionEvent(event(), recipients, {
    ledger,
    sendPush: async r => { calls.push(`push:${r.id}`); return true; },
    sendTelegram: async r => { calls.push(`telegram:${r.id}`); return true; },
  });
  assert.equal(closed.delivered, 0);
  assert.equal(closed.guardSkipped, 2);
  assert.deepEqual(calls, []);

  const allowed = await dispatchStudySuspensionEvent(event({ sourcePostId: "post-101" }), recipients, {
    ledger,
    testRecipientIds: ["owner"],
    sendPush: async r => { calls.push(`push:${r.id}`); return true; },
    sendTelegram: async r => { calls.push(`telegram:${r.id}`); return true; },
  });
  assert.equal(allowed.matched, 2);
  assert.equal(allowed.guardSkipped, 1);
  assert.equal(allowed.attempted, 2);
  assert.equal(allowed.delivered, 2);
  assert.deepEqual(calls, ["push:owner", "telegram:owner"]);
});

test("delivery ledger prevents duplicate sends per recipient and channel", async () => {
  const { ledger } = memoryLedger();
  const target = recipient("owner", {
    pushSubscription: { endpoint: "https://push.test/owner", p256dh: "p", auth: "a" },
    telegramChatId: "12345678",
  });
  let pushCalls = 0;
  let telegramCalls = 0;
  const options = {
    mode: "test" as const,
    testRecipientIds: ["owner"],
    ledger,
    sendPush: async () => { pushCalls += 1; return true; },
    sendTelegram: async () => { telegramCalls += 1; return true; },
  };

  const first = await dispatchStudySuspensionEvent(event(), [target], options);
  const second = await dispatchStudySuspensionEvent(event(), [target], options);

  assert.equal(first.delivered, 2);
  assert.equal(second.delivered, 0);
  assert.equal(second.duplicateSkipped, 2);
  assert.equal(pushCalls, 1);
  assert.equal(telegramCalls, 1);
});

test("failed delivery releases the claim so a later retry can succeed", async () => {
  const { ledger } = memoryLedger();
  const target = recipient("owner", { pushSubscription: { endpoint: "https://push.test/owner", p256dh: "p", auth: "a" } });
  let attempts = 0;

  const first = await dispatchStudySuspensionEvent(event(), [target], {
    testRecipientIds: ["owner"],
    ledger,
    sendPush: async () => { attempts += 1; return false; },
  });
  const second = await dispatchStudySuspensionEvent(event(), [target], {
    testRecipientIds: ["owner"],
    ledger,
    sendPush: async () => { attempts += 1; return true; },
  });

  assert.equal(first.failed, 1);
  assert.equal(second.delivered, 1);
  assert.equal(attempts, 2);
});

test("minor text hash changes do not bypass source-post deduplication", () => {
  const first = studySuspensionDedupKey(event({ rawTextHash: "hash-a" }));
  const second = studySuspensionDedupKey(event({ rawTextHash: "hash-b" }));
  assert.equal(first, second);
});
