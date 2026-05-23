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

  // ── Styled Excel Export ────────────────────────────────────────
  const exportExcel = async () => {
    const XLSX = (await import('xlsx-js-style')).default;

    // ── Style Definitions ──────────────────────────────────────
    const INR_FMT = '#,##0.00';

    const headerStyle = {
      font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11, name: 'Calibri' },
      fill: { fgColor: { rgb: '1B2A4A' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: {
        top:    { style: 'thin', color: { rgb: '3B5998' } },
        bottom: { style: 'thin', color: { rgb: '3B5998' } },
        left:   { style: 'thin', color: { rgb: '3B5998' } },
        right:  { style: 'thin', color: { rgb: '3B5998' } },
      },
    };

    const headerTotalStyle = {
      ...headerStyle,
      fill: { fgColor: { rgb: '92600A' } },
      font: { bold: true, color: { rgb: 'FFD700' }, sz: 11, name: 'Calibri' },
    };

    const groupSepStyle = {
      font: { bold: true, color: { rgb: '4A90D9' }, sz: 10, name: 'Calibri' },
      fill: { fgColor: { rgb: 'E8EFF8' } },
      alignment: { horizontal: 'left' },
      border: {
        bottom: { style: 'thin', color: { rgb: 'B0C4DE' } },
      },
    };

    const dataStyle = (isAlt) => ({
      font: { sz: 10, name: 'Calibri', color: { rgb: '2D2D2D' } },
      fill: isAlt ? { fgColor: { rgb: 'F5F7FA' } } : { fgColor: { rgb: 'FFFFFF' } },
      alignment: { horizontal: 'right' },
      numFmt: INR_FMT,
      border: {
        bottom: { style: 'hair', color: { rgb: 'D0D5DD' } },
        left:   { style: 'hair', color: { rgb: 'E5E7EB' } },
        right:  { style: 'hair', color: { rgb: 'E5E7EB' } },
      },
    });

    const monthCellStyle = (isAlt) => ({
      ...dataStyle(isAlt),
      font: { sz: 10, name: 'Calibri', bold: true, color: { rgb: '374151' } },
      alignment: { horizontal: 'left' },
      numFmt: '@',
    });

    const dataTotalStyle = (isAlt) => ({
      ...dataStyle(isAlt),
      font: { sz: 10, name: 'Calibri', bold: true, color: { rgb: 'B45309' } },
      fill: isAlt ? { fgColor: { rgb: 'FEF3C7' } } : { fgColor: { rgb: 'FFFBEB' } },
    });

    const subtotalStyle = {
      font: { bold: true, sz: 10, name: 'Calibri', color: { rgb: '1E40AF' } },
      fill: { fgColor: { rgb: 'DBEAFE' } },
      alignment: { horizontal: 'right' },
      numFmt: INR_FMT,
      border: {
        top:    { style: 'thin', color: { rgb: '93C5FD' } },
        bottom: { style: 'medium', color: { rgb: '60A5FA' } },
        left:   { style: 'thin', color: { rgb: 'BFDBFE' } },
        right:  { style: 'thin', color: { rgb: 'BFDBFE' } },
      },
    };

    const subtotalLabelStyle = {
      ...subtotalStyle,
      alignment: { horizontal: 'left' },
      numFmt: '@',
    };

    const grandStyle = {
      font: { bold: true, sz: 11, name: 'Calibri', color: { rgb: '78350F' } },
      fill: { fgColor: { rgb: 'FDE68A' } },
      alignment: { horizontal: 'right' },
      numFmt: INR_FMT,
      border: {
        top:    { style: 'medium', color: { rgb: 'F59E0B' } },
        bottom: { style: 'medium', color: { rgb: 'D97706' } },
        left:   { style: 'thin',   color: { rgb: 'FCD34D' } },
        right:  { style: 'thin',   color: { rgb: 'FCD34D' } },
      },
    };

    const grandLabelStyle = {
      ...grandStyle,
      font: { bold: true, sz: 11, name: 'Calibri', color: { rgb: '92400E' } },
      alignment: { horizontal: 'left' },
      numFmt: '@',
    };

    // ── Build Rows ─────────────────────────────────────────────
    const wsData = [];
    const colCount = cards.length + 2; // Month + cards + Total

    // Title Row
    wsData.push([{
      v: `FinSight AI — Total Dues Snapshot (${groupBy === 'fiscal' ? 'Fiscal Year' : 'Calendar Year'})`,
      s: {
        font: { bold: true, sz: 14, name: 'Calibri', color: { rgb: '1B2A4A' } },
        alignment: { horizontal: 'left' },
      },
    }]);

    // Subtitle Row
    wsData.push([{
      v: `Generated on ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} at ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`,
      s: {
        font: { sz: 9, name: 'Calibri', color: { rgb: '6B7280' }, italic: true },
      },
    }]);

    // Empty row
    wsData.push([]);

    // Header row
    const headerRow = [
      { v: 'Month', s: headerStyle },
      ...cards.map(c => ({ v: c, s: headerStyle })),
      { v: 'Total', s: headerTotalStyle },
    ];
    wsData.push(headerRow);

    // Data rows
    Object.keys(groups).forEach(groupKey => {
      const groupMonths = groups[groupKey];

      // Group separator row
      if (showSeparators) {
        const sepRow = [{ v: groupKey, s: groupSepStyle }];
        for (let i = 1; i < colCount; i++) sepRow.push({ v: '', s: groupSepStyle });
        wsData.push(sepRow);
      }

      // Month rows
      groupMonths.forEach((mo, ri) => {
        const isAlt = ri % 2 !== 0;
        const row = [
          { v: mo.label, s: monthCellStyle(isAlt) },
          ...cards.map(c => {
            const val = matrix[mo.key]?.[c]?.total || 0;
            return { v: val, t: 'n', s: val > 0 ? dataStyle(isAlt) : { ...dataStyle(isAlt), font: { ...dataStyle(isAlt).font, color: { rgb: 'C0C0C0' } } } };
          }),
          { v: monthTotals[mo.key] || 0, t: 'n', s: dataTotalStyle(isAlt) },
        ];
        wsData.push(row);
      });

      // Group subtotal row
      if (showSeparators) {
        const groupCardTotals = {};
        cards.forEach(c => {
          groupCardTotals[c] = groupMonths.reduce((s, mo) => s + (matrix[mo.key]?.[c]?.total || 0), 0);
        });
        const groupRowTotal = cards.reduce((s, c) => s + (groupCardTotals[c] || 0), 0);

        wsData.push([
          { v: `${groupKey} Total`, s: subtotalLabelStyle },
          ...cards.map(c => ({ v: groupCardTotals[c] || 0, t: 'n', s: subtotalStyle })),
          { v: groupRowTotal, t: 'n', s: { ...subtotalStyle, font: { ...subtotalStyle.font, color: { rgb: '92400E' } } } },
        ]);
      }
    });

    // Grand Total row
    wsData.push([
      { v: 'Grand Total', s: grandLabelStyle },
      ...cards.map(c => ({ v: cardTotals[c] || 0, t: 'n', s: grandStyle })),
      { v: grandTotal, t: 'n', s: { ...grandStyle, font: { bold: true, sz: 12, name: 'Calibri', color: { rgb: '92400E' } } } },
    ]);

    // ── Create Workbook ────────────────────────────────────────
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Column widths (auto-fit approximation)
    ws['!cols'] = [
      { wch: 16 }, // Month
      ...cards.map(() => ({ wch: 15 })),
      { wch: 16 }, // Total
    ];

    // Merge title across all columns
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: colCount - 1 } },
    ];

    // Merge group separator rows across all columns
    if (showSeparators) {
      let rowIdx = 4; // Start after title, subtitle, blank, header
      Object.keys(groups).forEach(groupKey => {
        // Group separator row
        ws['!merges'].push({ s: { r: rowIdx, c: 0 }, e: { r: rowIdx, c: colCount - 1 } });
        rowIdx += 1 + groups[groupKey].length + 1; // sep + months + subtotal
      });
    }

    XLSX.utils.book_append_sheet(wb, ws, 'Total Dues');
    XLSX.writeFile(wb, `FinSight_Total_Dues_${groupBy}.xlsx`);
  };

  if (!analyses.length) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <p className="text-muted">No analyses found. Upload a credit card statement to begin.</p>
      </div>
    );
  }

  const YELLOW_BG = 'var(--table-yellow-bg)';
  const YELLOW_TEXT = 'var(--table-yellow-text)';
  const BLUE = 'var(--blue)';
  
  // Theme-aware group header background
  const GROUP_BG = 'var(--table-group-bg)';
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
    const bg = ri % 2 === 0 ? 'var(--bg-card)' : 'var(--table-stripe-alt)';
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
      borderBottom: '1px solid var(--table-row-border)',
    };
  };

  const rowTd = () => ({
    ...TD,
    borderBottom: '1px solid var(--table-row-border)',
  });

  return (
    <div>
      {/* Selector Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          Click any amount to view transaction details
        </p>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Export CSV Button */}
          <button
            onClick={exportExcel}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              fontSize: '0.78rem',
              fontWeight: 600,
              borderRadius: '8px',
              border: '1px solid rgba(52,211,153,0.3)',
              cursor: 'pointer',
              background: 'rgba(52,211,153,0.08)',
              color: '#34d399',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(52,211,153,0.18)'; e.currentTarget.style.borderColor = 'rgba(52,211,153,0.5)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(52,211,153,0.08)'; e.currentTarget.style.borderColor = 'rgba(52,211,153,0.3)'; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export Excel
          </button>

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
              <th style={{ ...stickyHeaderTh(false), background: 'var(--table-grand-total-bg)', color: YELLOW_TEXT }}>Total</th>
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
                        borderBottom: '1px solid var(--table-row-border)',
                        borderTop: '1px solid var(--table-row-border)',
                      }}
                    >
                      {groupKey}
                    </td>
                  </tr>
                ),
                // Month rows inside this group
                ...groupMonths.map((mo, ri) => {
                  const rowTotal = monthTotals[mo.key] || 0;
                  const rowBg = ri % 2 === 0 ? 'transparent' : 'var(--table-stripe-alt2)';
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
                      background: 'var(--table-subtotal-bg)',
                      borderBottom: '2px solid var(--table-row-border)',
                      borderTop: '1px solid var(--table-row-border)',
                    }}>
                      {groupKey} Total
                    </td>
                    {cards.map(c => (
                      <td key={c} style={{
                        ...TD,
                        fontFamily: 'JetBrains Mono, monospace',
                        fontWeight: 700,
                        color: groupCardTotals[c] > 0 ? 'var(--text-primary)' : 'var(--text-muted)',
                        borderBottom: '2px solid var(--table-row-border)',
                        borderTop: '1px solid var(--table-row-border)',
                      }}>
                        {fmtINR(groupCardTotals[c] || 0)}
                      </td>
                    ))}
                    <td style={{
                      ...TD,
                      fontFamily: 'JetBrains Mono, monospace',
                      fontWeight: 700,
                      color: groupRowTotal > 0 ? YELLOW_TEXT : 'var(--text-muted)',
                      borderBottom: '2px solid var(--table-row-border)',
                      borderTop: '1px solid var(--table-row-border)',
                    }}>
                      {fmtINR(groupRowTotal)}
                    </td>
                  </tr>
                ),
              ].filter(Boolean);
            })}

            {/* Grand Totals row - sticky at bottom */}
            <tr style={{ background: 'var(--table-grand-bg)' }}>
              <td style={{
                ...TD,
                textAlign: 'left',
                fontWeight: 800,
                color: YELLOW_TEXT,
                position: 'sticky',
                bottom: 0,
                left: 0,
                zIndex: 10,
                background: 'var(--table-grand-bg)',
                borderTop: '2px solid var(--table-grand-border)',
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
                background: 'var(--table-grand-bg)',
                borderTop: '2px solid var(--table-grand-border)',
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


