import { useState, useMemo } from 'react';
import TransactionModal from './TransactionModal';
import { extractCardLabel, getMonthKey, fmtINR, getUniqueCards } from '../utils/dashboardUtils';

const TH = { padding: '11px 14px', textAlign: 'center', fontWeight: 700, fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderRight: '1px solid rgba(255,255,255,0.05)', whiteSpace: 'nowrap' };
const TD = { padding: '9px 14px', textAlign: 'right', borderRight: '1px solid rgba(255,255,255,0.04)', fontSize: '0.82rem' };

export default function TotalDuesSnapshot({ analyses }) {
  const [modal, setModal] = useState(null);
  const [groupBy, setGroupBy] = useState('calendar'); // 'calendar' | 'fiscal'

  // Build strict chronological month objects directly from the analysis transaction dates
  const chronologicalMonths = useMemo(() => {
    const activeKeys = new Set();
    analyses.forEach(a => {
      (a.result_json?.transactions || []).forEach(t => {
        const mk = getMonthKey(t.date);
        if (mk) activeKeys.add(mk);
      });
    });

    // Sort key strings chronologically ("YYYY-MM")
    const sortedKeys = Array.from(activeKeys).sort();

    return sortedKeys.map(key => {
      const [yearStr, monthStr] = key.split('-');
      const year = Number(yearStr);
      const monthIndex = Number(monthStr) - 1;
      const label = `${monthStr}-${year}`;
      
      // Compute Fiscal Year: Apr-Mar (starts in year if monthIndex >= 3, else year - 1)
      const fyStart = monthIndex >= 3 ? year : year - 1;
      const fyLabel = `FY${String(fyStart).slice(2)}-${String(fyStart + 1).slice(2)}`;

      return {
        key,
        year,
        monthIndex,
        label,
        fyLabel
      };
    });
  }, [analyses]);

  const cards = useMemo(() => getUniqueCards(analyses), [analyses]);

  // matrix[monthKey][cardLabel] = { total: number, transactions: [] }
  const matrix = useMemo(() => {
    const m = {};
    chronologicalMonths.forEach(mo => { m[mo.key] = {}; });
    analyses.forEach(a => {
      const card = extractCardLabel(a);
      (a.result_json?.transactions || []).forEach(t => {
        const mk = getMonthKey(t.date);
        if (!mk || !m[mk]) return;
        if (!m[mk][card]) m[mk][card] = { total: 0, transactions: [] };
        m[mk][card].transactions.push(t);
        if (t.type === 'debit') m[mk][card].total += Number(t.amount) || 0;
      });
    });
    return m;
  }, [analyses, chronologicalMonths]);

  const cardTotals = useMemo(() => {
    const ct = {};
    cards.forEach(c => { ct[c] = chronologicalMonths.reduce((s, mo) => s + (matrix[mo.key]?.[c]?.total || 0), 0); });
    return ct;
  }, [cards, chronologicalMonths, matrix]);

  const monthTotals = useMemo(() => {
    const mt = {};
    chronologicalMonths.forEach(mo => { mt[mo.key] = cards.reduce((s, c) => s + (matrix[mo.key]?.[c]?.total || 0), 0); });
    return mt;
  }, [cards, chronologicalMonths, matrix]);

  const grandTotal = useMemo(() => cards.reduce((s, c) => s + (cardTotals[c] || 0), 0), [cards, cardTotals]);

  // Dynamic grouping based on active mode (Calendar vs Fiscal)
  const groups = useMemo(() => {
    const g = {};
    chronologicalMonths.forEach(mo => {
      const key = groupBy === 'fiscal' ? mo.fyLabel : `Year ${mo.year}`;
      if (!g[key]) g[key] = [];
      g[key].push(mo);
    });
    return g;
  }, [chronologicalMonths, groupBy]);

  if (!analyses.length) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <p className="text-muted">No analyses found. Upload a credit card statement to begin.</p>
      </div>
    );
  }

  const YELLOW_BG = 'rgba(234,179,8,0.12)';
  const YELLOW_TEXT = '#eab308';
  const BLUE = 'var(--blue)';
  
  // High-contrast solid group header background colors for premium glass scroll styling
  const GROUP_BG = groupBy === 'fiscal' ? '#131e2e' : '#171426';
  const GROUP_TEXT = groupBy === 'fiscal' ? 'var(--blue)' : 'var(--purple)';
  const showSeparators = Object.keys(groups).length > 1 || groupBy === 'fiscal';

  // Sticky TH helpers
  const stickyHeaderTh = (isLeft = false) => ({
    ...TH,
    position: 'sticky',
    top: 0,
    left: isLeft ? 0 : undefined,
    zIndex: isLeft ? 12 : 10,
    background: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border-subtle)',
  });

  // Sticky Month TD helper with stripe backgrounds for vertical/horizontal scroll overlap opaque masking
  const stickyMonthTd = (ri) => {
    const bg = ri % 2 === 0 ? 'var(--bg-card)' : '#171e2e';
    return {
      ...TD,
      textAlign: 'left',
      fontWeight: 600,
      color: 'var(--text-secondary)',
      fontSize: '0.82rem',
      position: 'sticky',
      left: 0,
      zIndex: 8,
      background: bg,
      borderBottom: '1px solid rgba(255,255,255,0.04)',
    };
  };

  const rowTd = () => ({
    ...TD,
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  });

  return (
    <div>
      {/* Selector Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          Click any amount to view transaction details
        </p>
        
        {/* Toggle between Calendar Year & Fiscal Year */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-card)', padding: '3px 4px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
          <button 
            onClick={() => setGroupBy('calendar')}
            style={{
              padding: '6px 12px',
              fontSize: '0.78rem',
              fontWeight: groupBy === 'calendar' ? 700 : 500,
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              background: groupBy === 'calendar' ? 'var(--bg-primary)' : 'transparent',
              color: groupBy === 'calendar' ? 'var(--blue)' : 'var(--text-muted)',
              transition: 'all 0.2s',
              boxShadow: groupBy === 'calendar' ? '0 2px 6px rgba(0,0,0,0.15)' : 'none'
            }}
          >
            Calendar Year
          </button>
          <button 
            onClick={() => setGroupBy('fiscal')}
            style={{
              padding: '6px 12px',
              fontSize: '0.78rem',
              fontWeight: groupBy === 'fiscal' ? 700 : 500,
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              background: groupBy === 'fiscal' ? 'var(--bg-primary)' : 'transparent',
              color: groupBy === 'fiscal' ? 'var(--blue)' : 'var(--text-muted)',
              transition: 'all 0.2s',
              boxShadow: groupBy === 'fiscal' ? '0 2px 6px rgba(0,0,0,0.15)' : 'none'
            }}
          >
            Fiscal Year (Apr-Mar)
          </button>
        </div>
      </div>

      {/* Height Optimized Scroll Wrapper */}
      <div style={{
        maxHeight: '440px',
        overflowY: 'auto',
        overflowX: 'auto',
        borderRadius: 12,
        border: '1px solid var(--border-subtle)',
        background: 'var(--bg-card)'
      }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr style={{ background: 'var(--bg-secondary)' }}>
              <th style={stickyHeaderTh(true)}>Month</th>
              {cards.map(c => <th key={c} style={stickyHeaderTh(false)}>{c}</th>)}
              <th style={{ ...stickyHeaderTh(false), background: 'rgba(234,179,8,0.15)', color: YELLOW_TEXT }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {Object.keys(groups).map(groupKey => {
              const groupMonths = groups[groupKey];
              const groupCardTotals = {};
              cards.forEach(c => {
                groupCardTotals[c] = groupMonths.reduce((s, mo) => s + (matrix[mo.key]?.[c]?.total || 0), 0);
              });
              const groupRowTotal = cards.reduce((s, c) => s + (groupCardTotals[c] || 0), 0);

              return [
                // Group separator row (e.g. Year 2025 or FY25-26)
                showSeparators && (
                  <tr key={`group-sep-${groupKey}`} style={{ background: GROUP_BG }}>
                    <td
                      colSpan={cards.length + 2}
                      style={{
                        padding: '7px 14px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: GROUP_TEXT,
                        textTransform: 'uppercase',
                        letterSpacing: '0.07em',
                        position: 'sticky',
                        left: 0,
                        zIndex: 9,
                        background: GROUP_BG,
                        borderBottom: '1px solid rgba(255,255,255,0.03)',
                        borderTop: '1px solid rgba(255,255,255,0.03)',
                      }}
                    >
                      {groupKey}
                    </td>
                  </tr>
                ),
                // Month rows inside this group
                ...groupMonths.map((mo, ri) => {
                  const rowTotal = monthTotals[mo.key] || 0;
                  const rowBg = ri % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)';
                  return (
                    <tr key={mo.key} style={{ background: rowBg }}>
                      <td style={stickyMonthTd(ri)}>{mo.label}</td>
                      {cards.map(c => {
                        const cell = matrix[mo.key]?.[c];
                        const val = cell?.total || 0;
                        return (
                          <td key={c} style={{ ...rowTd(ri), cursor: val > 0 ? 'pointer' : 'default' }}
                            onClick={() => val > 0 && setModal({ title: `${c} · ${mo.label}`, transactions: cell.transactions })}>
                            {val > 0
                              ? <span style={{ color: BLUE, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, textDecoration: 'underline dotted' }}>{fmtINR(val)}</span>
                              : <span style={{ color: 'var(--text-muted)' }}>-</span>}
                          </td>
                        );
                      })}
                      <td style={{ ...rowTd(ri), background: YELLOW_BG, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: rowTotal > 0 ? YELLOW_TEXT : 'var(--text-muted)' }}>
                        {fmtINR(rowTotal)}
                      </td>
                    </tr>
                  );
                }),
                // Group subtotal row
                showSeparators && (
                  <tr key={`group-total-${groupKey}`} style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <td style={{
                      ...TD,
                      textAlign: 'left',
                      fontWeight: 700,
                      color: GROUP_TEXT,
                      fontSize: '0.75rem',
                      position: 'sticky',
                      left: 0,
                      zIndex: 8,
                      background: '#161b28',
                      borderBottom: '2px solid rgba(255,255,255,0.05)',
                      borderTop: '1px solid rgba(255,255,255,0.04)',
                    }}>
                      {groupKey} Total
                    </td>
                    {cards.map(c => (
                      <td key={c} style={{
                        ...TD,
                        fontFamily: 'JetBrains Mono, monospace',
                        fontWeight: 700,
                        color: groupCardTotals[c] > 0 ? 'var(--text-primary)' : 'var(--text-muted)',
                        borderBottom: '2px solid rgba(255,255,255,0.05)',
                        borderTop: '1px solid rgba(255,255,255,0.04)',
                      }}>
                        {fmtINR(groupCardTotals[c] || 0)}
                      </td>
                    ))}
                    <td style={{
                      ...TD,
                      fontFamily: 'JetBrains Mono, monospace',
                      fontWeight: 700,
                      color: groupRowTotal > 0 ? YELLOW_TEXT : 'var(--text-muted)',
                      borderBottom: '2px solid rgba(255,255,255,0.05)',
                      borderTop: '1px solid rgba(255,255,255,0.04)',
                    }}>
                      {fmtINR(groupRowTotal)}
                    </td>
                  </tr>
                ),
              ].filter(Boolean);
            })}

            {/* Grand Totals row - sticky at bottom */}
            <tr style={{ background: '#1e1c15' }}>
              <td style={{
                ...TD,
                textAlign: 'left',
                fontWeight: 800,
                color: YELLOW_TEXT,
                position: 'sticky',
                bottom: 0,
                left: 0,
                zIndex: 10,
                background: '#1e1c15',
                borderTop: '2px solid rgba(234,179,8,0.25)',
              }}>
                Grand Total
              </td>
              {cards.map(c => (
                <td key={c} style={{
                  ...TD,
                  fontFamily: 'JetBrains Mono, monospace',
                  fontWeight: 700,
                  color: cardTotals[c] > 0 ? 'var(--text-primary)' : 'var(--text-muted)',
                  position: 'sticky',
                  bottom: 0,
                  zIndex: 9,
                  background: '#1e1c15',
                  borderTop: '2px solid rgba(234,179,8,0.25)',
                }}>
                  {fmtINR(cardTotals[c] || 0)}
                </td>
              ))}
              <td style={{
                ...TD,
                fontFamily: 'JetBrains Mono, monospace',
                fontWeight: 800,
                color: YELLOW_TEXT,
                position: 'sticky',
                bottom: 0,
                zIndex: 9,
                background: '#1e1c15',
                borderTop: '2px solid rgba(234,179,8,0.25)',
              }}>
                {fmtINR(grandTotal)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {modal && <TransactionModal title={modal.title} transactions={modal.transactions} onClose={() => setModal(null)} />}
    </div>
  );
}


