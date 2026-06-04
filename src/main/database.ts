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

// Prepared once in initDatabase() and reused on every call.
let stmtGetByContent: Database.Statement
let stmtUpdateTime:   Database.Statement
let stmtInsert:       Database.Statement
let stmtTrim:         Database.Statement
let stmtSearch:       Database.Statement
let stmtAll:          Database.Statement
let stmtDelete:       Database.Statement
let stmtClear:        Database.Statement
let stmtTogglePin:    Database.Statement

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

  stmtGetByContent = db.prepare('SELECT id FROM clipboard_items WHERE content = ?')
  stmtUpdateTime   = db.prepare('UPDATE clipboard_items SET created_at = ? WHERE content = ?')
  stmtInsert       = db.prepare('INSERT INTO clipboard_items (content, content_type, created_at) VALUES (?, ?, ?)')
  stmtTrim         = db.prepare(`
    DELETE FROM clipboard_items
    WHERE pinned = 0
      AND id NOT IN (SELECT id FROM clipboard_items WHERE pinned = 0 ORDER BY created_at DESC LIMIT 100)
  `)
  stmtSearch       = db.prepare('SELECT * FROM clipboard_items WHERE content LIKE ? ORDER BY pinned DESC, created_at DESC LIMIT ?')
  stmtAll          = db.prepare('SELECT * FROM clipboard_items ORDER BY pinned DESC, created_at DESC LIMIT ?')
  stmtDelete       = db.prepare('DELETE FROM clipboard_items WHERE id = ?')
  stmtClear        = db.prepare('DELETE FROM clipboard_items WHERE pinned = 0')
  stmtTogglePin    = db.prepare('UPDATE clipboard_items SET pinned = CASE WHEN pinned = 1 THEN 0 ELSE 1 END WHERE id = ?')
}

export function insertItem(content: string, contentType = 'text'): void {
  if (stmtGetByContent.get(content)) {
    stmtUpdateTime.run(Date.now(), content)
  } else {
    stmtInsert.run(content, contentType, Date.now())
    stmtTrim.run()
  }
}

export function getItems(search = '', limit = 100): ClipboardItem[] {
  return (search
    ? stmtSearch.all(`%${search}%`, limit)
    : stmtAll.all(limit)) as ClipboardItem[]
}

export function deleteItem(id: number): void {
  stmtDelete.run(id)
}

export function clearHistory(): void {
  stmtClear.run()
}

export function togglePin(id: number): void {
  stmtTogglePin.run(id)
}
