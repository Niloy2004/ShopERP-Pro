# Healthy Appliances ERP

A desktop management app for a small RO water purifier shop. It covers purchases, sales and invoicing, stock, profit tracking, customer dues, service reminders and daily shop expenses, and it works fully offline.

> **Tech stack:** Electron + React + SQLite. This is a desktop app, not a MERN project: there is no MongoDB and no Express/REST API. The React UI talks to the Electron main process over IPC, and data lives in a local SQLite file.

## Screenshots

*(Add screenshots here: Dashboard, Sell screen, P&L page, an invoice PDF)*

## Features

**Daily work**
- **Dashboard**: today's sales, purchases and expenses, low-stock alerts, upcoming service reminders, AMC renewals
- **Purchase**: record stock bought from vendors; stock updates automatically; add a brand-new item right inside the purchase form; vendor ledger (total purchased, paid, balance due)
- **Sell**: billing with searchable item picker, auto-numbered invoices, PDF invoice (multi-page safe), credit/partial payment, add a new customer while billing
- **Stock**: items sold by Piece, Feet, Meter, Kg, Litre and more; manual adjustments; Excel/CSV import; duplicate-item warning
- **Customer CRM**: profiles, purchase history, and a dues ledger that tracks who owes what and applies payments to the oldest invoice
- **Shop Expenses**: rent, electricity, salary and other running costs, with date and category filters

**Money**
- **P&L**: revenue, cost of goods, gross profit, margin, **shop expenses and net profit** for any date range, with charts and CSV export
- **Cost price** is a weighted average of everything bought, recalculated from purchase history every time the app starts
- Every invoice shows the customer's previous due (or "No Due")

**Housekeeping**
- Edit and delete on every record (stock is reversed/restored correctly on sales and purchases)
- Global search across customers, invoices and items
- Login with bcrypt-hashed passwords, persistent session, role-based access (Owner / Staff / Technician)
- Service due dates set at sale time, with reminders on the Dashboard
- WhatsApp click-to-send for invoices and reminders (opens the chat via `wa.me`; no paid API)
- Local database backup and restore

## Architecture

```
React UI (renderer)           src/
        |  IPC (contextBridge)
Electron main process         electron/   (all business logic)
        |
SQLite via better-sqlite3     local .db file
```

## Tech stack

| Layer | Choice |
|---|---|
| UI | React 18 + Vite |
| Desktop shell | Electron |
| Database | SQLite (`better-sqlite3`) |
| Auth | `bcryptjs` |
| PDF invoices | `pdfkit` |
| Excel/CSV import | `xlsx` |
| Charts | Recharts |

## Getting started

```bash
git clone https://github.com/Niloy2004/healthy-appliances-erp.git
cd healthy-appliances-erp
npm install
npm run dev
```

First login: `admin` / `changeme`. Change the password in Settings straight away.

`better-sqlite3` is a native module. If `npm install` fails on Windows, use a Node LTS version (22.x) and make sure the C++ build tools are available.

### Build a Windows installer

```bash
npm run electron:build
```

The installer is written to `dist/`.

## Project structure

```
electron/
  main.js        window lifecycle
  preload.js     IPC bridge exposed to the UI
  db.js          SQLite schema and migrations
  handlers.js    business logic, one section per module
src/
  App.jsx        shell: header, sidebar, page routing
  permissions.js role to page access map
  components/    Header, Sidebar, Modal, ItemPicker
  pages/         one file per module
```

## Known limitations

- Each installation has its own local database; there is no cloud sync
- WhatsApp sending takes two clicks (open chat, attach the PDF); fully automatic sending needs the paid WhatsApp Business API
- Role restrictions are enforced in the UI only, which suits a single-shop machine but is not a network security boundary
- Single shop location, desktop only

## Author

Niloy Goswami · [GitHub](https://github.com/Niloy2004) · [LinkedIn](https://linkedin.com/in/niloy-goswami)
