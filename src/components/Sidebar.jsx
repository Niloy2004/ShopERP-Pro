import React from 'react';
import { pagesForRole } from '../permissions.js';

const NAV = [
  { key: 'dashboard', label: 'Dashboard', icon: '⌂' },
  { key: 'purchase', label: 'Purchase', icon: '↓' },
  { key: 'sell', label: 'Sell', icon: '🧾' },
  { key: 'stock', label: 'Stock', icon: '▤' },
  { key: 'pnl', label: 'P&L', icon: '📈' },
  { key: 'crm', label: 'Customer CRM', icon: '☺' },
  { key: 'settings', label: 'Settings', icon: '⚙' }
];

export default function Sidebar({ current, onNavigate, onLogout, role }) {
  const allowed = pagesForRole(role);
  const visibleNav = NAV.filter(item => allowed.includes(item.key));

  return (
    <nav className="app-sidebar">
      {visibleNav.map(item => (
        <button
          key={item.key}
          className={`nav-item ${current === item.key ? 'active' : ''}`}
          onClick={() => onNavigate(item.key)}
        >
          <span style={{ width: 18, textAlign: 'center' }}>{item.icon}</span>
          {item.label}
        </button>
      ))}
      <div style={{ height: 1, background: 'rgba(255,255,255,0.12)', margin: '10px 4px' }} />
      <button className="nav-item" onClick={onLogout}>
        <span style={{ width: 18, textAlign: 'center' }}>⏻</span>
        Logout
      </button>
    </nav>
  );
}
