const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { app } = require('electron');

const dbDir = app ? app.getPath('userData') : __dirname;
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
const dbPath = path.join(dbDir, 'ro-erp.db');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  alt_contact TEXT,
  amc_status TEXT DEFAULT 'none',       -- none | active | expired
  amc_renewal_date TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS vendors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  sku TEXT,
  category TEXT,                         -- RO Unit | Filter | Membrane | Spare | Accessory
  cost_price REAL DEFAULT 0,
  sell_price REAL DEFAULT 0,
  reorder_level INTEGER DEFAULT 5,
  qty_on_hand INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vendor_id INTEGER REFERENCES vendors(id),
  date TEXT NOT NULL,
  total_amount REAL DEFAULT 0,
  payment_status TEXT DEFAULT 'Due',     -- Paid | Partial | Due
  amount_paid REAL DEFAULT 0,
  invoice_ref TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS purchase_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_id INTEGER REFERENCES purchases(id) ON DELETE CASCADE,
  item_id INTEGER REFERENCES items(id),
  qty INTEGER NOT NULL,
  unit_cost REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER REFERENCES customers(id),
  invoice_no TEXT UNIQUE,
  date TEXT NOT NULL,
  total_amount REAL DEFAULT 0,
  discount REAL DEFAULT 0,
  payment_mode TEXT DEFAULT 'Cash',      -- Cash | UPI | Card | Credit
  amount_paid REAL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS customer_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER REFERENCES customers(id),
  sale_id INTEGER REFERENCES sales(id),
  amount REAL NOT NULL,
  date TEXT DEFAULT (datetime('now')),
  note TEXT
);

CREATE TABLE IF NOT EXISTS installations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER REFERENCES customers(id),
  sale_id INTEGER REFERENCES sales(id),
  item_label TEXT,
  install_date TEXT,
  service_interval_days INTEGER,
  next_service_date TEXT,
  last_reminder_sent_date TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sale_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER REFERENCES sales(id) ON DELETE CASCADE,
  item_id INTEGER REFERENCES items(id),
  qty INTEGER NOT NULL,
  unit_price REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS stock_adjustments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER REFERENCES items(id),
  qty_change INTEGER NOT NULL,
  reason TEXT,
  date TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS service_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER REFERENCES customers(id),
  technician TEXT,
  status TEXT DEFAULT 'Pending',         -- Pending | In Progress | Resolved
  issue TEXT,
  scheduled_date TEXT,
  resolution_notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'Staff',             -- Owner | Staff | Technician
  username TEXT UNIQUE,
  password_hash TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
`);

// migration: add amount_paid to sales if upgrading from a pre-Phase-4 database
const salesCols = db.prepare("PRAGMA table_info(sales)").all().map(c => c.name);
if (!salesCols.includes('amount_paid')) {
  db.exec("ALTER TABLE sales ADD COLUMN amount_paid REAL DEFAULT 0");
  db.exec("UPDATE sales SET amount_paid = CASE WHEN payment_mode = 'Credit' THEN 0 ELSE total_amount END");
}

// seed a default owner + business settings if empty
const bcrypt = require('bcryptjs');
const userCount = db.prepare('SELECT COUNT(*) c FROM users').get().c;
if (userCount === 0) {
  const defaultHash = bcrypt.hashSync('changeme', 10);
  db.prepare(`INSERT INTO users (name, role, username, password_hash) VALUES (?,?,?,?)`)
    .run('Niloy Goswami', 'Owner', 'admin', defaultHash);
}
const seedSettings = {
  business_name: 'Healthy Appliances',
  business_tagline: 'Neer Shuddh — RO Water Purifiers',
  address: '',
  phone: '',
  invoice_prefix: 'HA',
  service_reminder_days: '3'
};
const insertSetting = db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`);
for (const [k, v] of Object.entries(seedSettings)) insertSetting.run(k, v);

module.exports = db;
