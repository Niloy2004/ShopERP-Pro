import React, { useState } from 'react';

export default function Header({ businessName, alertCount, onSearch }) {
  const [q, setQ] = useState('');
  const [showAlerts, setShowAlerts] = useState(false);

  return (
    <header className="app-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 18, letterSpacing: '0.01em' }}>
          {businessName || 'Healthy Appliances'}
        </div>
        <input
          placeholder="Search customers, invoices, items…"
          value={q}
          onChange={(e) => { setQ(e.target.value); onSearch && onSearch(e.target.value); }}
          style={{ width: 320, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)', color: '#fff' }}
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <div style={{ position: 'relative' }}>
          <button
            className="btn-ghost"
            style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 18, position: 'relative' }}
            onClick={() => setShowAlerts(!showAlerts)}
          >
            🔔
            {alertCount > 0 && (
              <span style={{
                position: 'absolute', top: -4, right: -6, background: 'var(--copper-500)',
                borderRadius: 999, fontSize: 10, padding: '1px 5px', fontWeight: 700
              }}>{alertCount}</span>
            )}
          </button>
        </div>
        <div style={{
          width: 32, height: 32, borderRadius: '50%', background: 'var(--copper-500)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13
        }}>NG</div>
      </div>
    </header>
  );
}
