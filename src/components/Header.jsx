import React, { useState, useEffect, useRef } from 'react';

export default function Header({ businessName, alertCount, onNavigate }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    if (q.trim().length < 2) { setResults(null); return; }
    const timer = setTimeout(() => {
      window.api.search.global(q.trim()).then(r => { setResults(r); setShowResults(true); });
    }, 200);
    return () => clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setShowResults(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const goTo = (page) => {
    setShowResults(false);
    setQ('');
    onNavigate && onNavigate(page);
  };

  const hasResults = results && (results.customers.length || results.sales.length || results.items.length);
  const hasQuery = q.trim().length >= 2;

  return (
    <header className="app-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 18, letterSpacing: '0.01em' }}>
          {businessName || 'Healthy Appliances'}
        </div>
        <div ref={boxRef} style={{ position: 'relative' }}>
          <input
            placeholder="Search customers, invoices, items…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => q.trim().length >= 2 && setShowResults(true)}
            style={{ width: 320, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)', color: '#fff' }}
          />
          {showResults && hasQuery && (
            <div style={{
              position: 'absolute', top: '110%', left: 0, width: 380, maxHeight: 420, overflowY: 'auto',
              background: '#fff', borderRadius: 10, boxShadow: '0 12px 32px rgba(0,0,0,0.25)', zIndex: 100, padding: 8
            }}>
              {!hasResults && (
                <div className="page-sub" style={{ padding: 10 }}>No matches for "{q}"</div>
              )}
              {results?.customers.length > 0 && (
                <div style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-600)', textTransform: 'uppercase', padding: '4px 8px' }}>Customers</div>
                  {results.customers.map(c => (
                    <div key={c.id} onClick={() => goTo('crm')} style={{ padding: '8px 10px', borderRadius: 6, cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--cream-100)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <div style={{ fontSize: 14, color: 'var(--ink-900)' }}>{c.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink-600)' }}>{c.phone}</div>
                    </div>
                  ))}
                </div>
              )}
              {results?.sales.length > 0 && (
                <div style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-600)', textTransform: 'uppercase', padding: '4px 8px' }}>Invoices</div>
                  {results.sales.map(s => (
                    <div key={s.id} onClick={() => goTo('sell')} style={{ padding: '8px 10px', borderRadius: 6, cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--cream-100)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <div style={{ fontSize: 14, color: 'var(--ink-900)' }} className="mono">{s.invoice_no}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink-600)' }}>{s.customer_name || 'Walk-in'} · ₹{s.total_amount}</div>
                    </div>
                  ))}
                </div>
              )}
              {results?.items.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-600)', textTransform: 'uppercase', padding: '4px 8px' }}>Stock Items</div>
                  {results.items.map(i => (
                    <div key={i.id} onClick={() => goTo('stock')} style={{ padding: '8px 10px', borderRadius: 6, cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--cream-100)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <div style={{ fontSize: 14, color: 'var(--ink-900)' }}>{i.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink-600)' }}>{i.sku || 'No SKU'} · Stock: {i.qty_on_hand}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <div style={{ position: 'relative' }}>
          <button
            className="btn-ghost"
            style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 18, position: 'relative' }}
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
