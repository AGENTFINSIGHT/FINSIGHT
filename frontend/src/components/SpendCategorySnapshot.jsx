import { useState, useMemo } from 'react';
import { Plus, X, ChevronDown, ChevronUp } from 'lucide-react';
import TransactionModal from './TransactionModal';
import { extractCardLabel, fmtINR, getUniqueCards, getMonthKey } from '../utils/dashboardUtils';

const CUSTOM_KEY = 'finsight_custom_categories';

// [Type, Category, Keywords[]]
const BASE_CATEGORIES = [
  ['Discretionary',     'Amazon',             ['amazon', 'amzn']],
  ['Discretionary',     'Flipkart',           ['flipkart']],
  ['Discretionary',     'Zomata',             ['zomato', 'zomata']],
  ['Discretionary',     'Swiggy',             ['swiggy']],
  ['Non-Discretionary', 'TNEB',              ['tneb', 'tangedco', 'electricity board']],
  ['Non-Discretionary', 'Ins Premium',       ['insurance', 'ins premium', 'lic ', 'star health', 'bajaj allianz', 'care health']],
  ['Semi-Discretionary','Fruits & Veggies',  ['fruits', 'vegetable', 'veggie', 'veggies']],
  ['Semi-Discretionary','Mutton & Fish',     ['mutton', 'fish', 'chicken', 'seafood', 'meat shop']],
  ['Discretionary',     'Restaurant',        ['restaurant', 'cafe', 'bistro', 'dhaba', 'eatery', 'food court']],
  ['Non-Discretionary', 'Medicines',         ['medicine', 'pharmacy', 'apollo pharmacy', 'medplus', 'drug store']],
  ['Non-Discretionary', 'Fuel',              ['fuel', 'petrol', 'diesel', 'hpcl', 'bpcl', 'iocl', 'bharat petroleum', 'indian oil']],
  ['Semi-Discretionary','Groceries',         ['grocery', 'groceries', 'supermarket', 'big bazaar', 'dmart', 'reliance fresh', 'nilgiris']],
  ['Discretionary',     'Sweets & Savories', ['sweets', 'savories', 'bakery', 'confectionery', 'mithai']],
  ['Discretionary',     'Foreign Spend',     ['intl#', 'foreign currency', 'forex']],
  ['Non-Discretionary', 'Milk',              ['milk', 'dairy', 'aavin', 'amul']],
  ['Discretionary',     'Online Subscriptions', ['netflix', 'spotify', 'apple music', 'prime video']],
  ['Non-Discretionary', 'Airtel Mobile Bills', ['airtel']],
  ['Non-Discretionary', 'Property Tax',     ['property tax', 'municipal tax', 'ghmc']],
  ['Discretionary',     'OTT Subscriptions', ['hotstar', 'disney', 'sony liv', 'zee5', 'jio cinema']],
  ['Non-Discretionary', 'Hathway',          ['hathway', 'broadband']],
  ['Discretionary',     'Hotel Stay',       ['oyo', 'treebo', 'resort', 'inn ']],
  ['Discretionary',     'PVR Movie Tickets',['pvr', 'inox', 'cinepolis', 'movie ticket']],
  ['Discretionary',     'PVR F&B',          ['pvr food', 'cinepolis food']],
  ['Discretionary',     'Clothes',          ['myntra', 'ajio', 'zara', 'h&m', 'lifestyle', 'pantaloons', 'max fashion']],
  ['Non-Discretionary', 'CC Fees',          ['annual fee', 'finance charge', 'late payment fee', 'joining fee']],
  ['Non-Discretionary', 'GNZ GST Payment',  ['gst payment', 'gnz gst']],
  ['Discretionary',     'Flight Booking',   ['indigo', 'air india', 'spicejet', 'akasa', 'vistara', 'airline']],
  ['Discretionary',     'Others',           []],
];

const TYPE_COLOR = { 'Discretionary': 'var(--blue)', 'Non-Discretionary': 'var(--red)', 'Semi-Discretionary': 'var(--purple)' };

function matchCategory(description, keywords) {
  if (!keywords.length) return false;
  const lower = description.toLowerCase();
  return keywords.some(k => lower.includes(k.toLowerCase()));
}

