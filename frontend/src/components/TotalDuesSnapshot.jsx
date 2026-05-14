import { useState, useMemo } from 'react';
import TransactionModal from './TransactionModal';
import { extractCardLabel, getMonthKey, getAllFYMonths, fmtINR, getUniqueCards } from '../utils/dashboardUtils';

const TH = { padding: '11px 14px', textAlign: 'center', fontWeight: 700, fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderRight: '1px solid rgba(255,255,255,0.05)', whiteSpace: 'nowrap' };
const TD = { padding: '9px 14px', textAlign: 'right', borderRight: '1px solid rgba(255,255,255,0.04)', fontSize: '0.82rem' };

export default function TotalDuesSnapshot({ analyses }) {
  const [modal, setModal] = useState(null);

  // Use multi-year aware months (only months with actual data, sorted by FY)
  const months = useMemo(() => getAllFYMonths(analyses), [analyses]);
  const cards = useMemo(() => getUniqueCards(analyses), [analyses]);

  // matrix[monthKey][cardLabel] = { total: number, transactions: [] }
  const matrix = useMemo(() => {
    const m = {};
    months.forEach(mo => { m[mo.key] = {}; });
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
  }, [analyses, months]);

  const cardTotals = useMemo(() => {
    const ct = {};
    cards.forEach(c => { ct[c] = months.reduce((s, mo) => s + (matrix[mo.key]?.[c]?.total || 0), 0); });
    return ct;
  }, [cards, months, matrix]);

  const monthTotals = useMemo(() => {
    const mt = {};
    months.forEach(mo => { mt[mo.key] = cards.reduce((s, c) => s + (matrix[mo.key]?.[c]?.total || 0), 0); });
    return mt;
  }, [cards, months, matrix]);

  const grandTotal = useMemo(() => cards.reduce((s, c) => s + (cardTotals[c] || 0), 0), [cards, cardTotals]);

  // FY totals per card for the totals-per-FY row
  const fyGroups = useMemo(() => {
    const groups = {};
    months.forEach(mo => {
      const fy = mo.fyLabel;
      if (!groups[fy]) groups[fy] = [];
      groups[fy].push(mo);
    });
    return groups;
  }, [months]);

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
  const FY_BG = 'rgba(99,179,237,0.08)';
  const FY_TEXT = 'var(--blue)';

  // Render rows grouped by FY with a separator header row between FYs
  const fyKeys = Object.keys(fyGroups);
  const multiYear = fyKeys.length > 1;

  return (
    <div>
      <p style={{ marginBottom: 16, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
        Click any amount to view transaction details
      </p>

      <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-primary)' }}>
              <th style={{ ...TH, textAlign: 'left', minWidth: 110 }}>Month</th>
              {cards.map(c => <th key={c} style={{ ...TH, minWidth: 130 }}>{c}</th>)}
              <th style={{ ...TH, background: YELLOW_BG, color: YELLOW_TEXT, minWidth: 110 }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {fyKeys.map(fy => {
              const fyMonths = fyGroups[fy];
              const fyCardTotals = {};
              cards.forEach(c => {
                fyCardTotals[c] = fyMonths.reduce((s, mo) => s + (matrix[mo.key]?.[c]?.total || 0), 0);
              });
              const fyRowTotal = cards.reduce((s, c) => s + (fyCardTotals[c] || 0), 0);

              return [
                // FY separator row (only shown when data spans multiple years)
                multiYear && (
                  <tr key={`fy-sep-${fy}`} style={{ background: FY_BG, borderTop: '2px solid rgba(99,179,237,0.15)', borderBottom: '1px solid rgba(99,179,237,0.15)' }}>
                    <td
                      colSpan={cards.length + 2}
                      style={{ padding: '7px 14px', fontSize: '0.72rem', fontWeight: 700, color: FY_TEXT, textTransform: 'uppercase', letterSpacing: '0.07em' }}
                    >
                      {fy}
                    </td>
                  </tr>
                ),
                // Month rows for this FY
                ...fyMonths.map((mo, ri) => {
                  const rowTotal = monthTotals[mo.key] || 0;
                  return (
                    <tr key={mo.key} style={{ background: ri % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ ...TD, textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{mo.label}</td>
                      {cards.map(c => {
                        const cell = matrix[mo.key]?.[c];
                        const val = cell?.total || 0;
                        return (
                          <td key={c} style={{ ...TD, cursor: val > 0 ? 'pointer' : 'default' }}
                            onClick={() => val > 0 && setModal({ title: `${c} · ${mo.label}`, transactions: cell.transactions })}>
                            {val > 0
                              ? <span style={{ color: BLUE, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, textDecoration: 'underline dotted' }}>{fmtINR(val)}</span>
                              : <span style={{ color: 'var(--text-muted)' }}>-</span>}
                          </td>
                        );
                      })}
                      <td style={{ ...TD, background: YELLOW_BG, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: rowTotal > 0 ? YELLOW_TEXT : 'var(--text-muted)' }}>
                        {fmtINR(rowTotal)}
                      </td>
                    </tr>
                  );
                }),
                // FY subtotal row (only when multi-year)
                multiYear && (
                  <tr key={`fy-total-${fy}`} style={{ background: 'rgba(99,179,237,0.05)', borderTop: '1px solid rgba(99,179,237,0.15)', borderBottom: '2px solid rgba(99,179,237,0.15)' }}>
                    <td style={{ ...TD, textAlign: 'left', fontWeight: 700, color: FY_TEXT, fontSize: '0.75rem' }}>
                      {fy} Total
                    </td>
                    {cards.map(c => (
                      <td key={c} style={{ ...TD, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: fyCardTotals[c] > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {fmtINR(fyCardTotals[c] || 0)}
                      </td>
                    ))}
                    <td style={{ ...TD, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: fyRowTotal > 0 ? YELLOW_TEXT : 'var(--text-muted)' }}>
                      {fmtINR(fyRowTotal)}
                    </td>
                  </tr>
                ),
              ].filter(Boolean);
            })}

            {/* Grand Totals row */}
            <tr style={{ background: YELLOW_BG, borderTop: '2px solid rgba(234,179,8,0.25)' }}>
              <td style={{ ...TD, textAlign: 'left', fontWeight: 800, color: YELLOW_TEXT }}>Grand Total</td>
              {cards.map(c => (
                <td key={c} style={{ ...TD, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: cardTotals[c] > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                  {fmtINR(cardTotals[c] || 0)}
                </td>
              ))}
              <td style={{ ...TD, fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: YELLOW_TEXT }}>{fmtINR(grandTotal)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {modal && <TransactionModal title={modal.title} transactions={modal.transactions} onClose={() => setModal(null)} />}
    </div>
  );
}
