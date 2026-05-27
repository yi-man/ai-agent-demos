import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  intent TEXT,
  emotion TEXT,
  stage TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bargain_counts (
  session_id TEXT PRIMARY KEY,
  count INTEGER DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS session_stages (
  session_id TEXT PRIMARY KEY,
  stage TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`;

export class ChatStore {
  #db;

  /**
   * @param {string} dbPath - Path to the SQLite database file (or ':memory:').
   */
  constructor(dbPath) {
    // Ensure parent directory exists (skip for :memory:)
    if (dbPath !== ':memory:') {
      mkdirSync(dirname(dbPath), { recursive: true });
    }

    this.#db = new Database(dbPath);
    this.#db.exec(SCHEMA);
  }

  /**
   * Insert a chat message.
   * @param {string} sessionId
   * @param {'user'|'assistant'|'system'} role
   * @param {string} content
   * @param {{ intent?: string, emotion?: string, stage?: string }} [meta]
   */
  addMessage(sessionId, role, content, meta = {}) {
    const stmt = this.#db.prepare(
      `INSERT INTO messages (session_id, role, content, intent, emotion, stage)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    stmt.run(sessionId, role, content, meta.intent ?? null, meta.emotion ?? null, meta.stage ?? null);
  }

  /**
   * Retrieve recent messages for a session in chronological order.
   * @param {string} sessionId
   * @param {number} [limit=50]
   * @returns {Array<{role: string, content: string, intent: string|null, emotion: string|null, stage: string|null, created_at: string}>}
   */
  getContext(sessionId, limit = 50) {
    const stmt = this.#db.prepare(
      `SELECT role, content, intent, emotion, stage, created_at
       FROM messages
       WHERE session_id = ?
       ORDER BY created_at ASC
       LIMIT ?`
    );
    return stmt.all(sessionId, limit);
  }

  /**
   * Increment the bargain counter for a session (upsert).
   * @param {string} sessionId
   */
  incrementBargainCount(sessionId) {
    const stmt = this.#db.prepare(
      `INSERT INTO bargain_counts (session_id, count, updated_at)
       VALUES (?, 1, CURRENT_TIMESTAMP)
       ON CONFLICT(session_id) DO UPDATE
       SET count = count + 1, updated_at = CURRENT_TIMESTAMP`
    );
    stmt.run(sessionId);
  }

  /**
   * Get the current bargain count for a session.
   * @param {string} sessionId
   * @returns {number}
   */
  getBargainCount(sessionId) {
    const row = this.#db.prepare(
      `SELECT count FROM bargain_counts WHERE session_id = ?`
    ).get(sessionId);
    return row?.count ?? 0;
  }

  /**
   * Set (upsert) the stage for a session.
   * @param {string} sessionId
   * @param {string} stage
   */
  updateStage(sessionId, stage) {
    const stmt = this.#db.prepare(
      `INSERT INTO session_stages (session_id, stage, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(session_id) DO UPDATE
       SET stage = excluded.stage, updated_at = CURRENT_TIMESTAMP`
    );
    stmt.run(sessionId, stage);
  }

  /**
   * Get the current stage for a session.
   * @param {string} sessionId
   * @returns {string|null}
   */
  getStage(sessionId) {
    const row = this.#db.prepare(
      `SELECT stage FROM session_stages WHERE session_id = ?`
    ).get(sessionId);
    return row?.stage ?? null;
  }

  /** Close the database connection. */
  close() {
    this.#db.close();
  }
}
