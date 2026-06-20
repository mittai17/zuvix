import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_DIR = path.join(process.env.HOME || '/tmp', '.zuvix');
const DB_PATH = path.join(DB_DIR, 'memory.db');

export class MemoryEngine {
  private db: Database.Database;
  private ready: boolean = false;

  constructor() {
    if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
    this.db = new Database(DB_PATH);
    this.init();
  }

  private init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memory_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        content TEXT NOT NULL,
        embedding BLOB,
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      );
      CREATE INDEX IF NOT EXISTS idx_memory_session ON memory_entries(session_id);
      CREATE INDEX IF NOT EXISTS idx_memory_created ON memory_entries(created_at);
    `);
    this.ready = true;
    console.log(`[Memory] SQLite vector store ready at ${DB_PATH}`);
  }

  /** Simple token-frequency vector (fast, no API call) */
  private textToVector(text: string): Float64Array {
    const tokens = text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
    const freq = new Map<string, number>();
    for (const t of tokens) freq.set(t, (freq.get(t) || 0) + 1);
    // Deterministic hash-based vector (64-dim)
    const vec = new Float64Array(64);
    for (const [token, count] of freq) {
      let hash = 0;
      for (let i = 0; i < token.length; i++) {
        hash = ((hash << 5) - hash) + token.charCodeAt(i);
        hash |= 0;
      }
      const idx = Math.abs(hash) % 64;
      vec[idx] += count / tokens.length;
    }
    return vec;
  }

  private cosineSimilarity(a: Float64Array, b: Float64Array): number {
    let dot = 0, magA = 0, magB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      magA += a[i] * a[i];
      magB += b[i] * b[i];
    }
    const denom = Math.sqrt(magA) * Math.sqrt(magB);
    return denom === 0 ? 0 : dot / denom;
  }

  async saveMemory(sessionId: string, text: string, role: string = 'user'): Promise<void> {
    if (!this.ready) return;
    const vec = this.textToVector(text);
    const buf = Buffer.from(vec.buffer);
    const stmt = this.db.prepare(
      'INSERT INTO memory_entries (session_id, role, content, embedding) VALUES (?, ?, ?, ?)'
    );
    stmt.run(sessionId, role, text, buf);
  }

  async searchMemory(sessionId: string, query: string, topK: number = 5): Promise<string[]> {
    if (!this.ready) return [];
    const queryVec = this.textToVector(query);

    const rows = this.db.prepare(
      'SELECT id, content, embedding FROM memory_entries WHERE session_id = ? ORDER BY created_at DESC LIMIT 100'
    ).all(sessionId) as { id: number; content: string; embedding: Buffer }[];

    const scored = rows.map(row => {
      const storedVec = new Float64Array(row.embedding.buffer, row.embedding.byteOffset, 64);
      const sim = this.cosineSimilarity(queryVec, storedVec);
      return { content: row.content, sim };
    });

    scored.sort((a, b) => b.sim - a.sim);
    return scored.slice(0, topK).map(s => s.content);
  }

  async getRecentMemory(sessionId: string, limit: number = 20): Promise<string[]> {
    if (!this.ready) return [];
    const rows = this.db.prepare(
      'SELECT content FROM memory_entries WHERE session_id = ? ORDER BY created_at DESC LIMIT ?'
    ).all(sessionId, limit) as { content: string }[];
    return rows.map(r => r.content);
  }

  async getHistory(sessionId: string): Promise<{ role: string; content: string }[]> {
    if (!this.ready) return [];
    const rows = this.db.prepare(
      'SELECT role, content FROM memory_entries WHERE session_id = ? ORDER BY created_at ASC'
    ).all(sessionId) as { role: string; content: string }[];
    return rows;
  }

  async listSessions(): Promise<string[]> {
    if (!this.ready) return [];
    const rows = this.db.prepare(
      'SELECT DISTINCT session_id FROM memory_entries'
    ).all() as { session_id: string }[];
    return rows.map(r => r.session_id);
  }

  close() {
    this.db.close();
    this.ready = false;
  }
}

export const memoryEngine = new MemoryEngine();
