import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'path'

export interface ClipboardItem {
  id: number
  content: string
  content_type: string
  created_at: number
  pinned: number
}

let db: Database.Database

export function initDatabase(): void {
  const dbPath = path.join(app.getPath('userData'), 'clipboard.db')
  db = new Database(dbPath)

  db.exec(`
    CREATE TABLE IF NOT EXISTS clipboard_items (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      content      TEXT    NOT NULL,
      content_type TEXT    NOT NULL DEFAULT 'text',
      created_at   INTEGER NOT NULL,
      pinned       INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_created_at ON clipboard_items (created_at DESC);
  `)
}

export function insertItem(content: string, contentType = 'text'): void {
  const existing = db.prepare('SELECT id FROM clipboard_items WHERE content = ?').get(content)

  if (existing) {
    db.prepare('UPDATE clipboard_items SET created_at = ? WHERE content = ?').run(Date.now(), content)
  } else {
    db.prepare(
      'INSERT INTO clipboard_items (content, content_type, created_at) VALUES (?, ?, ?)'
    ).run(content, contentType, Date.now())

    // Keep at most 100 unpinned items
    db.prepare(`
      DELETE FROM clipboard_items
      WHERE pinned = 0
        AND id NOT IN (
          SELECT id FROM clipboard_items WHERE pinned = 0 ORDER BY created_at DESC LIMIT 100
        )
    `).run()
  }
}

export function getItems(search = '', limit = 100): ClipboardItem[] {
  if (search) {
    return db
      .prepare(
        `SELECT * FROM clipboard_items
         WHERE content LIKE ?
         ORDER BY pinned DESC, created_at DESC
         LIMIT ?`
      )
      .all(`%${search}%`, limit) as ClipboardItem[]
  }
  return db
    .prepare(
      `SELECT * FROM clipboard_items
       ORDER BY pinned DESC, created_at DESC
       LIMIT ?`
    )
    .all(limit) as ClipboardItem[]
}

export function deleteItem(id: number): void {
  db.prepare('DELETE FROM clipboard_items WHERE id = ?').run(id)
}

export function clearHistory(): void {
  db.prepare('DELETE FROM clipboard_items WHERE pinned = 0').run()
}

export function togglePin(id: number): void {
  db.prepare(
    'UPDATE clipboard_items SET pinned = CASE WHEN pinned = 1 THEN 0 ELSE 1 END WHERE id = ?'
  ).run(id)
}
