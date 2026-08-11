import React, { useEffect, useState } from 'react';
import Modal from '../components/Modal.jsx';

const CATEGORIES = ['Rent', 'Electricity Bill', 'Staff Salary', 'Transport / Fuel', 'Shop Maintenance', 'Tea / Refreshments', 'Miscellaneous', 'Other'];

function firstOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function today() { return new Date().toISOString().slice(0, 10); }

export default function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editExpense, setEditExpense] = useState(null);
  const [filters, setFilters] = useState({ from: firstOfMonth(), to: today(), category: '' });

  const load = () => {
    window.api.expenses.list(filters).then(setExpenses);
    window.api.expenses.summary({ from: filters.from, to: filters.to }).then(setSummary);
  };
  useEffect(() => { load(); }, [filters]);

  const remove = async (id) => {
    if (!confirm('Delete this expense entry?')) return;
    await window.api.expenses.delete(id);
    load();
  };

  const rangeTotal = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Shop Expenses</h1>
          <div className="page-sub">Daily running costs — rent, electricity, wages, and more (separate from inventory purchases)</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Add Expense</button>
      </div>

      <div className="grid-4" style={{ marginBottom: 16 }}>
        <div className="stat-card">
          <div className="stat-label">Today's Expenses</div>
          <div className="stat-value">₹{(summary?.todayTotal || 0).toLocaleString('en-IN')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total (selected range)</div>
          <div className="stat-value">₹{rangeTotal.toLocaleString('en-IN')}</div>
        </div>
        <div className="stat-card" style={{ gridColumn: 'span 2' }}>
          <div className="stat-label">Top Category</div>
          <div className="stat-value" style={{ fontSize: 18 }}>
            {summary?.byCategory?.[0] ? `${summary.byCategory[0].category} — ₹${summary.byCategory[0].total.toLocaleString('en-IN')}` : '—'}
          </div>
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
          <label>Category</label>
          <select value={filters.category} onChange={e => setFilters({ ...filters, category: e.target.value })}>
            <option value="">All categories</option>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="card">
        <table>
          <thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Amount</th><th></th></tr></thead>
          <tbody>
            {expenses.map(exp => (
              <tr key={exp.id}>
                <td>{exp.date}</td>
                <td><span className="badge badge-neutral">{exp.category}</span></td>
                <td>{exp.description || '—'}</td>
                <td>₹{exp.amount.toLocaleString('en-IN')}</td>
                <td style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-ghost" onClick={() => setEditExpense(exp)}>Edit</button>
                  <button className="btn btn-ghost" onClick={() => remove(exp.id)}>Delete</button>
                </td>
              </tr>
            ))}
            {expenses.length === 0 && <tr><td colSpan={5} className="page-sub">No expenses recorded for this range.</td></tr>}
          </tbody>
        </table>
      </div>

      {showForm && <ExpenseForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      {editExpense && <ExpenseForm existing={editExpense} onClose={() => setEditExpense(null)} onSaved={() => { setEditExpense(null); load(); }} />}
    </div>
  );
}

function ExpenseForm({ existing, onClose, onSaved }) {
  const isEdit = !!existing;
  const [date, setDate] = useState(existing?.date || today());
  const [category, setCategory] = useState(existing && !CATEGORIES.includes(existing.category) ? 'Other' : (existing?.category || CATEGORIES[0]));
  const [customCategory, setCustomCategory] = useState(existing && !CATEGORIES.includes(existing.category) ? existing.category : '');
  const [description, setDescription] = useState(existing?.description || '');
  const [amount, setAmount] = useState(existing?.amount ?? '');

  const save = async () => {
    const finalCategory = category === 'Other' ? (customCategory.trim() || 'Other') : category;
    if (!amount || Number(amount) <= 0) return alert('Enter a valid amount.');
    if (isEdit) {
      await window.api.expenses.update({ id: existing.id, date, category: finalCategory, description, amount: Number(amount) });
    } else {
      await window.api.expenses.create({ date, category: finalCategory, description, amount: Number(amount) });
    }
    onSaved();
  };

  return (
    <Modal title={isEdit ? 'Edit Expense' : 'Add Expense'} onClose={onClose} width={420}>
      <div className="field">
        <label>Date</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} />
      </div>
      <div className="field">
        <label>Category</label>
        <select value={category} onChange={e => setCategory(e.target.value)}>
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>
      {category === 'Other' && (
        <div className="field">
          <label>Specify category</label>
          <input value={customCategory} onChange={e => setCustomCategory(e.target.value)} placeholder="e.g. Repairs" />
        </div>
      )}
      <div className="field">
        <label>Description (optional)</label>
        <input value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. July electricity bill" />
      </div>
      <div className="field">
        <label>Amount (₹)</label>
        <input type="number" min="0" value={amount} onChange={e => setAmount(e.target.value)} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save}>{isEdit ? 'Save Changes' : 'Save Expense'}</button>
      </div>
    </Modal>
  );
}
