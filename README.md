# Healthy Appliances ERP

A desktop management system built for a real RO water purifier shop — handling purchases, sales, stock, profit tracking, customer relationships, and after-sales service in one offline-first application.

Built solo, end to end, and actively used by the business it was built for.

> **Tech stack note:** This is an **Electron + React + SQLite** desktop application — not a MERN stack project (no MongoDB, no Express/REST API). It uses Electron's IPC layer instead of HTTP for the frontend↔backend bridge, and a local SQLite database instead of a networked one. See [Architecture](#architecture) below.

---

## Screenshots

*(Add a few screenshots here — Dashboard, Sell screen, and an invoice PDF work well)*

---

## Features

**Core modules**
- 📊 **Dashboard** — daily sales/purchases, low-stock alerts, upcoming service reminders, AMC renewals
- 📥 **Purchase** — vendor stock entry with automatic inventory updates and a vendor ledger
- 🧾 **Sell** — point-of-sale billing with auto-generated PDF invoices and automatic stock deduction
- 📦 **Stock** — inventory management with manual adjustments and Excel/CSV bulk import
- 📈 **P&L** — profit & loss reporting with date-range filters and charts
- 👤 **Customer CRM** — full customer profiles, purchase/service history, and a credit ledger for tracking dues

**Auth & access control**
- Password authentication with bcrypt hashing
- Persistent login sessions
- Role-based UI restrictions (Owner / Staff / Technician see different things)

**Business logic**
- Customer credit ledger — tracks who owes what, supports partial payments, auto-applies payments to the oldest invoice
- Every invoice shows account status (previous due / no due) automatically
- Service due-date tracking with configurable reminder windows
- One-click WhatsApp send for invoices and service reminders (via `wa.me` deep links — no paid API required)
- Local database backup/restore

## Architecture

```
┌─────────────────────────┐
│   React UI (renderer)   │   src/
└───────────┬─────────────┘
            │ IPC (contextBridge)
┌───────────▼─────────────┐
│  Electron main process  │   electron/
│  (business logic)       │
└───────────┬─────────────┘
            │
┌───────────▼─────────────┐
│   SQLite (better-sqlite3)│   local .db file
└──────────────────────────┘
```

No server, no network calls except for the optional WhatsApp link and PDF/Excel handling — the app runs fully offline.

## Tech Stack

| Layer | Choice |
|---|---|
| UI | React 18 + Vite |
| Desktop shell | Electron |
| Database | SQLite (`better-sqlite3`) |
| Auth | `bcryptjs` |
| PDF generation | `pdfkit` |
| Excel/CSV import | `xlsx` (SheetJS) |
| Charts | Recharts |

## Getting Started

```bash
git clone https://github.com/<your-username>/healthy-appliances-erp.git
cd healthy-appliances-erp
npm install
npm run dev
```

Default login on first run: `admin` / `changeme` (change immediately via Settings).

### Building a distributable

```bash
npm run electron:build
```

## Project Structure

```
ro-erp/
├── electron/
│   ├── main.js        — window lifecycle
│   ├── preload.js      — IPC bridge exposed to the renderer
│   ├── db.js             — SQLite schema + migrations
│   └── handlers.js     — all business logic, one section per module
├── src/
│   ├── App.jsx           — shell: header + sidebar + page routing
│   ├── permissions.js   — role → page access map
│   ├── components/      — shared UI (Header, Sidebar, Modal)
│   ├── pages/              — one file per module
│   └── styles/global.css
└── dev-scripts/            — developer-only maintenance scripts (not shipped in builds)
```

## Known Limitations

Being upfront about what this doesn't do, rather than overselling it:

- No cloud sync — each installation has its own local database
- WhatsApp sending requires two clicks (open chat, attach PDF) — there's no free way to fully automate this without a paid WhatsApp Business API
- No multi-branch support — built for a single shop location
- No mobile app

## Author

Built by **Niloy Goswami** — [GitHub](https://github.com/Niloy2004) · [LinkedIn](https://linkedin.com/in/niloy-goswami)
