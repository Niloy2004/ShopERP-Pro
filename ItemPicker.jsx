import React, { useState, useEffect, useRef } from 'react';

export default function ItemPicker({ items, value, onSelect, placeholder = 'Search item…', extraLabel }) {
  const selected = items.find(it => String(it.id) === String(value));
  const [text, setText] = useState(selected ? selected.name : '');
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  // when an item gets selected (from the list, or from outside), show its name
  useEffect(() => {
    const current = items.find(it => String(it.id) === String(value));
    if (current) setText(current.name);
  }, [value, items]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const q = text.trim().toLowerCase();
  const filtered = q
    ? items.filter(it => it.name.toLowerCase().includes(q) || (it.sku || '').toLowerCase().includes(q))
    : items;

  const pick = (item) => {
    onSelect(String(item.id));
    setText(item.name);
    setOpen(false);
  };

  return (
    <div ref={boxRef} style={{ position: 'relative', flex: 2 }}>
      <input
        style={{ width: '100%' }}
        placeholder={placeholder}
        value={text}
        onFocus={() => setOpen(true)}
        onChange={e => { setText(e.target.value); setOpen(true); if (value) onSelect(''); }}
      />
      {open && (
        <div style={{
          position: 'absolute', top: '105%', left: 0, right: 0, maxHeight: 260, overflowY: 'auto',
          background: '#fff', border: '1px solid var(--line)', borderRadius: 8,
          boxShadow: '0 10px 28px rgba(0,0,0,0.18)', zIndex: 50
        }}>
          {filtered.length === 0 && (
            <div className="page-sub" style={{ padding: 10 }}>No items match "{text}"</div>
          )}
          {filtered.map(it => (
            <div
              key={it.id}
              onClick={() => pick(it)}
              style={{ padding: '8px 10px', cursor: 'pointer', fontSize: 14 }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--cream-100)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div>{it.name}</div>
              <div className="page-sub" style={{ marginTop: 0, fontSize: 12 }}>
                {extraLabel ? extraLabel(it) : (it.sku || '')}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
