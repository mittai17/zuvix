/* server/src/chat-store.ts — Persistent chat sessions & messages via SQLite */
import Database from 'better-sqlite3';
import * as path from 'path';

const DB_PATH = path.resolve(__dirname, '../../data/chat.db');

interface SessionRow {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

interface MessageRow {
  id: string;
  session_id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  created_at: string;
}

class ChatStore {
  private db: Database.Database;

  constructor() {
    const fs = require('fs');
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    this.db = new Database(DB_PATH);
    this.db.pragma('journal_mode = WAL');
    this.init();
  }

  private init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('user','agent','system')),
        content TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, created_at);
    `);
  }

  private uid(): string {
    return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  createSession(name: string): SessionRow {
    const id = this.uid();
    const now = new Date().toISOString();
    this.db.prepare(
      'INSERT INTO sessions (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)'
    ).run(id, name, now, now);
    return this.getSession(id)!;
  }

  getSessions(): SessionRow[] {
    return this.db.prepare(`
      SELECT s.*, (SELECT COUNT(*) FROM messages m WHERE m.session_id = s.id) as message_count
      FROM sessions s ORDER BY s.updated_at DESC
    `).all() as SessionRow[];
  }

  getSession(id: string): SessionRow | null {
    const row = this.db.prepare(`
      SELECT s.*, (SELECT COUNT(*) FROM messages m WHERE m.session_id = s.id) as message_count
      FROM sessions s WHERE s.id = ?
    `).get(id) as SessionRow | undefined;
    return row || null;
  }

  deleteSession(id: string): boolean {
    const tx = this.db.transaction(() => {
      this.db.prepare('DELETE FROM messages WHERE session_id = ?').run(id);
      const info = this.db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
      return info.changes > 0;
    });
    return tx();
  }

  addMessage(sessionId: string, role: 'user' | 'agent' | 'system', content: string): MessageRow {
    const id = this.uid();
    const now = new Date().toISOString();
    this.db.prepare(
      'INSERT INTO messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(id, sessionId, role, content, now);
    this.db.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?').run(now, sessionId);
    return { id, session_id: sessionId, role, content, created_at: now };
  }

  addMessages(sessionId: string, msgs: { role: 'user' | 'agent' | 'system'; content: string }[]): MessageRow[] {
    const tx = this.db.transaction(() => {
      return msgs.map(m => this.addMessage(sessionId, m.role, m.content));
    });
    return tx();
  }

  getMessages(sessionId: string, limit = 200): MessageRow[] {
    return this.db.prepare(
      'SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC LIMIT ?'
    ).all(sessionId, limit) as MessageRow[];
  }

  updateSessionName(id: string, name: string): boolean {
    const info = this.db.prepare('UPDATE sessions SET name = ?, updated_at = ? WHERE id = ?')
      .run(name, new Date().toISOString(), id);
    return info.changes > 0;
  }
}

export const chatStore = new ChatStore();
