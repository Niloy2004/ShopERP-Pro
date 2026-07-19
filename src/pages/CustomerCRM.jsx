import React, { useEffect, useState } from 'react';
import Modal from '../components/Modal.jsx';

export default function CustomerCRM() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [amcFilter, setAmcFilter] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [profileCustomer, setProfileCustomer] = useState(null);
  const [dues, setDues] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const load = () => {
    window.api.customers.list({ search, amc_status: amcFilter || undefined }).then(setCustomers);
    window.api.dues.summary().then(setDues);
  };
  useEffect(() => { load(); }, [search, amcFilter]);

  const totalOutstanding = dues.reduce((s, d) => s + d.balance_due, 0);

  const handleImport = async () => {
    setImporting(true);
    setImportResult(null);
    try {
      const result = await window.api.importData.customers();
      if (result.cancelled) return;
      setImportResult(result);
      load();
    } finally {
      setImporting(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Customer CRM</h1>
          <div className="page-sub">Profiles, purchase history & AMC renewals</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={handleImport} disabled={importing}>
            {importing ? 'Importing…' : 'Import from Excel/CSV'}
          </button>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add Customer</button>
        </div>
      </div>

      {importResult && (
        <div className="card" style={{ marginBottom: 16, borderLeft: `4px solid ${importResult.errors.length ? 'var(--warn)' : 'var(--ok)'}` }}>
          <strong>Imported {importResult.imported} of {importResult.total} rows.</strong>
          {importResult.errors.length > 0 && (
            <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 13, color: 'var(--ink-600)' }}>
              {importResult.errors.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
              {importResult.errors.length > 10 && <li>…and {importResult.errors.length - 10} more</li>}
            </ul>
          )}
          <div className="page-sub" style={{ marginTop: 6 }}>
            Expected columns: name, phone, address, alt_contact, notes (column names are flexible — "Customer Name", "Mobile" etc. also work)
          </div>
        </div>
      )}

      {dues.length > 0 && (
        <div className="card" style={{ marginBottom: 16, borderLeft: '4px solid var(--danger)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h3 style={{ fontSize: 15 }}>Customer Dues — ₹{totalOutstanding.toLocaleString('en-IN')} outstanding</h3>
          </div>
          <table>
            <thead><tr><th>Customer</th><th>Phone</th><th>Total Billed</th><th>Balance Due</th><th></th></tr></thead>
            <tbody>
              {dues.map(d => (
                <tr key={d.customer_id}>
                  <td>{d.name}</td>
                  <td>{d.phone}</td>
                  <td>₹{d.total_billed.toLocaleString('en-IN')}</td>
                  <td><span className="badge badge-danger">₹{d.balance_due.toLocaleString('en-IN')}</span></td>
                  <td><button className="btn btn-ghost" onClick={() => setProfileCustomer({ id: d.customer_id, name: d.name })}>View / Record Payment</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card" style={{ marginBottom: 16, display: 'flex', gap: 12 }}>
        <input style={{ flex: 1 }} placeholder="Search by name or phone…" value={search} onChange={e => setSearch(e.target.value)} />
        <select value={amcFilter} onChange={e => setAmcFilter(e.target.value)}>
          <option value="">All AMC statuses</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="none">No AMC</option>
        </select>
      </div>

      <div className="card">
        <table>
          <thead><tr><th>Name</th><th>Phone</th><th>AMC Status</th><th>Renewal Date</th><th></th></tr></thead>
          <tbody>
            {customers.map(c => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.phone}</td>
                <td><AmcBadge status={c.amc_status} /></td>
                <td>{c.amc_renewal_date || '—'}</td>
                <td><button className="btn btn-ghost" onClick={() => setProfileCustomer(c)}>View Profile</button></td>
              </tr>
            ))}
            {customers.length === 0 && <tr><td colSpan={5} className="page-sub">No customers found.</td></tr>}
          </tbody>
        </table>
      </div>

      {showAdd && <CustomerForm onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />}
      {profileCustomer && <CustomerProfile customer={profileCustomer} onClose={() => setProfileCustomer(null)} onSaved={() => { setProfileCustomer(null); load(); }} />}
    </div>
  );
}

function AmcBadge({ status }) {
  const cls = status === 'active' ? 'badge-ok' : status === 'expired' ? 'badge-danger' : 'badge-neutral';
  return <span className={`badge ${cls}`}>{status || 'none'}</span>;
}

function CustomerForm({ onClose, onSaved, existing }) {
  const [form, setForm] = useState(existing || {
    name: '', phone: '', address: '', alt_contact: '', amc_status: 'none', amc_renewal_date: '', notes: ''
  });
  const set = (k, v) => setForm({ ...form, [k]: v });

  const save = async () => {
    if (!form.name) return alert('Customer name is required.');
    if (existing) await window.api.customers.update(form);
    else await window.api.customers.add(form);
    onSaved();
  };

  return (
    <Modal title={existing ? 'Edit Customer' : 'Add Customer'} onClose={onClose} width={480}>
      <div className="field"><label>Name</label><input value={form.name} onChange={e => set('name', e.target.value)} /></div>
      <div className="grid-2">
        <div className="field"><label>Phone</label><input value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
        <div className="field"><label>Alternate contact</label><input value={form.alt_contact} onChange={e => set('alt_contact', e.target.value)} /></div>
      </div>
      <div className="field"><label>Address</label><input value={form.address} onChange={e => set('address', e.target.value)} /></div>
      <div className="grid-2">
        <div className="field">
          <label>AMC status</label>
          <select value={form.amc_status} onChange={e => set('amc_status', e.target.value)}>
            <option value="none">None</option><option value="active">Active</option><option value="expired">Expired</option>
          </select>
        </div>
        <div className="field"><label>AMC renewal date</label><input type="date" value={form.amc_renewal_date || ''} onChange={e => set('amc_renewal_date', e.target.value)} /></div>
      </div>
      <div className="field"><label>Notes / preferences</label><textarea rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save}>Save</button>
      </div>
    </Modal>
  );
}

function CustomerProfile({ customer: customerStub, onClose, onSaved }) {
  const [customer, setCustomer] = useState(customerStub);
  const [history, setHistory] = useState(null);
  const [duesData, setDuesData] = useState(null);
  const [editing, setEditing] = useState(false);
  const [showPayment, setShowPayment] = useState(false);

  const loadAll = () => {
    window.api.customers.get(customerStub.id).then(setCustomer);
    window.api.customers.history(customerStub.id).then(setHistory);
    window.api.dues.forCustomer(customerStub.id).then(setDuesData);
  };
  useEffect(() => { loadAll(); }, [customerStub.id]);

  if (editing) return <CustomerForm existing={customer} onClose={() => setEditing(false)} onSaved={onSaved} />;

  return (
    <Modal title={customer.name} onClose={onClose} width={560}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <div className="page-sub">{customer.phone} · {customer.address || 'No address on file'}</div>
        <button className="btn btn-ghost" onClick={() => setEditing(true)}>Edit</button>
      </div>
      <div style={{ marginBottom: 14 }}>
        <AmcBadge status={customer.amc_status} /> {customer.amc_renewal_date && <span className="page-sub">renews {customer.amc_renewal_date}</span>}
      </div>

      {duesData && duesData.totalDue > 0.01 && (
        <div className="card" style={{ background: 'var(--cream-50)', marginBottom: 16, borderLeft: '4px solid var(--danger)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <strong style={{ color: 'var(--danger)' }}>Outstanding: ₹{duesData.totalDue.toLocaleString('en-IN')}</strong>
            <button className="btn btn-primary" onClick={() => setShowPayment(true)}>Record Payment</button>
          </div>
          <table>
            <thead><tr><th>Invoice</th><th>Date</th><th>Total</th><th>Due</th></tr></thead>
            <tbody>
              {duesData.sales.map(s => (
                <tr key={s.id}>
                  <td className="mono">{s.invoice_no}</td>
                  <td>{s.date}</td>
                  <td>₹{s.total_amount}</td>
                  <td><span className="badge badge-danger">₹{s.balance_due}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 style={{ fontSize: 14, marginBottom: 8 }}>Purchase History</h3>
      <table style={{ marginBottom: 16 }}>
        <thead><tr><th>Invoice</th><th>Date</th><th>Amount</th></tr></thead>
        <tbody>
          {(history?.purchases || []).map(p => (
            <tr key={p.id}><td className="mono">{p.invoice_no}</td><td>{p.date}</td><td>₹{p.total_amount}</td></tr>
          ))}
          {(!history || history.purchases.length === 0) && <tr><td colSpan={3} className="page-sub">No purchases yet.</td></tr>}
        </tbody>
      </table>

      <h3 style={{ fontSize: 14, marginBottom: 8 }}>Service History</h3>
      <table>
        <thead><tr><th>Issue</th><th>Status</th><th>Scheduled</th></tr></thead>
        <tbody>
          {(history?.services || []).map(s => (
            <tr key={s.id}><td>{s.issue}</td><td><span className="badge badge-neutral">{s.status}</span></td><td>{s.scheduled_date || '—'}</td></tr>
          ))}
          {(!history || history.services.length === 0) && <tr><td colSpan={3} className="page-sub">No service tickets yet.</td></tr>}
        </tbody>
      </table>

      {showPayment && (
        <RecordPaymentForm
          customer={customer}
          openSales={duesData?.sales || []}
          onClose={() => setShowPayment(false)}
          onSaved={() => { setShowPayment(false); loadAll(); onSaved && onSaved(); }}
        />
      )}
    </Modal>
  );
}

function RecordPaymentForm({ customer, openSales, onClose, onSaved }) {
  const [amount, setAmount] = useState('');
  const [saleId, setSaleId] = useState('');
  const [note, setNote] = useState('');

  const save = async () => {
    if (!amount || Number(amount) <= 0) return alert('Enter a valid payment amount.');
    await window.api.dues.recordPayment({
      customer_id: customer.id,
      sale_id: saleId ? Number(saleId) : null,
      amount: Number(amount),
      note
    });
    onSaved();
  };

  return (
    <Modal title={`Record Payment — ${customer.name}`} onClose={onClose} width={420}>
      <div className="field">
        <label>Amount received (₹)</label>
        <input type="number" min="0" value={amount} onChange={e => setAmount(e.target.value)} />
      </div>
      <div className="field">
        <label>Apply to invoice (optional)</label>
        <select value={saleId} onChange={e => setSaleId(e.target.value)}>
          <option value="">Auto-apply to oldest outstanding invoice(s)</option>
          {openSales.map(s => <option key={s.id} value={s.id}>{s.invoice_no} — due ₹{s.balance_due}</option>)}
        </select>
      </div>
      <div className="field">
        <label>Note (optional)</label>
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Paid in cash at shop" />
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save}>Record Payment</button>
      </div>
    </Modal>
  );
}