const TH = { padding: '10px 12px', fontWeight: 700, fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', borderRight: '1px solid rgba(255,255,255,0.05)', textAlign: 'center', whiteSpace: 'nowrap' };
const TD = { padding: '8px 12px', fontSize: '0.8rem', borderRight: '1px solid rgba(255,255,255,0.04)', textAlign: 'right' };

const INSIGHT_SECTIONS = [
  { key: 'top100',    title: 'Top 100 High Value Single Transactions' },
  { key: 'recurring', title: 'Monthly Recurring Transactions by Same Value' },
  { key: 'amazon',    title: 'Amazon & Flipkart Spend Transactions' },
  { key: 'zomato',    title: 'Zomato & Swiggy Spend Transactions' },
];

export default function SpendCategorySnapshot({ analyses }) {
  const [modal, setModal] = useState(null);
  const [customCats, setCustomCats] = useState(() => {
    try { return JSON.parse(localStorage.getItem(CUSTOM_KEY) || '[]'); } catch { return []; }
  });
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'Discretionary', keywords: '' });
  const [openInsights, setOpenInsights] = useState({});

  const allCategories = useMemo(() => [
    ...BASE_CATEGORIES,
    ...customCats.map(c => [c.type, c.name, c.keywords]),
  ], [customCats]);

  // getUniqueCards uses normalizeCardLabel internally — same card across different
  // uploads/years will collapse to one canonical column (e.g. XXXX-8805)
  const cards = useMemo(() => getUniqueCards(analyses), [analyses]);

  // All debit transactions across all analyses with card label attached
  const allTxns = useMemo(() =>
    analyses.flatMap(a =>
      (a.result_json?.transactions || []).map(t => ({
        ...t,
        cardLabel: extractCardLabel(a),
      }))
    ), [analyses]);

  // matrix[catName][cardLabel] = { total, transactions }
  const matrix = useMemo(() => {
    const m = {};
    allCategories.forEach(([, cat]) => {
      m[cat] = {};
      cards.forEach(c => { m[cat][c] = { total: 0, transactions: [] }; });
    });

    allTxns.forEach(t => {
      if (t.type !== 'debit') return;
      for (const [, cat, keywords] of allCategories) {
        if (cat === 'Others') continue;
        if (matchCategory(t.description, keywords)) {
          if (m[cat]?.[t.cardLabel]) {
            m[cat][t.cardLabel].total += Number(t.amount) || 0;
            m[cat][t.cardLabel].transactions.push(t);
          }
          return;
        }
      }
      // Falls to Others
      if (m['Others']?.[t.cardLabel]) {
        m['Others'][t.cardLabel].total += Number(t.amount) || 0;
        m['Others'][t.cardLabel].transactions.push(t);
      }
    });
    return m;
  }, [allCategories, allTxns, cards]);

  const catTotals = useMemo(() => {
    const ct = {};
    allCategories.forEach(([, cat]) => {
      ct[cat] = cards.reduce((s, c) => s + (matrix[cat]?.[c]?.total || 0), 0);
    });
    return ct;
  }, [allCategories, cards, matrix]);

  const colTotals = useMemo(() => {
    const ct = {};
    cards.forEach(c => {
      ct[c] = allCategories.reduce((s, [, cat]) => s + (matrix[cat]?.[c]?.total || 0), 0);
    });
    return ct;
  }, [allCategories, cards, matrix]);

  const grandTotal = cards.reduce((s, c) => s + (colTotals[c] || 0), 0);

  // Insight data
  const insightData = useMemo(() => {
    const debits = allTxns.filter(t => t.type === 'debit');
    const top100 = [...debits].sort((a, b) => Number(b.amount) - Number(a.amount)).slice(0, 100);
    const amazonFlipkart = debits.filter(t => matchCategory(t.description, ['amazon', 'amzn', 'flipkart']));
    const zomatoSwiggy = debits.filter(t => matchCategory(t.description, ['zomato', 'zomata', 'swiggy']));

    // Recurring: same description + same amount appearing in multiple months
    const recurMap = {};
    debits.forEach(t => {
      const mk = getMonthKey(t.date);
      const key = `${t.description.toLowerCase().trim()}__${Number(t.amount).toFixed(2)}`;
      if (!recurMap[key]) recurMap[key] = { txns: [], months: new Set() };
      recurMap[key].txns.push(t);
      if (mk) recurMap[key].months.add(mk);
    });
    const recurring = Object.values(recurMap).filter(v => v.months.size >= 2).flatMap(v => v.txns).sort((a, b) => Number(b.amount) - Number(a.amount));

    return { top100, recurring, amazon: amazonFlipkart, zomato: zomatoSwiggy };
  }, [allTxns]);

  const addCategory = () => {
    if (!form.name.trim()) return;
    const keywords = form.keywords.split(',').map(k => k.trim()).filter(Boolean);
    const newCat = { name: form.name.trim(), type: form.type, keywords };
    const updated = [...customCats, newCat];
    setCustomCats(updated);
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(updated));
    setForm({ name: '', type: 'Discretionary', keywords: '' });
    setAddOpen(false);
  };

  const removeCustomCat = (name) => {
    const updated = customCats.filter(c => c.name !== name);
    setCustomCats(updated);
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(updated));
  };

  const YELLOW_BG = 'rgba(234,179,8,0.12)';
  const YELLOW_TEXT = '#eab308';
  const BLUE = 'var(--blue)';
  const isCustom = (cat) => customCats.some(c => c.name === cat);

  return (
    <div>
      {/* ── Main Category Table ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>Click any amount to view transactions for that category</p>
        <button className="btn btn-ghost btn-sm" onClick={() => setAddOpen(v => !v)} style={{ gap: 6 }}>
          <Plus size={13} /> Add Category
        </button>
      </div>

      {/* Add category form */}
      {addOpen && (
        <div className="card" style={{ padding: 20, marginBottom: 20, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label className="text-xs text-muted" style={{ display: 'block', marginBottom: 6 }}>Category Name</label>
            <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Gym" style={{ width: '100%' }} />
          </div>
          <div style={{ minWidth: 160 }}>
            <label className="text-xs text-muted" style={{ display: 'block', marginBottom: 6 }}>Type</label>
            <select className="input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} style={{ width: '100%' }}>
              <option>Discretionary</option>
              <option>Non-Discretionary</option>
              <option>Semi-Discretionary</option>
            </select>
          </div>
          <div style={{ flex: 2, minWidth: 200 }}>
            <label className="text-xs text-muted" style={{ display: 'block', marginBottom: 6 }}>Keywords (comma separated)</label>
            <input className="input" value={form.keywords} onChange={e => setForm(f => ({ ...f, keywords: e.target.value }))} placeholder="e.g. gym, fitness, cult fit" style={{ width: '100%' }} />
          </div>
          <button className="btn btn-primary btn-sm" onClick={addCategory}>Add</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setAddOpen(false)}><X size={13} /></button>
        </div>
      )}

      <div style={{
        maxHeight: '440px',
        overflowY: 'auto',
        overflowX: 'auto',
        borderRadius: 12,
        border: '1px solid var(--border-subtle)',
        background: 'var(--bg-card)',
        position: 'relative'
      }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr style={{ background: 'var(--bg-secondary)' }}>
              <th style={{
                ...TH,
                textAlign: 'left',
                position: 'sticky',
                left: 0,
                top: 0,
                zIndex: 12,
                background: 'var(--bg-secondary)',
                borderBottom: '1px solid var(--border-subtle)',
                width: 130,
                minWidth: 130,
                maxWidth: 130
              }}>Type</th>
              <th style={{
                ...TH,
                textAlign: 'left',
                position: 'sticky',
                left: 130,
                top: 0,
                zIndex: 12,
                background: 'var(--bg-secondary)',
                borderBottom: '1px solid var(--border-subtle)',
                width: 160,
                minWidth: 160,
                maxWidth: 160
              }}>Spend Category</th>
              {cards.map(c => (
                <th
                  key={c}
                  style={{
                    ...TH,
                    position: 'sticky',
                    top: 0,
                    zIndex: 10,
                    background: 'var(--bg-secondary)',
                    borderBottom: '1px solid var(--border-subtle)',
                    minWidth: 120
                  }}
                >
                  {c}
                </th>
              ))}
              <th style={{
                ...TH,
                position: 'sticky',
                top: 0,
                zIndex: 10,
                background: 'var(--bg-secondary)',
                borderBottom: '1px solid var(--border-subtle)',
                color: YELLOW_TEXT,
                minWidth: 100
              }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {allCategories.map(([type, cat], ri) => {
              const rowTotal = catTotals[cat] || 0;
              const typeColor = TYPE_COLOR[type] || 'var(--text-muted)';
              const rowBg = ri % 2 === 0 ? 'var(--bg-card)' : '#171e2e';
              return (
                <tr key={cat} style={{ background: ri % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                  <td style={{
                    ...TD,
                    textAlign: 'left',
                    position: 'sticky',
                    left: 0,
                    zIndex: 8,
                    background: rowBg,
                    width: 130,
                    minWidth: 130,
                    maxWidth: 130,
                    borderBottom: '1px solid rgba(255,255,255,0.04)'
                  }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: typeColor, background: `${typeColor}18`, padding: '2px 8px', borderRadius: 99, whiteSpace: 'nowrap' }}>{type}</span>
                  </td>
                  <td style={{
                    ...TD,
                    textAlign: 'left',
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                    position: 'sticky',
                    left: 130,
                    zIndex: 8,
                    background: rowBg,
                    width: 160,
                    minWidth: 160,
                    maxWidth: 160,
                    borderBottom: '1px solid rgba(255,255,255,0.04)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {cat}
                      {isCustom(cat) && (
                        <button onClick={() => removeCustomCat(cat)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex', alignItems: 'center' }}>
                          <X size={11} />
                        </button>
                      )}
                    </div>
                  </td>
                  {cards.map(c => {
                    const cell = matrix[cat]?.[c];
                    const val = cell?.total || 0;
                    return (
                      <td key={c} style={{ ...TD, cursor: val > 0 ? 'pointer' : 'default', borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                        onClick={() => val > 0 && setModal({ title: `${cat} · ${c}`, transactions: cell.transactions })}>
                        {val > 0
                          ? <span style={{ color: BLUE, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, textDecoration: 'underline dotted' }}>{fmtINR(val)}</span>
                          : <span style={{ color: 'var(--text-muted)' }}>-</span>}
                      </td>
                    );
                  })}
                  <td style={{
                    ...TD,
                    background: YELLOW_BG,
                    fontFamily: 'JetBrains Mono, monospace',
                    fontWeight: 700,
                    color: rowTotal > 0 ? YELLOW_TEXT : 'var(--text-muted)',
                    borderBottom: '1px solid rgba(255,255,255,0.04)'
                  }}>
                    {fmtINR(rowTotal)}
                  </td>
                </tr>
              );
            })}
            {/* Totals row - sticky at bottom */}
            <tr style={{ background: '#1e1c15' }}>
              <td style={{
                ...TD,
                textAlign: 'left',
                position: 'sticky',
                bottom: 0,
                left: 0,
                zIndex: 12,
                background: '#1e1c15',
                borderTop: '2px solid rgba(234,179,8,0.25)',
                width: 130,
                minWidth: 130,
                maxWidth: 130
              }} />
              <td style={{
                ...TD,
                textAlign: 'left',
                fontWeight: 800,
                color: YELLOW_TEXT,
                position: 'sticky',
                bottom: 0,
                left: 130,
                zIndex: 12,
                background: '#1e1c15',
                borderTop: '2px solid rgba(234,179,8,0.25)',
                width: 160,
                minWidth: 160,
                maxWidth: 160
              }}>Total</td>
              {cards.map(c => (
                <td key={c} style={{
                  ...TD,
                  fontFamily: 'JetBrains Mono, monospace',
                  fontWeight: 700,
                  color: colTotals[c] > 0 ? 'var(--text-primary)' : 'var(--text-muted)',
                  position: 'sticky',
                  bottom: 0,
                  zIndex: 10,
                  background: '#1e1c15',
                  borderTop: '2px solid rgba(234,179,8,0.25)',
                }}>
                  {fmtINR(colTotals[c] || 0)}
                </td>
              ))}
              <td style={{
                ...TD,
                fontFamily: 'JetBrains Mono, monospace',
                fontWeight: 800,
                color: YELLOW_TEXT,
                position: 'sticky',
                bottom: 0,
                zIndex: 10,
                background: '#1e1c15',
                borderTop: '2px solid rgba(234,179,8,0.25)',
              }}>{fmtINR(grandTotal)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Insight Sections ── */}
      <div style={{ marginTop: 40, display: 'flex', flexDirection: 'column', gap: 24 }}>
        {INSIGHT_SECTIONS.map(sec => {
          const data = insightData[sec.key] || [];
          const isOpen = openInsights[sec.key] !== false;
          return (
            <div key={sec.key} className="card" style={{ overflow: 'hidden' }}>
              <div
                onClick={() => setOpenInsights(s => ({ ...s, [sec.key]: !isOpen }))}
                style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: 'rgba(99,179,237,0.06)', borderBottom: isOpen ? '1px solid var(--border-subtle)' : 'none' }}
              >
                <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>{sec.title}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="text-xs text-muted">{data.length} transaction{data.length !== 1 ? 's' : ''}</span>
                  {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                </div>
              </div>
              {isOpen && (
                <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card)' }}>
                      <tr>
                        <th style={{ ...TH, textAlign: 'left', width: 80 }}>Card</th>
                        <th style={{ ...TH, textAlign: 'left', width: 100 }}>Date</th>
                        <th style={{ ...TH, textAlign: 'left' }}>Transaction Details</th>
                        <th style={{ ...TH, textAlign: 'right', width: 120 }}>Value (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.length === 0 ? (
                        <tr><td colSpan={4} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>No transactions found</td></tr>
                      ) : data.map((t, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                          <td style={{ ...TD, textAlign: 'left', fontSize: '0.72rem', color: 'var(--text-muted)' }}>{t.cardLabel}</td>
                          <td style={{ ...TD, textAlign: 'left', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{t.date}</td>
                          <td style={{ ...TD, textAlign: 'left' }}>{t.description}</td>
                          <td style={{ ...TD, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {Number(t.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {modal && <TransactionModal title={modal.title} transactions={modal.transactions} onClose={() => setModal(null)} />}
    </div>
  );
}
