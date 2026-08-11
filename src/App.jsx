import React, { useEffect, useState } from 'react';
import Header from './components/Header.jsx';
import Sidebar from './components/Sidebar.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Purchase from './pages/Purchase.jsx';
import Sell from './pages/Sell.jsx';
import Stock from './pages/Stock.jsx';
import PnL from './pages/PnL.jsx';
import CustomerCRM from './pages/CustomerCRM.jsx';
import Expenses from './pages/Expenses.jsx';
import Settings from './pages/Settings.jsx';
import { pagesForRole } from './permissions.js';

const PAGES = {
  dashboard: Dashboard,
  purchase: Purchase,
  sell: Sell,
  stock: Stock,
  pnl: PnL,
  crm: CustomerCRM,
  expenses: Expenses,
  settings: Settings
};

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [businessName, setBusinessName] = useState('Healthy Appliances');
  const [alertCount, setAlertCount] = useState(0);
  const [user, setUser] = useState(null);
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    if (!window.api) { setSessionChecked(true); return; }
    window.api.session.get().then(result => {
      if (result.ok) setUser(result.user);
      setSessionChecked(true);
    });
  }, []);

  useEffect(() => {
    if (!window.api || !user) return;
    window.api.settings.get().then(s => setBusinessName(s.business_name || 'Healthy Appliances'));
    const refreshAlerts = () => window.api.dashboard.summary().then(d => {
      setAlertCount((d.stockAlerts?.length || 0) + (d.amcDue?.length || 0) + (d.upcomingServices?.length || 0));
    });
    refreshAlerts();
    const id = setInterval(refreshAlerts, 20000);
    return () => clearInterval(id);
  }, [user]);

  if (!window.api) {
    return (
      <div style={{ padding: 40, fontFamily: 'sans-serif' }}>
        <h2>window.api not found</h2>
        <p>This UI expects to run inside the Electron shell (preload bridge). Run <code>npm run dev</code>.</p>
      </div>
    );
  }

  if (!sessionChecked) {
    return <div style={{ height: '100vh', background: 'var(--teal-950)' }} />;
  }

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  const Page = PAGES[page];
  const allowedPages = pagesForRole(user.role);
  const canViewCurrentPage = allowedPages.includes(page);

  const handleLogout = async () => {
    await window.api.session.clear();
    setUser(null);
  };

  const safeNavigate = (key) => {
    if (allowedPages.includes(key)) setPage(key);
  };

  return (
    <div className="app-shell">
      <Header businessName={businessName} alertCount={alertCount} onNavigate={safeNavigate} />
      <Sidebar current={page} onNavigate={safeNavigate} onLogout={handleLogout} role={user.role} />
      <main className="app-main">
        {canViewCurrentPage ? (
          <Page onNavigate={safeNavigate} currentUser={user} />
        ) : (
          <div className="card">
            <h3 style={{ marginBottom: 8 }}>Access restricted</h3>
            <div className="page-sub">Your role ({user.role}) doesn't have access to this section.</div>
          </div>
        )}
      </main>
    </div>
  );
}
