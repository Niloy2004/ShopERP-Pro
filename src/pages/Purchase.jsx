import React, { useEffect, useState } from 'react';
import Modal from '../components/Modal.jsx';

export default function Purchase() {
  const [purchases, setPurchases] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [items, setItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [ledgerVendor, setLedgerVendor] = useState(null);
  const [filters, setFilters] = useState({ from: '', to: '', vendor_id: '' });

  const load = () => {
    window.api.purchase.list(filters).then(setPurchases);
    window.api.vendors.list().then(setVendors);
    window.api.items.list().then(setItems);
  };

  useEffect(() => { load(); }, [filters]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Purchase</h1>
          <div className="page-sub">Stock coming in from vendors</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select style={{ minWidth: 160 }} onChange={e => e.target.value && setLedgerVendor(vendors.find(v => String(v.id) === e.target.value))} value="">
            <option value="">View Vendor Ledger…</option>
            {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ New Purchase</button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'flex-end' }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>From</label>
          <input type="date" value={filters.from} onChange={e => setFilters({ ...filters, from: e.target.value })} />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>To</label>
          <input type="date" value={filters.to} onChange={e => setFilters({ ...filters, to: e.target.value })} />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Vendor</label>
          <select value={filters.vendor_id} onChange={e => setFilters({ ...filters, vendor_id: e.target.value })}>
            <option value="">All vendors</option>
            {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
      </div>

      <div className="card">
        <table>
          <thead><tr><th>Date</th><th>Vendor</th><th>Amount</th><th>Status</th><th>Invoice Ref</th></tr></thead>
          <tbody>
            {purchases.map(p => (
              <tr key={p.id}>
                <td>{p.date}</td>
                <td>{p.vendor_name || '—'}</td>
                <td>₹{p.total_amount.toLocaleString('en-IN')}</td>
                <td><StatusBadge status={p.payment_status} /></td>
                <td className="mono">{p.invoice_ref || '—'}</td>
              </tr>
            ))}
            {purchases.length === 0 && <tr><td colSpan={5} className="page-sub">No purchases recorded yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {showForm && (
        <PurchaseForm vendors={vendors} items={items} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />
      )}
      {ledgerVendor && (
        <VendorLedger vendor={ledgerVendor} onClose={() => setLedgerVendor(null)} />
      )}
    </div>
  );
}

function VendorLedger({ vendor, onClose }) {
  const [rows, setRows] = useState([]);
  useEffect(() => { window.api.vendors.ledger(vendor.id).then(setRows); }, [vendor.id]);

  const totalPurchased = rows.reduce((s, r) => s + r.total_amount, 0);
  const totalPaid = rows.reduce((s, r) => s + r.amount_paid, 0);
  const balanceDue = totalPurchased - totalPaid;

  return (
    <Modal title={`Vendor Ledger — ${vendor.name}`} onClose={onClose} width={560}>
      <div className="grid-4" style={{ marginBottom: 16 }}>
        <div className="stat-card" style={{ padding: 12 }}>
          <div className="stat-label" style={{ fontSize: 11 }}>Total Purchased</div>
          <div className="stat-value" style={{ fontSize: 18 }}>₹{totalPurchased.toLocaleString('en-IN')}</div>
        </div>
        <div className="stat-card" style={{ padding: 12 }}>
          <div className="stat-label" style={{ fontSize: 11 }}>Total Paid</div>
          <div className="stat-value" style={{ fontSize: 18 }}>₹{totalPaid.toLocaleString('en-IN')}</div>
        </div>
        <div className="stat-card" style={{ padding: 12, borderLeftColor: balanceDue > 0 ? 'var(--danger)' : 'var(--ok)' }}>
          <div className="stat-label" style={{ fontSize: 11 }}>Balance Due</div>
          <div className="stat-value" style={{ fontSize: 18, color: balanceDue > 0 ? 'var(--danger)' : 'var(--ok)' }}>₹{balanceDue.toLocaleString('en-IN')}</div>
        </div>
      </div>
      <table>
        <thead><tr><th>Date</th><th>Amount</th><th>Paid</th><th>Status</th></tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id}>
              <td>{r.date}</td>
              <td>₹{r.total_amount}</td>
              <td>₹{r.amount_paid}</td>
              <td><span className={`badge ${r.payment_status === 'Paid' ? 'badge-ok' : r.payment_status === 'Partial' ? 'badge-warn' : 'badge-danger'}`}>{r.payment_status}</span></td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={4} className="page-sub">No purchase history with this vendor.</td></tr>}
        </tbody>
      </table>
    </Modal>
  );
}

function StatusBadge({ status }) {
  const cls = status === 'Paid' ? 'badge-ok' : status === 'Partial' ? 'badge-warn' : 'badge-danger';
  return <span className={`badge ${cls}`}>{status}</span>;
}

function PurchaseForm({ vendors, items, onClose, onSaved }) {
  const [vendorId, setVendorId] = useState('');
  const [newVendorName, setNewVendorName] = useState('');
  const [addingVendor, setAddingVendor] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentStatus, setPaymentStatus] = useState('Due');
  const [amountPaid, setAmountPaid] = useState(0);
  const [invoiceRef, setInvoiceRef] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState([{ item_id: '', qty: 1, unit_cost: 0 }]);

  const total = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unit_cost) || 0), 0);

  const updateLine = (i, patch) => setLines(lines.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  const addLine = () => setLines([...lines, { item_id: '', qty: 1, unit_cost: 0 }]);
  const removeLine = (i) => setLines(lines.filter((_, idx) => idx !== i));

  const save = async () => {
    let finalVendorId = vendorId;
    if (addingVendor) {
      if (!newVendorName) return alert('Enter the new vendor name.');
      const { id } = await window.api.vendors.add({ name: newVendorName });
      finalVendorId = id;
    }
    if (!finalVendorId || lines.some(l => !l.item_id)) return alert('Vendor and all item lines are required.');
    await window.api.purchase.create({
      vendor_id: Number(finalVendorId), date, payment_status: paymentStatus,
      amount_paid: Number(amountPaid), invoice_ref: invoiceRef, notes,
      items: lines.map(l => ({ item_id: Number(l.item_id), qty: Number(l.qty), unit_cost: Number(l.unit_cost) }))
    });
    onSaved();
  };

  return (
    <Modal title="New Purchase" onClose={onClose} width={640}>
      <div className="grid-2">
        <div className="field">
          <label>Vendor</label>
          {addingVendor ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <input placeholder="New vendor name" value={newVendorName} onChange={e => setNewVendorName(e.target.value)} />
              <button className="btn-ghost" style={{ border: 'none' }} onClick={() => setAddingVendor(false)}>✕</button>
            </div>
          ) : (
            <select value={vendorId} onChange={e => {
              if (e.target.value === '__new__') setAddingVendor(true);
              else setVendorId(e.target.value);
            }}>
              <option value="">Select vendor…</option>
              {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              <option value="__new__">+ Add new vendor…</option>
            </select>
          )}
        </div>
        <div className="field">
          <label>Purchase date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
      </div>

      <div className="field">
        <label>Items</label>
        {lines.map((l, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
            <select style={{ flex: 2 }} value={l.item_id} onChange={e => updateLine(i, { item_id: e.target.value })}>
              <option value="">Item…</option>
              {items.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
            </select>
            <input style={{ flex: 1 }} type="number" min="1" placeholder="Qty" value={l.qty} onChange={e => updateLine(i, { qty: e.target.value })} />
            <input style={{ flex: 1 }} type="number" min="0" placeholder="Unit cost" value={l.unit_cost} onChange={e => updateLine(i, { unit_cost: e.target.value })} />
            <button className="btn-ghost" style={{ border: 'none' }} onClick={() => removeLine(i)}>✕</button>
          </div>
        ))}
        <button className="btn btn-ghost" onClick={addLine}>+ Add item line</button>
      </div>

      <div className="grid-2">
        <div className="field">
          <label>Payment status</label>
          <select value={paymentStatus} onChange={e => setPaymentStatus(e.target.value)}>
            <option>Due</option><option>Partial</option><option>Paid</option>
          </select>
        </div>
        <div className="field">
          <label>Amount paid</label>
          <input type="number" value={amountPaid} onChange={e => setAmountPaid(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label>Invoice reference</label>
        <input value={invoiceRef} onChange={e => setInvoiceRef(e.target.value)} />
      </div>

      <div style={{ textAlign: 'right', fontWeight: 700, margin: '10px 0' }}>Total: ₹{total.toLocaleString('en-IN')}</div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save}>Save Purchase</button>
      </div>
    </Modal>
  );
}
