export interface MemoryVector {
  id: string;
  content: string;
  embedding: number[];
  metadata: Record<string, unknown>;
  score?: number;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < len; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (!normA || !normB) {
    return 0;
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function rankBySimilarity(query: number[], candidates: MemoryVector[], topK: number): MemoryVector[] {
  return candidates
    .map((candidate) => ({ ...candidate, score: cosineSimilarity(query, candidate.embedding) }))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, topK);
}
