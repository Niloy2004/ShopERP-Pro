import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

function firstOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function today() { return new Date().toISOString().slice(0, 10); }

const PRESETS = {
  'This month': () => [firstOfMonth(), today()],
  'Last month': () => {
    const d = new Date();
    const start = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    const end = new Date(d.getFullYear(), d.getMonth(), 0);
    return [start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)];
  },
  'This year': () => [new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10), today()]
};

export default function PnL() {
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());
  const [report, setReport] = useState(null);

  const load = () => window.api.pnl.report({ from, to }).then(setReport);
  useEffect(() => { load(); }, [from, to]);

  const applyPreset = (name) => {
    const [f, t] = PRESETS[name]();
    setFrom(f); setTo(t);
  };

  const exportCsv = () => {
    if (!report) return;
    let csv = 'Category,Revenue,Cost,Profit\n';
    report.byCategory.forEach(c => {
      csv += `${c.category || 'Uncategorized'},${c.revenue},${c.cost},${c.revenue - c.cost}\n`;
    });
    csv += `\nTotal,${report.revenue},${report.cost},${report.grossProfit}\n`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `pnl_${from}_to_${to}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Profit & Loss</h1>
          <div className="page-sub">Automated reporting — no spreadsheet work</div>
        </div>
        <button className="btn btn-secondary" onClick={exportCsv}>Export CSV</button>
      </div>

      <div className="card" style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'flex-end' }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>From</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>To</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {Object.keys(PRESETS).map(p => (
            <button key={p} className="btn btn-ghost" onClick={() => applyPreset(p)}>{p}</button>
          ))}
        </div>
      </div>

      {report && (
        <>
          <div className="grid-4" style={{ marginBottom: 20 }}>
            <div className="stat-card">
              <div className="stat-label">Total Revenue</div>
              <div className="stat-value">₹{report.revenue.toLocaleString('en-IN')}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Cost of Goods</div>
              <div className="stat-value">₹{report.cost.toLocaleString('en-IN')}</div>
            </div>
            <div className="stat-card" style={{ borderLeftColor: 'var(--ok)' }}>
              <div className="stat-label">Gross Profit</div>
              <div className="stat-value" style={{ color: 'var(--ok)' }}>₹{report.grossProfit.toLocaleString('en-IN')}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Margin</div>
              <div className="stat-value">{report.revenue ? Math.round((report.grossProfit / report.revenue) * 100) : 0}%</div>
            </div>
          </div>

          <div className="grid-2">
            <div className="card">
              <h3 style={{ marginBottom: 12, fontSize: 16 }}>Monthly Trend</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={report.monthlyTrend}>
                  <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
                  <XAxis dataKey="ym" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="revenue" stroke="var(--copper-600)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="card">
              <h3 style={{ marginBottom: 12, fontSize: 16 }}>By Category</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={report.byCategory}>
                  <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
                  <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="revenue" fill="var(--teal-600)" />
                  <Bar dataKey="cost" fill="var(--copper-400)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
