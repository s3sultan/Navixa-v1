export type NavixaProjectScope =
  | "core"
  | "kids"
  | "learning"
  | "fitness";

export type MemoryKind =
  | "preference"
  | "profile"
  | "goal"
  | "learning"
  | "workflow"
  | "context";

export type MemorySensitivity = "standard" | "restricted";

export type MemorySource =
  | "explicit_user"
  | "assistant_inferred"
  | "project_event"
  | "admin";

export interface NavixaMemory {
  id: string;
  userId: string;
  project: NavixaProjectScope;
  kind: MemoryKind;
  content: string;
  source: MemorySource;
  sensitivity: MemorySensitivity;
  confidence: number;
  salience: number;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface MemoryQuery {
  userId: string;
  project: NavixaProjectScope;
  text?: string;
  kinds?: MemoryKind[];
  limit?: number;
  now?: string;
  includeCore?: boolean;
}

export interface MemoryWriteInput {
  userId: string;
  project: NavixaProjectScope;
  kind: MemoryKind;
  content: string;
  source: MemorySource;
  sensitivity?: MemorySensitivity;
  confidence?: number;
  salience?: number;
  expiresAt?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface MemoryStore {
  list(query: MemoryQuery): Promise<NavixaMemory[]>;
  upsert(input: MemoryWriteInput): Promise<NavixaMemory>;
  remove(userId: string, memoryId: string): Promise<void>;
  clearProject(userId: string, project: NavixaProjectScope): Promise<void>;
}
