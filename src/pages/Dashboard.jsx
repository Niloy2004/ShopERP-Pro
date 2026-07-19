import React, { useEffect, useState } from 'react';

function timeAgo(ts) {
  if (!ts) return '';
  const d = new Date(ts.replace(' ', 'T'));
  const diffMin = Math.round((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return d.toLocaleDateString();
}

export default function Dashboard({ onNavigate }) {
  const [data, setData] = useState(null);
  const [reminderDays, setReminderDays] = useState(3);

  const load = () => {
    window.api.dashboard.summary().then(setData);
    window.api.settings.get().then(s => setReminderDays(Number(s.service_reminder_days || 3)));
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 15000); // light auto-refresh
    return () => clearInterval(id);
  }, []);

  if (!data) return <div className="page-sub">Loading dashboard…</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <div className="page-sub">Today's business at a glance</div>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 20 }}>
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => onNavigate('sell')}>
          <div className="stat-label">Today's Sales</div>
          <div className="stat-value">₹{data.todaysSales.total.toLocaleString('en-IN')}</div>
          <div className="stat-sub">{data.todaysSales.count} invoice(s)</div>
        </div>
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => onNavigate('purchase')}>
          <div className="stat-label">Today's Purchases</div>
          <div className="stat-value">₹{data.todaysPurchases.total.toLocaleString('en-IN')}</div>
          <div className="stat-sub">{data.todaysPurchases.count} entr(y/ies)</div>
        </div>
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => onNavigate('crm')}>
          <div className="stat-label">New Customers Today</div>
          <div className="stat-value">{data.newCustomers.count}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Upcoming Services</div>
          <div className="stat-value">{data.upcomingServices?.length || 0}</div>
          <div className="stat-sub">due in next {reminderDays} days</div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <h3 style={{ marginBottom: 12, fontSize: 16 }}>Stock Alerts</h3>
          {data.stockAlerts.length === 0 ? (
            <div className="page-sub">All items above reorder threshold.</div>
          ) : (
            <table>
              <thead><tr><th>Item</th><th>On hand</th><th>Reorder at</th></tr></thead>
              <tbody>
                {data.stockAlerts.map(i => (
                  <tr key={i.id} style={{ cursor: 'pointer' }} onClick={() => onNavigate('stock')}>
                    <td>{i.name}</td>
                    <td><span className="badge badge-danger">{i.qty_on_hand}</span></td>
                    <td>{i.reorder_level}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h3 style={{ marginBottom: 12, fontSize: 16 }}>AMC Renewals Due (30 days)</h3>
          {(!data.amcDue || data.amcDue.length === 0) ? (
            <div className="page-sub">No AMC renewals due soon.</div>
          ) : (
            <table>
              <thead><tr><th>Customer</th><th>Phone</th><th>Renewal</th></tr></thead>
              <tbody>
                {data.amcDue.map(c => (
                  <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => onNavigate('crm')}>
                    <td>{c.name}</td>
                    <td>{c.phone}</td>
                    <td><span className="badge badge-warn">{c.amc_renewal_date}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: 16 }}>
        <div className="card">
          <h3 style={{ marginBottom: 12, fontSize: 16 }}>Upcoming Services (next {reminderDays} days)</h3>
          {(!data.upcomingServices || data.upcomingServices.length === 0) ? (
            <div className="page-sub">No services due in the next 3 days.</div>
          ) : (
            <table>
              <thead><tr><th>Customer</th><th>Item</th><th>Due</th><th></th></tr></thead>
              <tbody>
                {data.upcomingServices.map(s => (
                  <tr key={s.id}>
                    <td>{s.customer_name}</td>
                    <td>{s.item_label}</td>
                    <td><span className="badge badge-warn">{s.next_service_date}</span></td>
                    <td>
                      <button className="btn btn-ghost" onClick={async () => {
                        await window.api.whatsapp.openChat({
                          phone: s.customer_phone,
                          message: `Hi ${s.customer_name}, a friendly reminder that your ${s.item_label} is due for service around ${s.next_service_date}. Reply here or call us to schedule a visit — Healthy Appliances.`
                        });
                        await window.api.installations.markReminderSent(s.id);
                      }}>Remind</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h3 style={{ marginBottom: 12, fontSize: 16 }}>Recent Activity</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 320, overflowY: 'auto' }}>
            {data.recentActivity.map((a, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}>
                <span>{a.label}</span>
                <span className="page-sub" style={{ marginTop: 0 }}>{timeAgo(a.ts)}</span>
              </div>
            ))}
            {data.recentActivity.length === 0 && <div className="page-sub">No activity yet.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
