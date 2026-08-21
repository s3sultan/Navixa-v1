import type { GlossaryTerm } from "./meetingGlossary";

export type TranscriptSegment = {
  start: number;
  end: number;
  text: string;
};

export type MeetingPartStatus = "pending" | "processing" | "complete" | "error";

export type MeetingPart = {
  id: string;
  index: number;
  startMs: number;
  durationMs: number;
  audio: Blob | null;
  status: MeetingPartStatus;
  transcript: string;
  segments: TranscriptSegment[];
  summary: string;
  decisions: string[];
  tasks: string[];
  questions: string[];
  model: "tiny" | "base" | null;
  error?: string;
};

export type MeetingSession = {
  id: string;
  title: string;
  createdAt: string;
  durationMs: number;
  audio: Blob | null;
  transcript: string;
  segments: TranscriptSegment[];
  summary: string;
  decisions: string[];
  tasks: string[];
  questions: string[];
  model: "tiny" | "base" | null;
  parts?: MeetingPart[];
  chunkMinutes?: number;
  glossary?: GlossaryTerm[];
  globalLearningConsent?: boolean;
  learningShared?: boolean;
};

const DB_NAME = "navixa-local-meetings";
const STORE_NAME = "sessions";
const DB_VERSION = 1;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("database"));
  });
}

export async function listMeetingSessions(): Promise<MeetingSession[]> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => {
      database.close();
      resolve((request.result as MeetingSession[]).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    };
    request.onerror = () => {
      database.close();
      reject(request.error || new Error("list"));
    };
  });
}

export async function saveMeetingSession(session: MeetingSession): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(session);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error("save"));
    };
  });
}

export async function deleteMeetingSession(id: string): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(id);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error("delete"));
    };
  });
}

export async function clearMeetingSessions(): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).clear();
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error("clear"));
    };
  });
}
