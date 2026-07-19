import React, { useEffect, useState } from 'react';
import Modal from '../components/Modal.jsx';

export default function Sell() {
  const [sales, setSales] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [items, setItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [settings, setSettings] = useState(null);

  const load = () => {
    window.api.sell.list().then(setSales);
    window.api.customers.list().then(setCustomers);
    window.api.items.list().then(setItems);
    window.api.settings.get().then(setSettings);
  };
  useEffect(() => { load(); }, []);

  const sendInvoiceWhatsapp = async (sale) => {
    if (!sale.customer_name) return alert('This sale has no linked customer (Walk-in) — no phone number to message.');
    const customer = customers.find(c => c.name === sale.customer_name);
    const phone = customer?.phone;
    if (!phone) return alert('No phone number on file for this customer.');
    const bizName = settings?.business_name || 'Healthy Appliances';
    let dueLine = '';
    if (customer?.id) {
      const dues = await window.api.dues.forCustomer(customer.id);
      const otherDue = dues.sales.filter(s => s.invoice_no !== sale.invoice_no).reduce((sum, s) => sum + s.balance_due, 0);
      if (otherDue > 0.01) dueLine = ` Note: you also have a previous due of ₹${otherDue.toFixed(2)} on your account.`;
    }
    const message = `Hi ${sale.customer_name}, here's your invoice ${sale.invoice_no} for ₹${sale.total_amount} from ${bizName}.${dueLine} The PDF is opening on our system — we'll attach it here in just a moment.`;
    await window.api.whatsapp.openChat({ phone, message });
    await window.api.invoices.revealFolder();
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Sell</h1>
          <div className="page-sub">Billing and point-of-sale invoicing</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ New Sale</button>
      </div>

      <div className="card">
        <table>
          <thead><tr><th>Invoice</th><th>Date</th><th>Customer</th><th>Amount</th><th>Payment</th><th>Due</th><th></th></tr></thead>
          <tbody>
            {sales.map(s => (
              <tr key={s.id}>
                <td className="mono">{s.invoice_no}</td>
                <td>{s.date}</td>
                <td>{s.customer_name || 'Walk-in'}</td>
                <td>₹{s.total_amount.toLocaleString('en-IN')}</td>
                <td><span className="badge badge-neutral">{s.payment_mode}</span></td>
                <td>{s.balance_due > 0.01 ? <span className="badge badge-danger">₹{s.balance_due.toLocaleString('en-IN')}</span> : <span className="badge badge-ok">Paid</span>}</td>
                <td style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-ghost" onClick={() => window.api.sell.generateInvoicePdf(s.id)}>Print PDF</button>
                  <button className="btn btn-ghost" onClick={() => sendInvoiceWhatsapp(s)}>WhatsApp</button>
                </td>
              </tr>
            ))}
            {sales.length === 0 && <tr><td colSpan={7} className="page-sub">No sales recorded yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {showForm && (
        <SellForm customers={customers} items={items} settings={settings} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />
      )}
    </div>
  );
}

function SellForm({ customers, items, settings, onClose, onSaved }) {
  const [customerId, setCustomerId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [discount, setDiscount] = useState(0);
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [amountReceived, setAmountReceived] = useState(0);
  const [lines, setLines] = useState([{ item_id: '', qty: 1, unit_price: 0 }]);
  const [invoiceNo, setInvoiceNo] = useState('');
  const [shortageWarning, setShortageWarning] = useState([]);

  const [previousDue, setPreviousDue] = useState(null);
  const [collectOldDue, setCollectOldDue] = useState(false);
  const [oldDueAmount, setOldDueAmount] = useState(0);

  const [trackService, setTrackService] = useState(false);
  const [serviceIntervalDays, setServiceIntervalDays] = useState(90);
  const [serviceLabel, setServiceLabel] = useState('');
  const [sendWhatsappNow, setSendWhatsappNow] = useState(false);

  useEffect(() => { window.api.sell.nextInvoiceNo().then(setInvoiceNo); }, []);

  useEffect(() => {
    if (!customerId) { setPreviousDue(null); setCollectOldDue(false); return; }
    window.api.dues.forCustomer(Number(customerId)).then(d => {
      setPreviousDue(d.totalDue > 0.01 ? d : null);
      setOldDueAmount(d.totalDue || 0);
    });
  }, [customerId]);

  const gross = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unit_price) || 0), 0);
  const total = Math.max(0, gross - (Number(discount) || 0));
  const grandTotalToCollect = total + (collectOldDue ? Number(oldDueAmount || 0) : 0);

  const updateLine = (i, patch) => {
    const next = lines.map((l, idx) => idx === i ? { ...l, ...patch } : l);
    if (patch.item_id) {
      const item = items.find(it => String(it.id) === String(patch.item_id));
      if (item) {
        next[i].unit_price = item.sell_price;
        if (item.category === 'RO Unit' && !serviceLabel) setServiceLabel(item.name);
      }
    }
    setLines(next);
  };
  const addLine = () => setLines([...lines, { item_id: '', qty: 1, unit_price: 0 }]);
  const removeLine = (i) => setLines(lines.filter((_, idx) => idx !== i));

  const save = async () => {
    if (lines.some(l => !l.item_id)) return alert('Select an item for every line.');
    if (paymentMode === 'Credit' && !customerId) return alert('Select a customer for a credit sale — needed to track the balance due.');
    if (trackService && (!customerId)) return alert('Select a customer to track a service date for.');
    const payload = lines.map(l => ({ item_id: Number(l.item_id), qty: Number(l.qty) }));
    const shortages = await window.api.sell.checkStock(payload);
    if (shortages.length > 0) {
      setShortageWarning(shortages);
      return;
    }
    const result = await window.api.sell.create({
      customer_id: customerId ? Number(customerId) : null,
      date, discount: Number(discount), payment_mode: paymentMode, invoice_no: invoiceNo,
      amount_paid: paymentMode === 'Credit' ? Number(amountReceived) : total,
      items: lines.map(l => ({ item_id: Number(l.item_id), qty: Number(l.qty), unit_price: Number(l.unit_price) }))
    });

    if (collectOldDue && Number(oldDueAmount) > 0) {
      await window.api.dues.recordPayment({ customer_id: Number(customerId), amount: Number(oldDueAmount), note: `Collected alongside invoice ${invoiceNo}` });
    }

    if (trackService && serviceIntervalDays) {
      await window.api.installations.create({
        customer_id: Number(customerId),
        sale_id: result.id,
        item_label: serviceLabel || 'RO Unit',
        install_date: date,
        service_interval_days: Number(serviceIntervalDays)
      });
    }

    const pdfResult = await window.api.sell.generateInvoicePdf(result.id);

    if (sendWhatsappNow && customerId) {
      const customer = customers.find(c => String(c.id) === String(customerId));
      if (customer?.phone) {
        const dueLine = pdfResult.previousDue > 0.01
          ? ` Note: you also have a previous due of ₹${pdfResult.previousDue.toFixed(2)} included on this bill.`
          : '';
        const message = `Hi ${customer.name}, here's your invoice ${pdfResult.invoiceNo} for ₹${pdfResult.totalAmount} from Healthy Appliances.${dueLine} The PDF is opening on our system — attaching it here now.`;
        await window.api.whatsapp.openChat({ phone: customer.phone, message });
        await window.api.invoices.revealFolder();
      } else {
        alert('Sale saved, but this customer has no phone number on file — could not open WhatsApp.');
      }
    }

    onSaved();
  };

  return (
    <Modal title={`New Sale — ${invoiceNo}`} onClose={onClose} width={640}>
      {shortageWarning.length > 0 && (
        <div className="card" style={{ borderColor: 'var(--danger)', background: '#fbeee9', marginBottom: 12 }}>
          <strong style={{ color: 'var(--danger)' }}>Insufficient stock:</strong>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {shortageWarning.map((s, i) => <li key={i}>{s.name}: have {s.available}, need {s.requested}</li>)}
          </ul>
        </div>
      )}

      <div className="grid-2">
        <div className="field">
          <label>Customer</label>
          <select value={customerId} onChange={e => setCustomerId(e.target.value)}>
            <option value="">Walk-in customer</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Sale date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
      </div>

      {previousDue && (
        <div className="card" style={{ background: '#fbeee9', borderLeft: '4px solid var(--danger)', marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong style={{ color: 'var(--danger)' }}>This customer has a previous due: ₹{previousDue.totalDue.toLocaleString('en-IN')}</strong>
              <div className="page-sub">From {previousDue.sales.length} earlier invoice(s)</div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <input type="checkbox" checked={collectOldDue} onChange={e => setCollectOldDue(e.target.checked)} />
              Collect it with this sale
            </label>
          </div>
          {collectOldDue && (
            <div className="field" style={{ marginTop: 8, marginBottom: 0 }}>
              <label>Old due amount to collect now (₹)</label>
              <input type="number" min="0" max={previousDue.totalDue} value={oldDueAmount} onChange={e => setOldDueAmount(e.target.value)} />
            </div>
          )}
        </div>
      )}

      <div className="field">
        <label>Items</label>
        {lines.map((l, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
            <select style={{ flex: 2 }} value={l.item_id} onChange={e => updateLine(i, { item_id: e.target.value })}>
              <option value="">Item…</option>
              {items.map(it => <option key={it.id} value={it.id}>{it.name} (stock: {it.qty_on_hand})</option>)}
            </select>
            <input style={{ flex: 1 }} type="number" min="1" placeholder="Qty" value={l.qty} onChange={e => updateLine(i, { qty: e.target.value })} />
            <input style={{ flex: 1 }} type="number" min="0" placeholder="Price" value={l.unit_price} onChange={e => updateLine(i, { unit_price: e.target.value })} />
            <button className="btn-ghost" style={{ border: 'none' }} onClick={() => removeLine(i)}>✕</button>
          </div>
        ))}
        <button className="btn btn-ghost" onClick={addLine}>+ Add item line</button>
      </div>

      <div className="card" style={{ background: 'var(--cream-50)', marginBottom: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: trackService ? 10 : 0 }}>
          <input type="checkbox" checked={trackService} onChange={e => setTrackService(e.target.checked)} />
          This sale includes a machine that needs a future service reminder
        </label>
        {trackService && (
          <div className="grid-2" style={{ marginTop: 4 }}>
            <div className="field">
              <label>What was installed</label>
              <input value={serviceLabel} onChange={e => setServiceLabel(e.target.value)} placeholder="e.g. Aquaguard RO Unit" />
            </div>
            <div className="field">
              <label>Service due after (days)</label>
              <input type="number" min="1" value={serviceIntervalDays} onChange={e => setServiceIntervalDays(e.target.value)} />
            </div>
          </div>
        )}
        {trackService && !customerId && (
          <div style={{ color: 'var(--danger)', fontSize: 13 }}>Select a customer above to track their service date.</div>
        )}
      </div>

      <div className="grid-2">
        <div className="field">
          <label>Discount (₹)</label>
          <input type="number" value={discount} onChange={e => setDiscount(e.target.value)} />
        </div>
        <div className="field">
          <label>Payment mode</label>
          <select value={paymentMode} onChange={e => setPaymentMode(e.target.value)}>
            <option>Cash</option><option>UPI</option><option>Card</option><option>Credit</option>
          </select>
        </div>
      </div>

      {paymentMode === 'Credit' && (
        <div className="card" style={{ background: 'var(--cream-50)', marginBottom: 12 }}>
          {!customerId && (
            <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 8 }}>
              Credit sales need a customer selected above (not Walk-in) so the due amount can be tracked.
            </div>
          )}
          <div className="field" style={{ marginBottom: 4 }}>
            <label>Amount received now (₹) — leave 0 if fully on credit</label>
            <input type="number" min="0" value={amountReceived} onChange={e => setAmountReceived(e.target.value)} />
          </div>
          <div className="page-sub">Balance due on this sale: ₹{Math.max(0, total - (Number(amountReceived) || 0)).toLocaleString('en-IN')}</div>
        </div>
      )}

      <div className="card" style={{ background: 'var(--cream-50)', marginBottom: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <input type="checkbox" checked={sendWhatsappNow} onChange={e => setSendWhatsappNow(e.target.checked)} disabled={!customerId} />
          Send this invoice on WhatsApp right after saving
        </label>
        {!customerId && <div className="page-sub" style={{ marginTop: 4 }}>Select a customer above to enable this.</div>}
      </div>

      <div style={{ textAlign: 'right', margin: '10px 0' }}>
        <div style={{ fontSize: 14, color: 'var(--ink-600)' }}>This sale: ₹{total.toLocaleString('en-IN')}</div>
        {collectOldDue && Number(oldDueAmount) > 0 && (
          <div style={{ fontSize: 14, color: 'var(--ink-600)' }}>+ Old due collected: ₹{Number(oldDueAmount).toLocaleString('en-IN')}</div>
        )}
        <div style={{ fontWeight: 700, fontSize: 17 }}>Total to collect: ₹{grandTotalToCollect.toLocaleString('en-IN')}</div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save}>Save & Generate Invoice</button>
      </div>
    </Modal>
  );
}
