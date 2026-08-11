import React, { useEffect, useState } from 'react';
import Modal from '../components/Modal.jsx';

const CATEGORIES = ['RO Unit', 'Filter', 'Membrane', 'Spare', 'Accessory'];

export default function Stock() {
  const [items, setItems] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [adjustItem, setAdjustItem] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const load = () => window.api.items.list().then(setItems);
  useEffect(() => { load(); }, []);

  const deleteItem = async (item) => {
    const sure = confirm(
      `Permanently delete "${item.name}"?\n\n` +
      `This cannot be undone. If this item was ever used in a past purchase or sale, ` +
      `those old invoice/purchase records will also lose that line item (their totals will ` +
      `no longer match the items shown).\n\n` +
      `Type OK to confirm you understand and still want to permanently delete it.`
    );
    if (!sure) return;
    await window.api.items.delete(item.id);
    load();
  };

  const handleImport = async () => {
    setImporting(true);
    setImportResult(null);
    try {
      const result = await window.api.importData.items();
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
          <h1 className="page-title">Stock</h1>
          <div className="page-sub">Inventory across RO units, filters, membranes & spares</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={handleImport} disabled={importing}>
            {importing ? 'Importing…' : 'Import from Excel/CSV'}
          </button>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add Item</button>
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
            Expected columns: name, sku, category, cost_price, sell_price, reorder_level, qty_on_hand (column names are flexible — "Item Name", "Cost Price" etc. also work)
          </div>
        </div>
      )}

      <div className="card">
        <table>
          <thead>
            <tr><th>Item</th><th>Category</th><th>SKU</th><th>On hand</th><th>Reorder at</th><th>Cost</th><th>Sell</th><th></th></tr>
          </thead>
          <tbody>
            {items.map(i => (
              <tr key={i.id}>
                <td>{i.name}</td>
                <td>{i.category || '—'}</td>
                <td className="mono">{i.sku || '—'}</td>
                <td>
                  <span className={`badge ${i.qty_on_hand <= i.reorder_level ? 'badge-danger' : 'badge-ok'}`}>{i.qty_on_hand}</span>
                </td>
                <td>{i.reorder_level}</td>
                <td>₹{i.cost_price}</td>
                <td>₹{i.sell_price}</td>
                <td style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-ghost" onClick={() => setEditItem(i)}>Edit</button>
                  <button className="btn btn-ghost" onClick={() => setAdjustItem(i)}>Adjust</button>
                  <button className="btn btn-ghost" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => deleteItem(i)}>Delete</button>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={8} className="page-sub">No items yet — add your first item.</td></tr>}
          </tbody>
        </table>
      </div>

      {showAdd && <AddItemForm onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />}
      {editItem && <AddItemForm existing={editItem} onClose={() => setEditItem(null)} onSaved={() => { setEditItem(null); load(); }} />}
      {adjustItem && <AdjustForm item={adjustItem} onClose={() => setAdjustItem(null)} onSaved={() => { setAdjustItem(null); load(); }} />}
    </div>
  );
}

function AddItemForm({ existing, onClose, onSaved }) {
  const isEdit = !!existing;
  const [form, setForm] = useState(existing
    ? { name: existing.name, sku: existing.sku || '', category: existing.category || CATEGORIES[0], cost_price: existing.cost_price, sell_price: existing.sell_price, reorder_level: existing.reorder_level, qty_on_hand: existing.qty_on_hand }
    : { name: '', sku: '', category: CATEGORIES[0], cost_price: 0, sell_price: 0, reorder_level: 5, qty_on_hand: 0 });
  const set = (k, v) => setForm({ ...form, [k]: v });

  const save = async () => {
    if (!form.name) return alert('Item name is required.');
    if (isEdit) {
      await window.api.items.update({ id: existing.id, name: form.name, sku: form.sku, category: form.category, cost_price: Number(form.cost_price), sell_price: Number(form.sell_price), reorder_level: Number(form.reorder_level) });
    } else {
      await window.api.items.add(form);
    }
    onSaved();
  };

  return (
    <Modal title={isEdit ? `Edit Item — ${existing.name}` : 'Add Stock Item'} onClose={onClose} width={480}>
      <div className="field"><label>Item name</label><input value={form.name} onChange={e => set('name', e.target.value)} /></div>
      <div className="grid-2">
        <div className="field"><label>SKU / Model</label><input value={form.sku} onChange={e => set('sku', e.target.value)} /></div>
        <div className="field">
          <label>Category</label>
          <select value={form.category} onChange={e => set('category', e.target.value)}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div className="grid-2">
        <div className="field"><label>Cost price</label><input type="number" value={form.cost_price} onChange={e => set('cost_price', e.target.value)} /></div>
        <div className="field"><label>Selling price</label><input type="number" value={form.sell_price} onChange={e => set('sell_price', e.target.value)} /></div>
      </div>
      <div className="grid-2">
        {!isEdit && <div className="field"><label>Opening quantity</label><input type="number" value={form.qty_on_hand} onChange={e => set('qty_on_hand', e.target.value)} /></div>}
        <div className="field"><label>Reorder threshold</label><input type="number" value={form.reorder_level} onChange={e => set('reorder_level', e.target.value)} /></div>
      </div>
      {isEdit && (
        <div className="page-sub" style={{ marginBottom: 8 }}>
          To change how much is currently in stock, use "Adjust" instead — this form only edits the item's details.
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save}>{isEdit ? 'Save Changes' : 'Save Item'}</button>
      </div>
    </Modal>
  );
}

function AdjustForm({ item, onClose, onSaved }) {
  const [qtyChange, setQtyChange] = useState(0);
  const [reason, setReason] = useState('');

  const save = async () => {
    if (!qtyChange) return alert('Enter a non-zero quantity change.');
    await window.api.stock.adjust({ item_id: item.id, qty_change: Number(qtyChange), reason });
    onSaved();
  };

  return (
    <Modal title={`Adjust Stock — ${item.name}`} onClose={onClose} width={420}>
      <div className="page-sub" style={{ marginBottom: 12 }}>Current on hand: <strong>{item.qty_on_hand}</strong></div>
      <div className="field">
        <label>Quantity change (use negative for damage/loss)</label>
        <input type="number" value={qtyChange} onChange={e => setQtyChange(e.target.value)} />
      </div>
      <div className="field">
        <label>Reason</label>
        <input placeholder="e.g. Damage, Return, Correction" value={reason} onChange={e => setReason(e.target.value)} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save}>Apply Adjustment</button>
      </div>
    </Modal>
  );
}
