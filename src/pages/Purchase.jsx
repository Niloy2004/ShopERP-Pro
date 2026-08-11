import React, { useEffect, useState } from 'react';
import Modal from '../components/Modal.jsx';

const CATEGORIES = ['RO Unit', 'Filter', 'Membrane', 'Spare', 'Accessory'];

export default function Purchase() {
  const [purchases, setPurchases] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [items, setItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState(null);
  const [ledgerVendor, setLedgerVendor] = useState(null);
  const [filters, setFilters] = useState({ from: '', to: '', vendor_id: '' });

  const load = () => {
    window.api.purchase.list(filters).then(setPurchases);
    window.api.vendors.list().then(setVendors);
    window.api.items.list().then(setItems);
  };

  useEffect(() => { load(); }, [filters]);

  const deletePurchase = async (p) => {
    const sure = confirm(
      `Permanently delete this purchase from ${p.vendor_name || 'this vendor'} (₹${p.total_amount})?\n\n` +
      `This cannot be undone. The stock added by this purchase will be subtracted back out. ` +
      `If some of that stock has already been sold, the item's stock count may go negative — ` +
      `check Stock afterward if that's a concern.`
    );
    if (!sure) return;
    await window.api.purchase.delete(p.id);
    load();
  };

  const openEdit = async (p) => {
    const full = await window.api.purchase.get(p.id);
    if (full) setEditingPurchase(full);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Purchase</h1>
          <div className="page-sub">Stock coming in from vendors — buying a new item adds it to Stock automatically</div>
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
          <thead><tr><th>Date</th><th>Vendor</th><th>Amount</th><th>Status</th><th>Invoice Ref</th><th></th></tr></thead>
          <tbody>
            {purchases.map(p => (
              <tr key={p.id}>
                <td>{p.date}</td>
                <td>{p.vendor_name || '—'}</td>
                <td>₹{p.total_amount.toLocaleString('en-IN')}</td>
                <td><StatusBadge status={p.payment_status} /></td>
                <td className="mono">{p.invoice_ref || '—'}</td>
                <td style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-ghost" onClick={() => openEdit(p)}>Edit</button>
                  <button className="btn btn-ghost" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => deletePurchase(p)}>Delete</button>
                </td>
              </tr>
            ))}
            {purchases.length === 0 && <tr><td colSpan={6} className="page-sub">No purchases recorded yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {showForm && (
        <PurchaseForm vendors={vendors} items={items} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />
      )}
      {editingPurchase && (
        <PurchaseForm
          vendors={vendors} items={items} existingPurchase={editingPurchase}
          onClose={() => setEditingPurchase(null)}
          onSaved={() => { setEditingPurchase(null); load(); }}
        />
      )}
      {ledgerVendor && (
        <VendorLedger vendor={ledgerVendor} onClose={() => setLedgerVendor(null)} onDeleted={load} onUpdated={load} />
      )}
    </div>
  );
}

function VendorLedger({ vendor, onClose, onDeleted, onUpdated }) {
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(vendor.name);
  const [phone, setPhone] = useState(vendor.phone || '');
  const [address, setAddress] = useState(vendor.address || '');

  useEffect(() => { window.api.vendors.ledger(vendor.id).then(setRows); }, [vendor.id]);

  const totalPurchased = rows.reduce((s, r) => s + r.total_amount, 0);
  const totalPaid = rows.reduce((s, r) => s + r.amount_paid, 0);
  const balanceDue = totalPurchased - totalPaid;

  const deleteVendor = async () => {
    const sure = confirm(
      `Permanently delete vendor "${vendor.name}"?\n\n` +
      `This cannot be undone. Past purchase records from this vendor are kept for your records, ` +
      `but will no longer show a vendor name attached.`
    );
    if (!sure) return;
    await window.api.vendors.delete(vendor.id);
    onClose();
    onDeleted && onDeleted();
  };

  const saveEdit = async () => {
    if (!name.trim()) return alert('Vendor name is required.');
    await window.api.vendors.update({ id: vendor.id, name: name.trim(), phone, address });
    setEditing(false);
    onUpdated && onUpdated();
  };

  return (
    <Modal title={`Vendor Ledger — ${vendor.name}`} onClose={onClose} width={560}>
      {editing ? (
        <div style={{ marginBottom: 16 }}>
          <div className="field"><label>Name</label><input value={name} onChange={e => setName(e.target.value)} /></div>
          <div className="grid-2">
            <div className="field"><label>Phone</label><input value={phone} onChange={e => setPhone(e.target.value)} /></div>
            <div className="field"><label>Address</label><input value={address} onChange={e => setAddress(e.target.value)} /></div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={saveEdit}>Save Vendor Details</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <div className="page-sub">{vendor.phone || 'No phone on file'} · {vendor.address || 'No address on file'}</div>
          <button className="btn btn-ghost" onClick={() => setEditing(true)}>Edit Vendor</button>
        </div>
      )}

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
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
        <button className="btn btn-ghost" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={deleteVendor}>Delete Vendor</button>
      </div>
    </Modal>
  );
}

function StatusBadge({ status }) {
  const cls = status === 'Paid' ? 'badge-ok' : status === 'Partial' ? 'badge-warn' : 'badge-danger';
  return <span className={`badge ${cls}`}>{status}</span>;
}

function PurchaseForm({ vendors, items: initialItems, existingPurchase, onClose, onSaved }) {
  const isEdit = !!existingPurchase;
  const [itemsList, setItemsList] = useState(initialItems);

  const [vendorId, setVendorId] = useState(isEdit ? (existingPurchase.purchase.vendor_id || '') : '');
  const [newVendorName, setNewVendorName] = useState('');
  const [addingVendor, setAddingVendor] = useState(false);
  const [date, setDate] = useState(isEdit ? existingPurchase.purchase.date : new Date().toISOString().slice(0, 10));
  const [paymentStatus, setPaymentStatus] = useState(isEdit ? existingPurchase.purchase.payment_status : 'Due');
  const [amountPaid, setAmountPaid] = useState(isEdit ? existingPurchase.purchase.amount_paid : 0);
  const [invoiceRef, setInvoiceRef] = useState(isEdit ? (existingPurchase.purchase.invoice_ref || '') : '');
  const [notes, setNotes] = useState(isEdit ? (existingPurchase.purchase.notes || '') : '');
  const [lines, setLines] = useState(
    isEdit
      ? existingPurchase.items.map(it => ({ item_id: String(it.item_id), qty: it.qty, unit_cost: it.unit_cost }))
      : [{ item_id: '', qty: 1, unit_cost: 0 }]
  );
  const [addingItemAt, setAddingItemAt] = useState(null);
  const [newItem, setNewItem] = useState({ name: '', category: CATEGORIES[0], sell_price: 0, reorder_level: 5 });

  const total = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unit_cost) || 0), 0);

  const updateLine = (i, patch) => setLines(lines.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  const addLine = () => setLines([...lines, { item_id: '', qty: 1, unit_cost: 0 }]);
  const removeLine = (i) => setLines(lines.filter((_, idx) => idx !== i));

  const startAddItem = (i) => {
    setAddingItemAt(i);
    setNewItem({ name: '', category: CATEGORIES[0], sell_price: 0, reorder_level: 5 });
  };
  const confirmAddItem = async (i) => {
    if (!newItem.name.trim()) return alert('Enter the new item\'s name.');
    const { id } = await window.api.items.add({
      name: newItem.name.trim(),
      category: newItem.category,
      cost_price: Number(lines[i].unit_cost) || 0,
      sell_price: Number(newItem.sell_price) || 0,
      reorder_level: Number(newItem.reorder_level) || 5,
      qty_on_hand: 0
    });
    const created = { id, name: newItem.name.trim(), qty_on_hand: 0 };
    setItemsList([...itemsList, created]);
    updateLine(i, { item_id: String(id) });
    setAddingItemAt(null);
  };

  const save = async () => {
    let finalVendorId = vendorId;
    if (addingVendor) {
      if (!newVendorName) return alert('Enter the new vendor name.');
      const { id } = await window.api.vendors.add({ name: newVendorName });
      finalVendorId = id;
    }
    if (!finalVendorId || lines.some(l => !l.item_id)) return alert('Vendor and all item lines are required — add or select an item on every line.');

    const payload = {
      vendor_id: Number(finalVendorId), date, payment_status: paymentStatus,
      amount_paid: Number(amountPaid), invoice_ref: invoiceRef, notes,
      items: lines.map(l => ({ item_id: Number(l.item_id), qty: Number(l.qty), unit_cost: Number(l.unit_cost) }))
    };

    if (isEdit) {
      await window.api.purchase.update({ id: existingPurchase.purchase.id, ...payload });
    } else {
      await window.api.purchase.create(payload);
    }
    onSaved();
  };

  return (
    <Modal title={isEdit ? 'Edit Purchase' : 'New Purchase'} onClose={onClose} width={680}>
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
        <div className="page-sub" style={{ marginBottom: 6 }}>
          Buying something new? Pick "+ Add new item…" right in the list below — it's added to Stock automatically, no separate trip needed.
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 4, padding: '0 4px' }}>
          <div style={{ flex: 2, fontSize: 11, fontWeight: 700, color: 'var(--ink-600)', textTransform: 'uppercase' }}>Item</div>
          <div style={{ flex: 1, fontSize: 11, fontWeight: 700, color: 'var(--ink-600)', textTransform: 'uppercase' }}>Quantity</div>
          <div style={{ flex: 1, fontSize: 11, fontWeight: 700, color: 'var(--ink-600)', textTransform: 'uppercase' }}>Cost / unit (₹)</div>
          <div style={{ width: 24 }}></div>
        </div>
        {lines.map((l, i) => (
          <div key={i} style={{ marginBottom: 6 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <select style={{ flex: 2 }} value={l.item_id} onChange={e => {
                if (e.target.value === '__new__') startAddItem(i);
                else updateLine(i, { item_id: e.target.value });
              }}>
                <option value="">Item…</option>
                {itemsList.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
                <option value="__new__">+ Add new item…</option>
              </select>
              <input style={{ flex: 1 }} type="number" min="1" placeholder="Qty" value={l.qty} onChange={e => updateLine(i, { qty: e.target.value })} />
              <input style={{ flex: 1 }} type="number" min="0" placeholder="Unit cost" value={l.unit_cost} onChange={e => updateLine(i, { unit_cost: e.target.value })} />
              <button className="btn-ghost" style={{ border: 'none' }} onClick={() => removeLine(i)}>✕</button>
            </div>
            {addingItemAt === i && (
              <div className="card" style={{ background: 'var(--cream-50)', marginTop: 6, padding: 12 }}>
                <div className="grid-2">
                  <div className="field" style={{ marginBottom: 8 }}>
                    <label>New item name</label>
                    <input value={newItem.name} onChange={e => setNewItem({ ...newItem, name: e.target.value })} placeholder="e.g. RO Membrane 75 GPD" />
                  </div>
                  <div className="field" style={{ marginBottom: 8 }}>
                    <label>Category</label>
                    <select value={newItem.category} onChange={e => setNewItem({ ...newItem, category: e.target.value })}>
                      {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid-2">
                  <div className="field" style={{ marginBottom: 8 }}>
                    <label>Selling price (₹)</label>
                    <input type="number" min="0" value={newItem.sell_price} onChange={e => setNewItem({ ...newItem, sell_price: e.target.value })} />
                  </div>
                  <div className="field" style={{ marginBottom: 8 }}>
                    <label>Reorder threshold</label>
                    <input type="number" min="0" value={newItem.reorder_level} onChange={e => setNewItem({ ...newItem, reorder_level: e.target.value })} />
                  </div>
                </div>
                <div className="page-sub" style={{ marginBottom: 8 }}>Cost price will be taken from the "Unit cost" field on this line.</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-ghost" onClick={() => setAddingItemAt(null)}>Cancel</button>
                  <button className="btn btn-primary" onClick={() => confirmAddItem(i)}>Add Item & Use It Here</button>
                </div>
              </div>
            )}
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

      {isEdit && (
        <div className="page-sub" style={{ marginBottom: 8 }}>
          Saving corrections adjusts stock to match — old quantities are reversed and the new ones applied.
        </div>
      )}

      <div style={{ textAlign: 'right', fontWeight: 700, margin: '10px 0' }}>Total: ₹{total.toLocaleString('en-IN')}</div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save}>{isEdit ? 'Save Corrections' : 'Save Purchase'}</button>
      </div>
    </Modal>
  );
}
