import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

const DB_PATH = process.env.DATABASE_PATH || './data/zenspend.db';

// Ensure directory exists
const dir = dirname(DB_PATH);
if (!existsSync(dir)) {
  mkdirSync(dir, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

console.log('Running migrations...');

// Create categories table
db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    weekly_budget REAL NOT NULL DEFAULT 0,
    period TEXT NOT NULL DEFAULT 'weekly' CHECK(period IN ('weekly', 'monthly')),
    color TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

// Create transactions table
db.exec(`
  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    amount REAL NOT NULL,
    category_id TEXT,
    description TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('expense', 'income', 'cc_payment')),
    is_fixed INTEGER NOT NULL DEFAULT 0,
    group_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

// Create settings table
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    monthly_income REAL NOT NULL DEFAULT 8000,
    currency TEXT NOT NULL DEFAULT '$',
    show_fixed_costs INTEGER NOT NULL DEFAULT 1,
    checking_balance REAL NOT NULL DEFAULT 0,
    credit_card_balance REAL NOT NULL DEFAULT 0,
    balance_as_of TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

// Create indexes
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
  CREATE INDEX IF NOT EXISTS idx_transactions_group ON transactions(group_id);
  CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
  CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
`);

// Insert default settings if not exists
const settingsExist = db.prepare('SELECT COUNT(*) as count FROM settings').get() as { count: number };
if (settingsExist.count === 0) {
  db.prepare(`
    INSERT INTO settings (id, monthly_income, currency, show_fixed_costs, checking_balance, credit_card_balance, balance_as_of)
    VALUES (1, 8000, '$', 1, 0, 0, datetime('now'))
  `).run();
  console.log('Created default settings');
}

console.log('Migrations completed successfully!');
db.close();
