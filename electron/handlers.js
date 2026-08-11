const { ipcMain, app, dialog, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('./db');

function registerHandlers() {
  // ---------- AUTH ----------
  ipcMain.handle('auth:login', (e, { username, password }) => {
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) return { ok: false, error: 'User not found' };
    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) return { ok: false, error: 'Incorrect password' };
    return { ok: true, user: { id: user.id, name: user.name, role: user.role, username: user.username } };
  });
  ipcMain.handle('auth:changePassword', (e, { userId, currentPassword, newPassword }) => {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) return { ok: false, error: 'User not found' };
    const valid = bcrypt.compareSync(currentPassword, user.password_hash);
    if (!valid) return { ok: false, error: 'Current password is incorrect' };
    const hash = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, userId);
    return { ok: true };
  });

  // ---------- SESSION PERSISTENCE ----------
  const sessionPath = path.join(app.getPath('userData'), 'session.json');
  ipcMain.handle('session:get', () => {
    try {
      if (!fs.existsSync(sessionPath)) return { ok: false };
      const { userId } = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
      const user = db.prepare('SELECT id, name, role, username FROM users WHERE id = ?').get(userId);
      if (!user) return { ok: false };
      return { ok: true, user };
    } catch {
      return { ok: false };
    }
  });
  ipcMain.handle('session:save', (e, userId) => {
    fs.writeFileSync(sessionPath, JSON.stringify({ userId }));
    return { ok: true };
  });
  ipcMain.handle('session:clear', () => {
    if (fs.existsSync(sessionPath)) fs.unlinkSync(sessionPath);
    return { ok: true };
  });

  // ---------- GLOBAL SEARCH ----------
  ipcMain.handle('search:global', (e, query) => {
    const q = String(query || '').trim();
    if (q.length < 2) return { customers: [], sales: [], items: [] };
    const like = `%${q}%`;

    const customers = db.prepare(`
      SELECT id, name, phone FROM customers
      WHERE name LIKE ? OR phone LIKE ?
      ORDER BY name LIMIT 5
    `).all(like, like);

    const sales = db.prepare(`
      SELECT s.id, s.invoice_no, s.date, s.total_amount, c.name as customer_name
      FROM sales s LEFT JOIN customers c ON c.id = s.customer_id
      WHERE s.invoice_no LIKE ? OR c.name LIKE ?
      ORDER BY s.date DESC LIMIT 5
    `).all(like, like);

    const items = db.prepare(`
      SELECT id, name, sku, qty_on_hand FROM items
      WHERE name LIKE ? OR sku LIKE ?
      ORDER BY name LIMIT 5
    `).all(like, like);

    return { customers, sales, items };
  });

  // ---------- DASHBOARD ----------
  ipcMain.handle('dashboard:summary', () => {
    const today = new Date().toISOString().slice(0, 10);

    const todaysSales = db.prepare(
      `SELECT COALESCE(SUM(total_amount),0) total, COUNT(*) count FROM sales WHERE date(date) = date(?)`
    ).get(today);

    const todaysPurchases = db.prepare(
      `SELECT COALESCE(SUM(total_amount),0) total, COUNT(*) count FROM purchases WHERE date(date) = date(?)`
    ).get(today);

    const todaysExpenses = db.prepare(
      `SELECT COALESCE(SUM(amount),0) total, COUNT(*) count FROM expenses WHERE date(date) = date(?)`
    ).get(today);

    const newCustomers = db.prepare(
      `SELECT COUNT(*) count FROM customers WHERE date(created_at) = date(?)`
    ).get(today);

    const pendingServices = db.prepare(
      `SELECT COUNT(*) count FROM service_requests WHERE status != 'Resolved'`
    ).get();

    const stockAlerts = db.prepare(
      `SELECT id, name, qty_on_hand, reorder_level FROM items WHERE qty_on_hand <= reorder_level ORDER BY qty_on_hand ASC`
    ).all();

    const amcDue = db.prepare(`
      SELECT id, name, phone, amc_renewal_date FROM customers
      WHERE amc_status = 'active' AND date(amc_renewal_date) <= date('now', '+30 days')
      ORDER BY amc_renewal_date ASC
    `).all();

    const reminderDays = Number(db.prepare(`SELECT value FROM settings WHERE key = 'service_reminder_days'`).get()?.value || 3);
    const upcomingServices = db.prepare(`
      SELECT i.id, i.item_label, i.next_service_date, c.name as customer_name, c.phone as customer_phone
      FROM installations i JOIN customers c ON c.id = i.customer_id
      WHERE date(i.next_service_date) <= date('now', '+' || ? || ' days')
      ORDER BY i.next_service_date ASC
    `).all(reminderDays);

    const recentActivity = db.prepare(`
      SELECT * FROM (
        SELECT 'sale' type, id, date as ts, ('Invoice ' || invoice_no || ' — ₹' || total_amount) label FROM sales
        UNION ALL
        SELECT 'purchase' type, id, date as ts, ('Purchase #' || id || ' — ₹' || total_amount) label FROM purchases
        UNION ALL
        SELECT 'service' type, id, created_at as ts, ('Service ticket #' || id || ' — ' || status) label FROM service_requests
        UNION ALL
        SELECT 'customer' type, id, created_at as ts, ('New customer: ' || name) label FROM customers
      ) ORDER BY ts DESC LIMIT 15
    `).all();

    return { todaysSales, todaysPurchases, todaysExpenses, newCustomers, pendingServices, stockAlerts, amcDue, upcomingServices, recentActivity };
  });

  // ---------- VENDORS ----------
  ipcMain.handle('vendors:list', () => db.prepare('SELECT * FROM vendors ORDER BY name').all());
  ipcMain.handle('vendors:add', (e, vendor) => {
    const stmt = db.prepare('INSERT INTO vendors (name, phone, address) VALUES (?,?,?)');
    const info = stmt.run(vendor.name, vendor.phone || '', vendor.address || '');
    return { id: info.lastInsertRowid };
  });
  ipcMain.handle('vendors:update', (e, vendor) => {
    db.prepare('UPDATE vendors SET name=?, phone=?, address=? WHERE id=?')
      .run(vendor.name, vendor.phone || '', vendor.address || '', vendor.id);
    return { ok: true };
  });
  ipcMain.handle('vendors:ledger', (e, vendorId) => {
    return db.prepare(`
      SELECT id, date, total_amount, amount_paid, payment_status
      FROM purchases WHERE vendor_id = ? ORDER BY date DESC
    `).all(vendorId);
  });
  ipcMain.handle('vendors:delete', (e, id) => {
    // Keep past purchase records (financial history) but detach them from the deleted vendor
    const tx = db.transaction(() => {
      db.prepare('UPDATE purchases SET vendor_id = NULL WHERE vendor_id = ?').run(id);
      db.prepare('DELETE FROM vendors WHERE id = ?').run(id);
    });
    tx();
    return { ok: true };
  });

  // ---------- ITEMS / STOCK ----------
  ipcMain.handle('items:list', () => db.prepare('SELECT * FROM items ORDER BY name').all());
  ipcMain.handle('items:add', (e, item) => {
    const stmt = db.prepare(`INSERT INTO items (name, sku, category, cost_price, sell_price, reorder_level, qty_on_hand)
      VALUES (?,?,?,?,?,?,?)`);
    const info = stmt.run(item.name, item.sku || '', item.category || '', item.cost_price || 0,
      item.sell_price || 0, item.reorder_level ?? 5, item.qty_on_hand || 0);
    return { id: info.lastInsertRowid };
  });
  ipcMain.handle('items:update', (e, item) => {
    db.prepare(`UPDATE items SET name=?, sku=?, category=?, cost_price=?, sell_price=?, reorder_level=? WHERE id=?`)
      .run(item.name, item.sku, item.category, item.cost_price, item.sell_price, item.reorder_level, item.id);
    return { ok: true };
  });
  ipcMain.handle('items:delete', (e, id) => {
    // Permanent delete, always — including cascading removal from any past purchase/sale line items
    // that reference this item (required because foreign key enforcement is on). Historical purchase/
    // sale totals are NOT recalculated, so old invoice totals may no longer match their remaining line items.
    const tx = db.transaction(() => {
      db.prepare('DELETE FROM sale_items WHERE item_id = ?').run(id);
      db.prepare('DELETE FROM purchase_items WHERE item_id = ?').run(id);
      db.prepare('DELETE FROM stock_adjustments WHERE item_id = ?').run(id);
      db.prepare('DELETE FROM items WHERE id = ?').run(id);
    });
    tx();
    return { ok: true };
  });
  ipcMain.handle('stock:adjust', (e, { item_id, qty_change, reason }) => {
    const tx = db.transaction(() => {
      db.prepare('UPDATE items SET qty_on_hand = qty_on_hand + ? WHERE id = ?').run(qty_change, item_id);
      db.prepare('INSERT INTO stock_adjustments (item_id, qty_change, reason) VALUES (?,?,?)').run(item_id, qty_change, reason || '');
    });
    tx();
    return { ok: true };
  });
  ipcMain.handle('stock:adjustments', (e, item_id) => {
    return db.prepare('SELECT * FROM stock_adjustments WHERE item_id = ? ORDER BY date DESC').all(item_id);
  });

  // ---------- PURCHASE ----------
  ipcMain.handle('purchase:get', (e, purchaseId) => {
    const purchase = db.prepare('SELECT * FROM purchases WHERE id = ?').get(purchaseId);
    if (!purchase) return null;
    const items = db.prepare(`SELECT pi.*, i.name as item_name FROM purchase_items pi
      JOIN items i ON i.id = pi.item_id WHERE pi.purchase_id = ?`).all(purchaseId);
    return { purchase, items };
  });
  ipcMain.handle('purchase:update', (e, payload) => {
    const { id, vendor_id, date, payment_status, amount_paid, invoice_ref, notes, items } = payload;
    const oldItems = db.prepare('SELECT * FROM purchase_items WHERE purchase_id = ?').all(id);
    const total_amount = items.reduce((s, it) => s + it.qty * it.unit_cost, 0);

    const tx = db.transaction(() => {
      const reverseStock = db.prepare('UPDATE items SET qty_on_hand = qty_on_hand - ? WHERE id = ?');
      oldItems.forEach(oi => reverseStock.run(oi.qty, oi.item_id));

      db.prepare('DELETE FROM purchase_items WHERE purchase_id = ?').run(id);

      const insertPI = db.prepare('INSERT INTO purchase_items (purchase_id, item_id, qty, unit_cost) VALUES (?,?,?,?)');
      const bumpStock = db.prepare('UPDATE items SET qty_on_hand = qty_on_hand + ? WHERE id = ?');
      items.forEach(it => {
        insertPI.run(id, it.item_id, it.qty, it.unit_cost);
        bumpStock.run(it.qty, it.item_id);
      });

      db.prepare(`UPDATE purchases SET vendor_id=?, date=?, total_amount=?, payment_status=?, amount_paid=?, invoice_ref=?, notes=? WHERE id=?`)
        .run(vendor_id, date, total_amount, payment_status || 'Due', amount_paid || 0, invoice_ref || '', notes || '', id);
    });
    tx();
    return { ok: true, total_amount };
  });
  ipcMain.handle('purchase:create', (e, payload) => {
    const { vendor_id, date, payment_status, amount_paid, invoice_ref, notes, items } = payload;
    const total_amount = items.reduce((s, it) => s + it.qty * it.unit_cost, 0);
    const tx = db.transaction(() => {
      const info = db.prepare(`INSERT INTO purchases (vendor_id, date, total_amount, payment_status, amount_paid, invoice_ref, notes)
        VALUES (?,?,?,?,?,?,?)`).run(vendor_id, date, total_amount, payment_status || 'Due', amount_paid || 0, invoice_ref || '', notes || '');
      const purchaseId = info.lastInsertRowid;
      const insertPI = db.prepare('INSERT INTO purchase_items (purchase_id, item_id, qty, unit_cost) VALUES (?,?,?,?)');
      const bumpStock = db.prepare('UPDATE items SET qty_on_hand = qty_on_hand + ? WHERE id = ?');
      for (const it of items) {
        insertPI.run(purchaseId, it.item_id, it.qty, it.unit_cost);
        bumpStock.run(it.qty, it.item_id);
      }
      return purchaseId;
    });
    const purchaseId = tx();
    return { id: purchaseId, total_amount };
  });
  ipcMain.handle('purchase:list', (e, filters = {}) => {
    let q = `SELECT p.*, v.name as vendor_name FROM purchases p LEFT JOIN vendors v ON v.id = p.vendor_id WHERE 1=1`;
    const params = [];
    if (filters.from) { q += ' AND date(p.date) >= date(?)'; params.push(filters.from); }
    if (filters.to) { q += ' AND date(p.date) <= date(?)'; params.push(filters.to); }
    if (filters.vendor_id) { q += ' AND p.vendor_id = ?'; params.push(filters.vendor_id); }
    q += ' ORDER BY p.date DESC';
    return db.prepare(q).all(...params);
  });
  ipcMain.handle('purchase:items', (e, purchaseId) => {
    return db.prepare(`SELECT pi.*, i.name as item_name FROM purchase_items pi
      JOIN items i ON i.id = pi.item_id WHERE pi.purchase_id = ?`).all(purchaseId);
  });
  ipcMain.handle('purchase:delete', (e, id) => {
    const items = db.prepare('SELECT item_id, qty FROM purchase_items WHERE purchase_id = ?').all(id);
    const tx = db.transaction(() => {
      const reverseStock = db.prepare('UPDATE items SET qty_on_hand = qty_on_hand - ? WHERE id = ?');
      items.forEach(it => reverseStock.run(it.qty, it.item_id));
      db.prepare('DELETE FROM purchase_items WHERE purchase_id = ?').run(id);
      db.prepare('DELETE FROM purchases WHERE id = ?').run(id);
    });
    tx();
    return { ok: true };
  });

  // ---------- SELL ----------
  ipcMain.handle('sell:nextInvoiceNo', () => {
    const prefix = db.prepare(`SELECT value FROM settings WHERE key='invoice_prefix'`).get()?.value || 'INV';
    const count = db.prepare('SELECT COUNT(*) c FROM sales').get().c;
    return `${prefix}-${String(count + 1).padStart(5, '0')}`;
  });
  ipcMain.handle('sell:checkStock', (e, items) => {
    const shortages = [];
    for (const it of items) {
      const row = db.prepare('SELECT qty_on_hand, name FROM items WHERE id = ?').get(it.item_id);
      if (!row || row.qty_on_hand < it.qty) {
        shortages.push({ item_id: it.item_id, name: row?.name, available: row?.qty_on_hand ?? 0, requested: it.qty });
      }
    }
    return shortages;
  });
  ipcMain.handle('sell:create', (e, payload) => {
    const { customer_id, date, discount, payment_mode, items, invoice_no, amount_paid } = payload;
    const gross = items.reduce((s, it) => s + it.qty * it.unit_price, 0);
    const total_amount = Math.max(0, gross - (discount || 0));
    const paid = payment_mode === 'Credit' ? Number(amount_paid || 0) : total_amount;
    const tx = db.transaction(() => {
      const info = db.prepare(`INSERT INTO sales (customer_id, invoice_no, date, total_amount, discount, payment_mode, amount_paid)
        VALUES (?,?,?,?,?,?,?)`).run(customer_id, invoice_no, date, total_amount, discount || 0, payment_mode || 'Cash', paid);
      const saleId = info.lastInsertRowid;
      const insertSI = db.prepare('INSERT INTO sale_items (sale_id, item_id, qty, unit_price) VALUES (?,?,?,?)');
      const reduceStock = db.prepare('UPDATE items SET qty_on_hand = qty_on_hand - ? WHERE id = ?');
      for (const it of items) {
        insertSI.run(saleId, it.item_id, it.qty, it.unit_price);
        reduceStock.run(it.qty, it.item_id);
      }
      return saleId;
    });
    const saleId = tx();
    return { id: saleId, total_amount };
  });
  ipcMain.handle('sell:list', (e, filters = {}) => {
    let q = `SELECT s.*, c.name as customer_name, (s.total_amount - s.amount_paid) as balance_due
      FROM sales s LEFT JOIN customers c ON c.id = s.customer_id WHERE 1=1`;
    const params = [];
    if (filters.from) { q += ' AND date(s.date) >= date(?)'; params.push(filters.from); }
    if (filters.to) { q += ' AND date(s.date) <= date(?)'; params.push(filters.to); }
    if (filters.customer_id) { q += ' AND s.customer_id = ?'; params.push(filters.customer_id); }
    q += ' ORDER BY s.date DESC';
    return db.prepare(q).all(...params);
  });
  ipcMain.handle('sell:items', (e, saleId) => {
    return db.prepare(`SELECT si.*, i.name as item_name FROM sale_items si
      JOIN items i ON i.id = si.item_id WHERE si.sale_id = ?`).all(saleId);
  });
  ipcMain.handle('sell:get', (e, saleId) => {
    const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId);
    if (!sale) return null;
    const items = db.prepare(`SELECT si.*, i.name as item_name FROM sale_items si
      JOIN items i ON i.id = si.item_id WHERE si.sale_id = ?`).all(saleId);
    return { sale, items };
  });
  ipcMain.handle('sell:delete', (e, id) => {
    const items = db.prepare('SELECT item_id, qty FROM sale_items WHERE sale_id = ?').all(id);
    const tx = db.transaction(() => {
      // give the stock back, since this sale never "happened" once deleted
      const restoreStock = db.prepare('UPDATE items SET qty_on_hand = qty_on_hand + ? WHERE id = ?');
      items.forEach(it => restoreStock.run(it.qty, it.item_id));

      // keep payment history and service reminders, just detach them from the deleted sale
      db.prepare('UPDATE customer_payments SET sale_id = NULL WHERE sale_id = ?').run(id);
      db.prepare('UPDATE installations SET sale_id = NULL WHERE sale_id = ?').run(id);

      db.prepare('DELETE FROM sale_items WHERE sale_id = ?').run(id);
      db.prepare('DELETE FROM sales WHERE id = ?').run(id);
    });
    tx();
    return { ok: true };
  });

  ipcMain.handle('sell:checkStockForEdit', (e, { saleId, items }) => {
    // when editing, the sale's OLD quantities are effectively "available again" first
    const oldItems = db.prepare('SELECT item_id, qty FROM sale_items WHERE sale_id = ?').all(saleId);
    const restoreMap = {};
    oldItems.forEach(oi => { restoreMap[oi.item_id] = (restoreMap[oi.item_id] || 0) + oi.qty; });

    const shortages = [];
    for (const it of items) {
      const row = db.prepare('SELECT qty_on_hand, name FROM items WHERE id = ?').get(it.item_id);
      const effectiveAvailable = (row?.qty_on_hand || 0) + (restoreMap[it.item_id] || 0);
      if (!row || effectiveAvailable < it.qty) {
        shortages.push({ item_id: it.item_id, name: row?.name, available: effectiveAvailable, requested: it.qty });
      }
    }
    return shortages;
  });
  ipcMain.handle('sell:update', (e, payload) => {
    const { id, customer_id, date, discount, payment_mode, items, amount_paid } = payload;
    const existing = db.prepare('SELECT * FROM sales WHERE id = ?').get(id);
    if (!existing) return { ok: false, error: 'Sale not found' };

    const oldItems = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(id);
    const gross = items.reduce((s, it) => s + it.qty * it.unit_price, 0);
    const total_amount = Math.max(0, gross - (discount || 0));
    const paid = payment_mode === 'Credit' ? Number(amount_paid || 0) : total_amount;

    const tx = db.transaction(() => {
      // restore stock from the sale's old items first
      const restoreStmt = db.prepare('UPDATE items SET qty_on_hand = qty_on_hand + ? WHERE id = ?');
      oldItems.forEach(oi => restoreStmt.run(oi.qty, oi.item_id));

      // clear old line items
      db.prepare('DELETE FROM sale_items WHERE sale_id = ?').run(id);

      // insert corrected line items and deduct stock accordingly
      const insertSI = db.prepare('INSERT INTO sale_items (sale_id, item_id, qty, unit_price) VALUES (?,?,?,?)');
      const deductStmt = db.prepare('UPDATE items SET qty_on_hand = qty_on_hand - ? WHERE id = ?');
      items.forEach(it => {
        insertSI.run(id, it.item_id, it.qty, it.unit_price);
        deductStmt.run(it.qty, it.item_id);
      });

      db.prepare(`UPDATE sales SET customer_id=?, date=?, total_amount=?, discount=?, payment_mode=?, amount_paid=? WHERE id=?`)
        .run(customer_id, date, total_amount, discount || 0, payment_mode || 'Cash', paid, id);
    });
    tx();
    return { ok: true, total_amount };
  });

  // ---------- EXPENSES ----------
  ipcMain.handle('expenses:create', (e, exp) => {
    const info = db.prepare(`INSERT INTO expenses (date, category, description, amount) VALUES (?,?,?,?)`)
      .run(exp.date, exp.category || 'Miscellaneous', exp.description || '', Number(exp.amount));
    return { id: info.lastInsertRowid };
  });
  ipcMain.handle('expenses:list', (e, filters = {}) => {
    let q = 'SELECT * FROM expenses WHERE 1=1';
    const params = [];
    if (filters.from) { q += ' AND date(date) >= date(?)'; params.push(filters.from); }
    if (filters.to) { q += ' AND date(date) <= date(?)'; params.push(filters.to); }
    if (filters.category) { q += ' AND category = ?'; params.push(filters.category); }
    q += ' ORDER BY date DESC, id DESC';
    return db.prepare(q).all(...params);
  });
  ipcMain.handle('expenses:delete', (e, id) => {
    db.prepare('DELETE FROM expenses WHERE id = ?').run(id);
    return { ok: true };
  });
  ipcMain.handle('expenses:update', (e, exp) => {
    db.prepare('UPDATE expenses SET date=?, category=?, description=?, amount=? WHERE id=?')
      .run(exp.date, exp.category || 'Miscellaneous', exp.description || '', Number(exp.amount), exp.id);
    return { ok: true };
  });
  ipcMain.handle('expenses:summary', (e, { from, to } = {}) => {
    const today = new Date().toISOString().slice(0, 10);
    const todayTotal = db.prepare(`SELECT COALESCE(SUM(amount),0) v FROM expenses WHERE date(date) = date(?)`).get(today).v;
    let rangeTotal = 0;
    let byCategory = [];
    if (from && to) {
      rangeTotal = db.prepare(`SELECT COALESCE(SUM(amount),0) v FROM expenses WHERE date(date) BETWEEN date(?) AND date(?)`).get(from, to).v;
      byCategory = db.prepare(`
        SELECT category, COALESCE(SUM(amount),0) total
        FROM expenses WHERE date(date) BETWEEN date(?) AND date(?)
        GROUP BY category ORDER BY total DESC
      `).all(from, to);
    }
    return { todayTotal, rangeTotal, byCategory };
  });

  // ---------- P&L ----------
  ipcMain.handle('pnl:report', (e, { from, to }) => {
    const revenue = db.prepare(`SELECT COALESCE(SUM(total_amount),0) v FROM sales WHERE date(date) BETWEEN date(?) AND date(?)`).get(from, to).v;
    const cost = db.prepare(`
      SELECT COALESCE(SUM(si.qty * i.cost_price),0) v
      FROM sale_items si JOIN sales s ON s.id = si.sale_id JOIN items i ON i.id = si.item_id
      WHERE date(s.date) BETWEEN date(?) AND date(?)
    `).get(from, to).v;
    const byCategory = db.prepare(`
      SELECT i.category, COALESCE(SUM(si.qty * si.unit_price),0) revenue, COALESCE(SUM(si.qty * i.cost_price),0) cost
      FROM sale_items si JOIN sales s ON s.id = si.sale_id JOIN items i ON i.id = si.item_id
      WHERE date(s.date) BETWEEN date(?) AND date(?)
      GROUP BY i.category
    `).all(from, to);
    const monthlyTrend = db.prepare(`
      SELECT strftime('%Y-%m', date) ym, COALESCE(SUM(total_amount),0) revenue
      FROM sales WHERE date(date) BETWEEN date(?) AND date(?)
      GROUP BY ym ORDER BY ym
    `).all(from, to);
    return { revenue, cost, grossProfit: revenue - cost, byCategory, monthlyTrend };
  });

  // ---------- CUSTOMER CRM ----------
  ipcMain.handle('customers:list', (e, filters = {}) => {
    let q = 'SELECT * FROM customers WHERE 1=1';
    const params = [];
    if (filters.search) {
      q += ' AND (name LIKE ? OR phone LIKE ?)';
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }
    if (filters.amc_status) { q += ' AND amc_status = ?'; params.push(filters.amc_status); }
    q += ' ORDER BY name';
    return db.prepare(q).all(...params);
  });
  ipcMain.handle('customers:get', (e, id) => db.prepare('SELECT * FROM customers WHERE id = ?').get(id));
  ipcMain.handle('customers:add', (e, c) => {
    const info = db.prepare(`INSERT INTO customers (name, phone, address, alt_contact, amc_status, amc_renewal_date, notes)
      VALUES (?,?,?,?,?,?,?)`).run(c.name, c.phone || '', c.address || '', c.alt_contact || '',
      c.amc_status || 'none', c.amc_renewal_date || null, c.notes || '');
    return { id: info.lastInsertRowid };
  });
  ipcMain.handle('customers:update', (e, c) => {
    db.prepare(`UPDATE customers SET name=?, phone=?, address=?, alt_contact=?, amc_status=?, amc_renewal_date=?, notes=? WHERE id=?`)
      .run(c.name, c.phone, c.address, c.alt_contact, c.amc_status, c.amc_renewal_date, c.notes, c.id);
    return { ok: true };
  });
  ipcMain.handle('customers:delete', (e, id) => {
    // Keep past sales/payments/service history (financial + service records) but detach from the deleted customer
    const tx = db.transaction(() => {
      db.prepare('UPDATE sales SET customer_id = NULL WHERE customer_id = ?').run(id);
      db.prepare('UPDATE customer_payments SET customer_id = NULL WHERE customer_id = ?').run(id);
      db.prepare('UPDATE installations SET customer_id = NULL WHERE customer_id = ?').run(id);
      db.prepare('UPDATE service_requests SET customer_id = NULL WHERE customer_id = ?').run(id);
      db.prepare('DELETE FROM customers WHERE id = ?').run(id);
    });
    tx();
    return { ok: true };
  });
  ipcMain.handle('customers:history', (e, customerId) => {
    const purchases = db.prepare('SELECT * FROM sales WHERE customer_id = ? ORDER BY date DESC').all(customerId);
    const services = db.prepare('SELECT * FROM service_requests WHERE customer_id = ? ORDER BY created_at DESC').all(customerId);
    return { purchases, services };
  });
  ipcMain.handle('customers:amcDue', () => {
    return db.prepare(`
      SELECT * FROM customers
      WHERE amc_status = 'active' AND date(amc_renewal_date) <= date('now', '+30 days')
      ORDER BY amc_renewal_date ASC
    `).all();
  });

  // ---------- CUSTOMER DUES (Credit Ledger) ----------
  ipcMain.handle('dues:summary', () => {
    // one row per customer with an outstanding balance across all their sales
    return db.prepare(`
      SELECT c.id as customer_id, c.name, c.phone,
        SUM(s.total_amount) as total_billed,
        SUM(s.amount_paid) as total_paid,
        SUM(s.total_amount - s.amount_paid) as balance_due
      FROM sales s JOIN customers c ON c.id = s.customer_id
      GROUP BY c.id
      HAVING balance_due > 0.01
      ORDER BY balance_due DESC
    `).all();
  });
  ipcMain.handle('dues:forCustomer', (e, customerId) => {
    const sales = db.prepare(`
      SELECT id, invoice_no, date, total_amount, amount_paid, (total_amount - amount_paid) as balance_due
      FROM sales WHERE customer_id = ? AND (total_amount - amount_paid) > 0.01
      ORDER BY date DESC
    `).all(customerId);
    const payments = db.prepare(`
      SELECT * FROM customer_payments WHERE customer_id = ? ORDER BY date DESC
    `).all(customerId);
    const totalDue = sales.reduce((s, r) => s + r.balance_due, 0);
    return { sales, payments, totalDue };
  });
  ipcMain.handle('dues:recordPayment', (e, { customer_id, sale_id, amount, note }) => {
    const tx = db.transaction(() => {
      db.prepare('INSERT INTO customer_payments (customer_id, sale_id, amount, note) VALUES (?,?,?,?)')
        .run(customer_id, sale_id || null, amount, note || '');
      if (sale_id) {
        db.prepare('UPDATE sales SET amount_paid = amount_paid + ? WHERE id = ?').run(amount, sale_id);
      } else {
        // no specific invoice picked — apply against oldest outstanding sale(s) for this customer, oldest first
        let remaining = amount;
        const openSales = db.prepare(`
          SELECT id, (total_amount - amount_paid) as balance_due FROM sales
          WHERE customer_id = ? AND (total_amount - amount_paid) > 0.01
          ORDER BY date ASC
        `).all(customer_id);
        const applyStmt = db.prepare('UPDATE sales SET amount_paid = amount_paid + ? WHERE id = ?');
        for (const s of openSales) {
          if (remaining <= 0) break;
          const applyAmt = Math.min(remaining, s.balance_due);
          applyStmt.run(applyAmt, s.id);
          remaining -= applyAmt;
        }
      }
    });
    tx();
    return { ok: true };
  });

  // ---------- INSTALLATIONS / SERVICE DUE TRACKING ----------
  ipcMain.handle('installations:create', (e, { customer_id, sale_id, item_label, install_date, service_interval_days }) => {
    const next = new Date(install_date);
    next.setDate(next.getDate() + Number(service_interval_days));
    const nextServiceDate = next.toISOString().slice(0, 10);
    const info = db.prepare(`INSERT INTO installations (customer_id, sale_id, item_label, install_date, service_interval_days, next_service_date)
      VALUES (?,?,?,?,?,?)`).run(customer_id, sale_id || null, item_label, install_date, service_interval_days, nextServiceDate);
    return { id: info.lastInsertRowid, next_service_date: nextServiceDate };
  });
  ipcMain.handle('installations:upcoming', (e, { withinDays = 3 } = {}) => {
    return db.prepare(`
      SELECT i.*, c.name as customer_name, c.phone as customer_phone
      FROM installations i JOIN customers c ON c.id = i.customer_id
      WHERE date(i.next_service_date) <= date('now', '+' || ? || ' days')
      ORDER BY i.next_service_date ASC
    `).all(withinDays);
  });
  ipcMain.handle('installations:forCustomer', (e, customerId) => {
    return db.prepare('SELECT * FROM installations WHERE customer_id = ? ORDER BY next_service_date ASC').all(customerId);
  });
  ipcMain.handle('installations:markReminderSent', (e, id) => {
    db.prepare(`UPDATE installations SET last_reminder_sent_date = date('now') WHERE id = ?`).run(id);
    return { ok: true };
  });
  ipcMain.handle('installations:markServiced', (e, { id, newIntervalDays }) => {
    const row = db.prepare('SELECT * FROM installations WHERE id = ?').get(id);
    if (!row) return { ok: false };
    const interval = newIntervalDays || row.service_interval_days;
    const today = new Date();
    const next = new Date(today);
    next.setDate(next.getDate() + Number(interval));
    db.prepare(`UPDATE installations SET install_date = date('now'), service_interval_days = ?, next_service_date = ?, last_reminder_sent_date = NULL WHERE id = ?`)
      .run(interval, next.toISOString().slice(0, 10), id);
    return { ok: true };
  });

  // ---------- WHATSAPP (deep-link, manual attach — no official API) ----------
  ipcMain.handle('whatsapp:openChat', (e, { phone, message }) => {
    const digits = String(phone || '').replace(/\D/g, '');
    const withCountryCode = digits.length === 10 ? `91${digits}` : digits; // assume India if 10-digit local number
    const url = `https://wa.me/${withCountryCode}?text=${encodeURIComponent(message || '')}`;
    shell.openExternal(url);
    return { ok: true };
  });
  ipcMain.handle('invoices:revealFolder', () => {
    const outDir = path.join(app.getPath('documents'), 'Healthy Appliances Invoices');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    shell.openPath(outDir);
    return { ok: true };
  });

  // ---------- EXCEL / CSV IMPORT ----------
  ipcMain.handle('import:items', async () => {
    const XLSX = require('xlsx');
    const { filePaths } = await dialog.showOpenDialog({
      title: 'Import Stock Items',
      filters: [{ name: 'Spreadsheet', extensions: ['xlsx', 'xls', 'csv'] }],
      properties: ['openFile']
    });
    if (!filePaths || filePaths.length === 0) return { ok: false, cancelled: true };

    const wb = XLSX.readFile(filePaths[0]);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    const insert = db.prepare(`INSERT INTO items (name, sku, category, cost_price, sell_price, reorder_level, qty_on_hand)
      VALUES (?,?,?,?,?,?,?)`);
    let imported = 0;
    const errors = [];
    const tx = db.transaction(() => {
      rows.forEach((row, idx) => {
        const name = String(row.name || row.Name || row.item_name || row['Item Name'] || '').trim();
        if (!name) { errors.push(`Row ${idx + 2}: missing item name, skipped`); return; }
        insert.run(
          name,
          String(row.sku || row.SKU || row.model || '').trim(),
          String(row.category || row.Category || '').trim(),
          Number(row.cost_price || row['Cost Price'] || 0),
          Number(row.sell_price || row['Sell Price'] || row['Selling Price'] || 0),
          Number(row.reorder_level || row['Reorder Level'] || 5),
          Number(row.qty_on_hand || row.qty || row.Quantity || row['Opening Qty'] || 0)
        );
        imported++;
      });
    });
    tx();
    return { ok: true, imported, total: rows.length, errors };
  });

  ipcMain.handle('import:customers', async () => {
    const XLSX = require('xlsx');
    const { filePaths } = await dialog.showOpenDialog({
      title: 'Import Customers',
      filters: [{ name: 'Spreadsheet', extensions: ['xlsx', 'xls', 'csv'] }],
      properties: ['openFile']
    });
    if (!filePaths || filePaths.length === 0) return { ok: false, cancelled: true };

    const wb = XLSX.readFile(filePaths[0]);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    const insert = db.prepare(`INSERT INTO customers (name, phone, address, alt_contact, amc_status, amc_renewal_date, notes)
      VALUES (?,?,?,?,?,?,?)`);
    let imported = 0;
    const errors = [];
    const tx = db.transaction(() => {
      rows.forEach((row, idx) => {
        const name = String(row.name || row.Name || row.customer_name || row['Customer Name'] || '').trim();
        if (!name) { errors.push(`Row ${idx + 2}: missing customer name, skipped`); return; }
        insert.run(
          name,
          String(row.phone || row.Phone || row.mobile || row.Mobile || '').trim(),
          String(row.address || row.Address || '').trim(),
          String(row.alt_contact || row['Alternate Contact'] || '').trim(),
          'none',
          null,
          String(row.notes || row.Notes || '').trim()
        );
        imported++;
      });
    });
    tx();
    return { ok: true, imported, total: rows.length, errors };
  });

  // ---------- CUSTOMER SERVICE ----------
  ipcMain.handle('service:list', (e, filters = {}) => {
    let q = `SELECT sr.*, c.name as customer_name, c.phone as customer_phone
      FROM service_requests sr LEFT JOIN customers c ON c.id = sr.customer_id WHERE 1=1`;
    const params = [];
    if (filters.status) { q += ' AND sr.status = ?'; params.push(filters.status); }
    q += ' ORDER BY sr.created_at DESC';
    return db.prepare(q).all(...params);
  });
  ipcMain.handle('service:create', (e, s) => {
    const info = db.prepare(`INSERT INTO service_requests (customer_id, technician, status, issue, scheduled_date)
      VALUES (?,?,?,?,?)`).run(s.customer_id, s.technician || '', s.status || 'Pending', s.issue || '', s.scheduled_date || null);
    return { id: info.lastInsertRowid };
  });
  ipcMain.handle('service:updateStatus', (e, { id, status, resolution_notes }) => {
    db.prepare('UPDATE service_requests SET status=?, resolution_notes=? WHERE id=?').run(status, resolution_notes || '', id);
    return { ok: true };
  });

  // ---------- SETTINGS ----------
  ipcMain.handle('settings:get', () => {
    const rows = db.prepare('SELECT * FROM settings').all();
    return Object.fromEntries(rows.map(r => [r.key, r.value]));
  });
  ipcMain.handle('settings:set', (e, obj) => {
    const stmt = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
    const tx = db.transaction(() => { for (const [k, v] of Object.entries(obj)) stmt.run(k, v); });
    tx();
    return { ok: true };
  });
  ipcMain.handle('users:list', () => db.prepare('SELECT id, name, role, username FROM users').all());
  ipcMain.handle('users:add', (e, u) => {
    const hash = bcrypt.hashSync(u.password || 'changeme', 10);
    const info = db.prepare('INSERT INTO users (name, role, username, password_hash) VALUES (?,?,?,?)')
      .run(u.name, u.role, u.username, hash);
    return { id: info.lastInsertRowid };
  });
  // ---------- INVOICE PDF ----------
  ipcMain.handle('sell:generateInvoicePdf', async (e, saleId) => {
    const PDFDocument = require('pdfkit');
    const sale = db.prepare(`SELECT s.*, c.name as customer_name, c.phone as customer_phone, c.address as customer_address
      FROM sales s LEFT JOIN customers c ON c.id = s.customer_id WHERE s.id = ?`).get(saleId);
    if (!sale) return { ok: false, error: 'Sale not found' };
    const items = db.prepare(`SELECT si.*, i.name as item_name FROM sale_items si
      JOIN items i ON i.id = si.item_id WHERE si.sale_id = ?`).all(saleId);
    const settings = Object.fromEntries(db.prepare('SELECT * FROM settings').all().map(r => [r.key, r.value]));

    // previous dues from OTHER invoices (not this one), so the bill shows the full picture
    let previousDue = 0;
    let previousDueCount = 0;
    if (sale.customer_id) {
      const prev = db.prepare(`
        SELECT COALESCE(SUM(total_amount - amount_paid), 0) as due, COUNT(*) as cnt
        FROM sales WHERE customer_id = ? AND id != ? AND (total_amount - amount_paid) > 0.01
      `).get(sale.customer_id, saleId);
      previousDue = prev.due;
      previousDueCount = prev.cnt;
    }

    const outDir = path.join(app.getPath('documents'), 'Healthy Appliances Invoices');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const filePath = path.join(outDir, `${sale.invoice_no}.pdf`);

    await new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      doc.fontSize(20).fillColor('#0f2b2a').text(settings.business_name || 'Healthy Appliances', { continued: false });
      doc.fontSize(10).fillColor('#526260').text(settings.business_tagline || '');
      if (settings.address) doc.text(settings.address);
      if (settings.phone) doc.text(`Phone: ${settings.phone}`);
      doc.moveDown();
      doc.fontSize(14).fillColor('#b5622f').text(`INVOICE  ${sale.invoice_no}`);
      doc.fontSize(10).fillColor('#17201f').text(`Date: ${sale.date}`);
      doc.moveDown(0.5);
      doc.text(`Bill To: ${sale.customer_name || 'Walk-in Customer'}`);
      if (sale.customer_phone) doc.text(`Phone: ${sale.customer_phone}`);
      if (sale.customer_address) doc.text(`Address: ${sale.customer_address}`);
      doc.moveDown();

      const tableTop = doc.y;
      doc.fontSize(10).fillColor('#526260');
      doc.text('Item', 50, tableTop);
      doc.text('Qty', 320, tableTop);
      doc.text('Unit Price', 380, tableTop);
      doc.text('Amount', 470, tableTop);
      doc.moveTo(50, tableTop + 15).lineTo(545, tableTop + 15).strokeColor('#e4ded2').stroke();

      let y = tableTop + 25;
      doc.fillColor('#17201f');
      items.forEach(it => {
        const amount = it.qty * it.unit_price;
        doc.text(it.item_name, 50, y);
        doc.text(String(it.qty), 320, y);
        doc.text(`Rs. ${it.unit_price}`, 380, y);
        doc.text(`Rs. ${amount}`, 470, y);
        y += 20;
      });

      doc.moveTo(50, y + 5).lineTo(545, y + 5).strokeColor('#e4ded2').stroke();
      y += 15;
      if (sale.discount > 0) {
        doc.text(`Discount: Rs. ${sale.discount}`, 380, y);
        y += 18;
      }
      doc.fontSize(12).fillColor('#0f2b2a').text(`Total: Rs. ${sale.total_amount}`, 380, y);
      doc.fontSize(10).fillColor('#526260').text(`Payment mode: ${sale.payment_mode}`, 50, y);
      y += 30;

      doc.moveTo(50, y).lineTo(545, y).strokeColor('#e4ded2').stroke();
      y += 12;
      doc.fontSize(11).fillColor('#0f2b2a').text('Account Status', 50, y);
      y += 16;
      if (previousDue > 0.01) {
        doc.fontSize(10).fillColor('#b3432f').text(
          `Previous Due (from ${previousDueCount} earlier invoice${previousDueCount > 1 ? 's' : ''}): Rs. ${previousDue.toFixed(2)}`,
          50, y
        );
        y += 15;
        const grandTotal = sale.total_amount + previousDue;
        doc.fontSize(11).fillColor('#0f2b2a').text(`Total Payable (including previous due): Rs. ${grandTotal.toFixed(2)}`, 50, y);
      } else if (sale.customer_id) {
        doc.fontSize(10).fillColor('#3a7a5d').text('No Due — no previous outstanding balance on this account.', 50, y);
      } else {
        doc.fontSize(10).fillColor('#526260').text('Walk-in sale — no account on file.', 50, y);
      }
      y += 20;

      doc.moveDown(1);
      doc.fontSize(9).fillColor('#526260').text('Thank you for your business!', 50, y, { align: 'center', width: 495 });

      doc.end();
      stream.on('finish', resolve);
      stream.on('error', reject);
    });

    shell.openPath(filePath);
    return { ok: true, filePath, previousDue, invoiceNo: sale.invoice_no, totalAmount: sale.total_amount };
  });

  // ---------- DB BACKUP / RESTORE ----------
  ipcMain.handle('db:export', async () => {
    const dbPath = path.join(app.getPath('userData'), 'ro-erp.db');
    const { filePath } = await dialog.showSaveDialog({
      title: 'Export Database Backup',
      defaultPath: `ro-erp-backup-${new Date().toISOString().slice(0, 10)}.db`,
      filters: [{ name: 'SQLite Database', extensions: ['db'] }]
    });
    if (!filePath) return { ok: false, cancelled: true };
    fs.copyFileSync(dbPath, filePath);
    return { ok: true, filePath };
  });

  ipcMain.handle('db:import', async () => {
    const { filePaths } = await dialog.showOpenDialog({
      title: 'Restore Database Backup',
      filters: [{ name: 'SQLite Database', extensions: ['db'] }],
      properties: ['openFile']
    });
    if (!filePaths || filePaths.length === 0) return { ok: false, cancelled: true };
    const dbPath = path.join(app.getPath('userData'), 'ro-erp.db');
    fs.copyFileSync(filePaths[0], dbPath);
    return { ok: true, needsRestart: true };
  });
}

module.exports = { registerHandlers };
