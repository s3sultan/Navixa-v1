import { normalizeMemoryWrite, shouldRejectMemoryWrite } from "./policy.ts";
import { retrieveMemories } from "./retrieval.ts";
import type {
  MemoryQuery,
  MemoryStore,
  MemoryWriteInput,
  NavixaMemory,
  NavixaProjectScope,
} from "./types.ts";

type SqlResult<T> = Promise<{ results: T[] }>;

type BoundStatement = {
  all: <T = Record<string, unknown>>() => SqlResult<T>;
  run?: () => Promise<unknown>;
};

export type MemorySqlDb = {
  prepare: (sql: string) => {
    bind: (...values: unknown[]) => BoundStatement;
  };
};

type MemoryRow = {
  id: string;
  user_id: string;
  project: NavixaProjectScope;
  kind: NavixaMemory["kind"];
  content: string;
  source: NavixaMemory["source"];
  sensitivity: NavixaMemory["sensitivity"];
  confidence: number;
  salience: number;
  metadata_json?: string | null;
  created_at: string;
  updated_at: string;
  expires_at?: string | null;
};

export class NavixaDbMemoryStore implements MemoryStore {
  constructor(private readonly db: MemorySqlDb) {}

  async list(query: MemoryQuery): Promise<NavixaMemory[]> {
    const includeCore = query.includeCore ?? true;
    const sql = includeCore && query.project !== "core"
      ? `SELECT id,user_id,project,kind,content,source,sensitivity,confidence,salience,metadata_json,created_at,updated_at,expires_at
         FROM navixa_ai_memory
         WHERE user_id=? AND (project=? OR project='core')
         ORDER BY updated_at DESC LIMIT 100`
      : `SELECT id,user_id,project,kind,content,source,sensitivity,confidence,salience,metadata_json,created_at,updated_at,expires_at
         FROM navixa_ai_memory
         WHERE user_id=? AND project=?
         ORDER BY updated_at DESC LIMIT 100`;

    const rows = (await this.db.prepare(sql).bind(query.userId, query.project).all<MemoryRow>()).results;
    return retrieveMemories(rows.map(toMemory), query);
  }

  async upsert(input: MemoryWriteInput): Promise<NavixaMemory> {
    if (shouldRejectMemoryWrite(input)) {
      throw new Error("memory-write-rejected");
    }

    const value = normalizeMemoryWrite(input);
    const now = new Date().toISOString();
    const existing = (await this.db
      .prepare(`SELECT id,created_at FROM navixa_ai_memory
                WHERE user_id=? AND project=? AND kind=? AND content=? LIMIT 1`)
      .bind(value.userId, value.project, value.kind, value.content)
      .all<{ id: string; created_at: string }>()).results[0];

    const id = existing?.id ?? crypto.randomUUID();
    const createdAt = existing?.created_at ?? now;
    const metadataJson = value.metadata ? JSON.stringify(value.metadata) : null;

    if (existing) {
      await execute(this.db, `UPDATE navixa_ai_memory
        SET source=?,sensitivity=?,confidence=?,salience=?,metadata_json=?,updated_at=?,expires_at=?
        WHERE id=? AND user_id=?`, [
        value.source,
        value.sensitivity ?? "standard",
        value.confidence ?? 0.7,
        value.salience ?? 0.5,
        metadataJson,
        now,
        value.expiresAt ?? null,
        id,
        value.userId,
      ]);
    } else {
      await execute(this.db, `INSERT INTO navixa_ai_memory
        (id,user_id,project,kind,content,source,sensitivity,confidence,salience,metadata_json,created_at,updated_at,expires_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
        id,
        value.userId,
        value.project,
        value.kind,
        value.content,
        value.source,
        value.sensitivity ?? "standard",
        value.confidence ?? 0.7,
        value.salience ?? 0.5,
        metadataJson,
        createdAt,
        now,
        value.expiresAt ?? null,
      ]);
    }

    return {
      id,
      userId: value.userId,
      project: value.project,
      kind: value.kind,
      content: value.content,
      source: value.source,
      sensitivity: value.sensitivity ?? "standard",
      confidence: value.confidence ?? 0.7,
      salience: value.salience ?? 0.5,
      metadata: value.metadata,
      createdAt,
      updatedAt: now,
      expiresAt: value.expiresAt ?? null,
    };
  }

  async remove(userId: string, memoryId: string): Promise<void> {
    await execute(this.db, "DELETE FROM navixa_ai_memory WHERE id=? AND user_id=?", [memoryId, userId]);
  }

  async clearProject(userId: string, project: NavixaProjectScope): Promise<void> {
    await execute(this.db, "DELETE FROM navixa_ai_memory WHERE user_id=? AND project=?", [userId, project]);
  }
}

async function execute(db: MemorySqlDb, sql: string, values: unknown[]): Promise<void> {
  const bound = db.prepare(sql).bind(...values);
  if (bound.run) {
    await bound.run();
    return;
  }
  await bound.all();
}

function toMemory(row: MemoryRow): NavixaMemory {
  return {
    id: row.id,
    userId: row.user_id,
    project: row.project,
    kind: row.kind,
    content: row.content,
    source: row.source,
    sensitivity: row.sensitivity,
    confidence: Number(row.confidence),
    salience: Number(row.salience),
    metadata: parseMetadata(row.metadata_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    expiresAt: row.expires_at ?? null,
  };
}

function parseMetadata(value?: string | null): NavixaMemory["metadata"] {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}
