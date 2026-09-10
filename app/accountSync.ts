export type SyncedTodayTask = { title: string; done: boolean; meta?: string };
export type SyncedAcademicReminder = { id: string; title: string; date: string; alertDate: string; createdAt: string; source: "meeting" };

export type AccountTodaySyncResult = {
  status: "synced" | "signed-out" | "offline";
  tasks: SyncedTodayTask[];
  academicReminders: SyncedAcademicReminder[];
};

type SyncPayload = {
  schema: 1;
  today: {
    tasks: SyncedTodayTask[];
    academicReminders: SyncedAcademicReminder[];
  };
};

type CloudSnapshot = {
  ok?: boolean;
  scopeId?: string;
  found?: boolean;
  version?: number;
  payload?: string | null;
  conflict?: boolean;
};

const TASKS_KEY = "navixa-life-tasks";
const REMINDERS_KEY = "navixa-academic-reminders";
const OWNER_KEY = "navixa-account-sync-owner-v1";
const CACHE_PREFIX = "navixa-account-sync-cache-v1:";
const SCOPE_PATTERN = /^[a-zA-Z0-9_-]{20,64}$/;
const MAX_ITEMS = 250;
let timer: ReturnType<typeof setTimeout> | null = null;
let running: Promise<AccountTodaySyncResult> | null = null;

const emptyPayload = (): SyncPayload => ({ schema: 1, today: { tasks: [], academicReminders: [] } });

function readArray(key: string): unknown[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}

function cleanTasks(value: unknown): SyncedTodayTask[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_ITEMS).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const title = typeof row.title === "string" ? row.title.trim().slice(0, 120) : "";
    if (!title) return [];
    const meta = typeof row.meta === "string" ? row.meta.trim().slice(0, 220) : "";
    return [{ title, done: row.done === true, ...(meta ? { meta } : {}) }];
  });
}

function cleanReminders(value: unknown): SyncedAcademicReminder[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_ITEMS).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const id = typeof row.id === "string" ? row.id.slice(0, 180) : "";
    const title = typeof row.title === "string" ? row.title.trim().slice(0, 120) : "";
    const date = typeof row.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(row.date) ? row.date : "";
    if (!id || !title || !date) return [];
    const alertDate = typeof row.alertDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(row.alertDate) ? row.alertDate : date;
    const createdAt = typeof row.createdAt === "string" ? row.createdAt.slice(0, 40) : "";
    return [{ id, title, date, alertDate, createdAt, source: "meeting" as const }];
  });
}

function localPayload(): SyncPayload {
  return {
    schema: 1,
    today: {
      tasks: cleanTasks(readArray(TASKS_KEY)),
      academicReminders: cleanReminders(readArray(REMINDERS_KEY)),
    },
  };
}

function parsePayload(raw: string | null | undefined): SyncPayload {
  if (!raw) return emptyPayload();
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    const today = value?.today && typeof value.today === "object" ? value.today as Record<string, unknown> : {};
    return {
      schema: 1,
      today: {
        tasks: cleanTasks(today.tasks),
        academicReminders: cleanReminders(today.academicReminders),
      },
    };
  } catch { return emptyPayload(); }
}

function readAccountCache(scopeId: string): SyncPayload {
  if (typeof window === "undefined") return emptyPayload();
  return parsePayload(window.localStorage.getItem(`${CACHE_PREFIX}${scopeId}`));
}

function saveAccountCache(scopeId: string, payload: SyncPayload) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(`${CACHE_PREFIX}${scopeId}`, JSON.stringify(payload));
}

function localPayloadForScope(scopeId: string): SyncPayload {
  if (typeof window === "undefined") return emptyPayload();
  const visible = localPayload();
  const currentOwner = window.localStorage.getItem(OWNER_KEY) || "";
  if (!currentOwner) return visible;
  if (currentOwner === scopeId) return visible;
  if (SCOPE_PATTERN.test(currentOwner)) saveAccountCache(currentOwner, visible);
  return readAccountCache(scopeId);
}

