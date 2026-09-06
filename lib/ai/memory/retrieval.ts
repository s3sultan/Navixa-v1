import { canReadMemory, isExpiredMemory } from "./policy.ts";
import type { MemoryQuery, NavixaMemory } from "./types.ts";

export function retrieveMemories(
  memories: NavixaMemory[],
  query: MemoryQuery,
): NavixaMemory[] {
  const now = new Date(query.now ?? Date.now());
  const terms = tokenize(query.text ?? "");
  const allowedKinds = query.kinds ? new Set(query.kinds) : null;
  const limit = Math.min(20, Math.max(1, query.limit ?? 8));

  return memories
    .filter((memory) => canReadMemory(memory, query.userId, query.project, query.includeCore ?? true))
    .filter((memory) => !isExpiredMemory(memory, now))
    .filter((memory) => !allowedKinds || allowedKinds.has(memory.kind))
    .map((memory) => ({ memory, score: scoreMemory(memory, terms) }))
    .sort((a, b) => b.score - a.score || Date.parse(b.memory.updatedAt) - Date.parse(a.memory.updatedAt))
    .slice(0, limit)
    .map(({ memory }) => memory);
}

function scoreMemory(memory: NavixaMemory, terms: string[]): number {
  const text = memory.content.toLocaleLowerCase();
  const lexical = terms.length
    ? terms.reduce((score, term) => score + (text.includes(term) ? 1 : 0), 0) / terms.length
    : 0.5;

  const sourceWeight = memory.source === "explicit_user" ? 1 : 0.8;
  const sensitivityWeight = memory.sensitivity === "restricted" ? 0.6 : 1;

  return (
    lexical * 0.45 +
    memory.salience * 0.25 +
    memory.confidence * 0.2 +
    sourceWeight * 0.1
  ) * sensitivityWeight;
}

function tokenize(value: string): string[] {
  return Array.from(
    new Set(
      value
        .toLocaleLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .map((part) => part.trim())
        .filter((part) => part.length >= 2),
    ),
  );
}