function mergePayload(local: SyncPayload, cloud: SyncPayload): SyncPayload {
  const tasks = new Map<string, SyncedTodayTask>();
  for (const task of [...cloud.today.tasks, ...local.today.tasks]) {
    const key = `${task.title}\u0000${task.meta || ""}`;
    const previous = tasks.get(key);
    tasks.set(key, previous ? { ...task, done: previous.done || task.done } : task);
  }

  const reminders = new Map<string, SyncedAcademicReminder>();
  for (const reminder of [...cloud.today.academicReminders, ...local.today.academicReminders]) {
    const previous = reminders.get(reminder.id);
    if (!previous || (reminder.createdAt || "") >= (previous.createdAt || "")) reminders.set(reminder.id, reminder);
  }

  return {
    schema: 1,
    today: {
      tasks: Array.from(tasks.values()).slice(-MAX_ITEMS),
      academicReminders: Array.from(reminders.values()).slice(-MAX_ITEMS),
    },
  };
}

function persist(scopeId: string, payload: SyncPayload) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TASKS_KEY, JSON.stringify(payload.today.tasks));
  window.localStorage.setItem(REMINDERS_KEY, JSON.stringify(payload.today.academicReminders));
  saveAccountCache(scopeId, payload);
  window.localStorage.setItem(OWNER_KEY, scopeId);
  window.dispatchEvent(new Event("navixa:account-sync"));
}

async function runSync(): Promise<AccountTodaySyncResult> {
  const fallback = localPayload();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch("/api/account/sync", { credentials: "same-origin", cache: "no-store" });
      if (response.status === 401) return { status: "signed-out", tasks: fallback.today.tasks, academicReminders: fallback.today.academicReminders };
      if (!response.ok) return { status: "offline", tasks: fallback.today.tasks, academicReminders: fallback.today.academicReminders };
      const cloud = await response.json() as CloudSnapshot;
      const scopeId = typeof cloud.scopeId === "string" && SCOPE_PATTERN.test(cloud.scopeId) ? cloud.scopeId : "";
      if (!scopeId) return { status: "offline", tasks: fallback.today.tasks, academicReminders: fallback.today.academicReminders };

      const scopedLocal = localPayloadForScope(scopeId);
      const merged = mergePayload(scopedLocal, parsePayload(cloud.payload));
      persist(scopeId, merged);
      const serialized = JSON.stringify(merged);
      if (cloud.found && serialized === cloud.payload) {
        return { status: "synced", tasks: merged.today.tasks, academicReminders: merged.today.academicReminders };
      }

      const write = await fetch("/api/account/sync", {
        method: "PUT",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: serialized, expectedVersion: Number(cloud.version || 0) }),
      });
      if (write.status === 401) return { status: "signed-out", tasks: merged.today.tasks, academicReminders: merged.today.academicReminders };
      if (write.status === 409) continue;
      if (!write.ok) return { status: "offline", tasks: merged.today.tasks, academicReminders: merged.today.academicReminders };
      return { status: "synced", tasks: merged.today.tasks, academicReminders: merged.today.academicReminders };
    } catch {
      return { status: "offline", tasks: fallback.today.tasks, academicReminders: fallback.today.academicReminders };
    }
  }
  const latest = localPayload();
  return { status: "offline", tasks: latest.today.tasks, academicReminders: latest.today.academicReminders };
}

export function syncAccountTodayData() {
  if (typeof window === "undefined") return Promise.resolve<AccountTodaySyncResult>({ status: "offline", tasks: [], academicReminders: [] });
  if (!running) running = runSync().finally(() => { running = null; });
  return running;
}

export function scheduleAccountTodaySync(delayMs = 700) {
  if (typeof window === "undefined") return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void syncAccountTodayData();
  }, Math.max(150, delayMs));
}
