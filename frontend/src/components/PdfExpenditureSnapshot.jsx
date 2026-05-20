import { useState, useMemo } from 'react';
import { FileText, TrendingDown, TrendingUp, Minus, Search, X, ChevronLeft, ChevronRight } from 'lucide-react';
import TransactionModal from './TransactionModal';
import { fmtINR } from '../utils/dashboardUtils';

const CATEGORIES = ['Food', 'Fuel', 'Travel', 'Shopping', 'Bills', 'Entertainment', 'Healthcare', 'Others'];

const CAT_COLORS = {
  Food: '#f97316',
  Fuel: '#eab308',
  Travel: '#06b6d4',
  Shopping: '#a855f7',
  Bills: '#ec4899',
  Entertainment: '#14b8a6',
  Healthcare: '#22c55e',
  Others: '#94a3b8',
};

const TH = {
  padding: '11px 12px',
  fontWeight: 700,
  fontSize: '0.7rem',
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  borderRight: '1px solid rgba(255,255,255,0.05)',
  whiteSpace: 'nowrap',
  textAlign: 'right',
};

const TD = {
  padding: '10px 12px',
  borderRight: '1px solid rgba(255,255,255,0.04)',
  fontSize: '0.81rem',
  textAlign: 'right',
  whiteSpace: 'nowrap',
};

function shortName(fileName) {
  // Strip extension, truncate at 28 chars
  const noExt = (fileName || '').replace(/\.[^.]+$/, '');
  return noExt.length > 30 ? noExt.slice(0, 28) + '…' : noExt;
}

export default function PdfExpenditureSnapshot({ analyses }) {
  const [modal, setModal] = useState(null);
  const [sortField, setSortField] = useState('total_debit'); // 'total_debit' | 'total_credit' | cat name
  const [sortDir, setSortDir] = useState(-1); // -1 = desc, 1 = asc
  
  // Optimization States: Search & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Build per-PDF rows
  const rows = useMemo(() => {
    return analyses.map(a => {
      const txns = a.result_json?.transactions || [];
      const catMap = {};
      CATEGORIES.forEach(c => { catMap[c] = { total: 0, transactions: [] }; });

      let totalDebit = 0;
      let totalCredit = 0;

      txns.forEach(t => {
        const amt = Number(t.amount) || 0;
        const cat = CATEGORIES.includes(t.category) ? t.category : 'Others';
        if (t.type === 'debit') {
          catMap[cat].total += amt;
          catMap[cat].transactions.push(t);
          totalDebit += amt;
        } else if (t.type === 'credit') {
          totalCredit += amt;
        }
      });

      return {
        id: a.id,
        fileName: a.file_name || 'Unknown File',
        currency: a.currency || '₹',
        catMap,
        totalDebit: Math.round(totalDebit * 100) / 100,
        totalCredit: Math.round(totalCredit * 100) / 100,
        txnCount: txns.length,
        uploadedAt: a.created_at,
      };
    });
  }, [analyses]);

  // Sort rows
  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      let av, bv;
      if (sortField === 'total_debit') { av = a.totalDebit; bv = b.totalDebit; }
      else if (sortField === 'total_credit') { av = a.totalCredit; bv = b.totalCredit; }
      else { av = a.catMap[sortField]?.total || 0; bv = b.catMap[sortField]?.total || 0; }
      return (av - bv) * sortDir;
    });
  }, [rows, sortField, sortDir]);

  // Filter rows by search query
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return sortedRows;
    const query = searchQuery.toLowerCase().trim();
    return sortedRows.filter(r => r.fileName.toLowerCase().includes(query));
  }, [sortedRows, searchQuery]);

  // Column totals of the currently filtered subset
  const colTotals = useMemo(() => {
    const totals = { total_debit: 0, total_credit: 0 };
    CATEGORIES.forEach(c => { totals[c] = 0; });
    filteredRows.forEach(r => {
      totals.total_debit += r.totalDebit;
      totals.total_credit += r.totalCredit;
      CATEGORIES.forEach(c => { totals[c] += r.catMap[c]?.total || 0; });
    });
    return totals;
  }, [filteredRows]);

  // Paginated subset of rows
  const paginatedRows = useMemo(() => {
    if (pageSize === 'all') return filteredRows;
    const startIndex = (currentPage - 1) * pageSize;
    return filteredRows.slice(startIndex, startIndex + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  const totalPages = useMemo(() => {
    if (pageSize === 'all') return 1;
    return Math.ceil(filteredRows.length / pageSize) || 1;
  }, [filteredRows, pageSize]);

  const toggleSort = (field) => {
    if (sortField === field) setSortDir(d => d * -1);
    else { setSortField(field); setSortDir(-1); }
  };

  const sortArrow = (field) => {
    if (sortField !== field) return <span style={{ opacity: 0.25 }}>↕</span>;
    return sortDir === -1 ? '↓' : '↑';
  };

  if (!analyses.length) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <FileText size={40} color="var(--text-muted)" style={{ marginBottom: 12 }} />
        <p className="text-muted">No analyses found. Upload a PDF to begin.</p>
      </div>
    );
  }

  const YELLOW_BG = 'rgba(234,179,8,0.12)';
  const YELLOW_TEXT = '#eab308';
  const RED = 'var(--red)';
  const EMERALD = 'var(--emerald)';

  return (
    <div>
      {/* Summary strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12, marginBottom: 24 }}>
        <div className="stat-card red" style={{ margin: 0 }}>
          <div className="stat-label">Total Spent</div>
          <div className="stat-value" style={{ fontSize: '1.2rem' }}>₹{fmtINR(colTotals.total_debit)}</div>
          <div className="stat-sub">{filteredRows.length} PDF{filteredRows.length !== 1 ? 's' : ''} · shown debits</div>
        </div>
        <div className="stat-card emerald" style={{ margin: 0 }}>
          <div className="stat-label">Total Income</div>
          <div className="stat-value" style={{ fontSize: '1.2rem' }}>₹{fmtINR(colTotals.total_credit)}</div>
          <div className="stat-sub">Shown credits combined</div>
        </div>
        <div className="stat-card blue" style={{ margin: 0 }}>
          <div className="stat-label">Net Balance</div>
          <div className="stat-value" style={{
            fontSize: '1.2rem',
            color: colTotals.total_credit - colTotals.total_debit >= 0 ? EMERALD : RED,
          }}>
            ₹{fmtINR(Math.abs(colTotals.total_credit - colTotals.total_debit))}
            {colTotals.total_credit - colTotals.total_debit >= 0 ? ' ▲' : ' ▼'}
          </div>
          <div className="stat-sub">Income minus spent</div>
        </div>
        <div className="stat-card purple" style={{ margin: 0 }}>
          <div className="stat-label">Top Category</div>
          <div className="stat-value" style={{ fontSize: '1rem' }}>
            {(() => {
              const top = CATEGORIES.reduce((best, c) =>
                (colTotals[c] || 0) > (colTotals[best] || 0) ? c : best, CATEGORIES[0]);
              return colTotals[top] > 0 ? top : 'None';
            })()}
          </div>
          <div className="stat-sub">Highest spend category</div>
        </div>
      </div>

      {/* Optimization Control Bar (Search & Page Size) */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 16,
        marginBottom: 16,
        flexWrap: 'wrap'
      }}>
        {/* Search Bar */}
        <div style={{ position: 'relative', flex: 1, minWidth: '240px', maxWidth: '380px' }}>
          <input
            type="text"
            placeholder="Search statements by file name..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              width: '100%',
              padding: '10px 16px 10px 38px',
              fontSize: '0.82rem',
              height: '38px',
              borderRadius: '10px',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
              outline: 'none',
              transition: 'border-color 0.2s',
            }}
            onFocus={(e) => e.target.style.borderColor = 'rgba(99,179,237,0.4)'}
            onBlur={(e) => e.target.style.borderColor = 'var(--border-subtle)'}
          />
          <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }}>
            <Search size={14} color="var(--text-primary)" />
          </div>
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setCurrentPage(1);
              }}
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                opacity: 0.5,
                color: 'var(--text-primary)',
                padding: 0
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Page Size Selection */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Showing {filteredRows.length} of {rows.length} statements
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                const val = e.target.value;
                setPageSize(val === 'all' ? 'all' : Number(val));
                setCurrentPage(1);
              }}
              style={{
                padding: '4px 8px',
                fontSize: '0.78rem',
                height: '32px',
                borderRadius: '6px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value="all">All</option>
            </select>
          </div>
        </div>
      </div>

      <p style={{ marginBottom: 12, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
        Click any amount to view transaction details · Click column headers to sort
      </p>

      {/* Main table with Scroll & Sticky layout */}
      <div style={{ 
        maxHeight: '440px', 
        overflowY: 'auto', 
        overflowX: 'auto', 
        borderRadius: 12, 
        border: '1px solid var(--border-subtle)',
        position: 'relative',
        background: 'var(--bg-card)'
      }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: 900 }}>
          <thead>
            <tr style={{ background: 'var(--bg-secondary)' }}>
              {/* PDF name col (Sticky to both top and left) */}
              <th style={{ 
                ...TH, 
                textAlign: 'left', 
                minWidth: 180, 
                position: 'sticky', 
                left: 0, 
                top: 0, 
                background: 'var(--bg-secondary)', 
                zIndex: 12,
                borderBottom: '1px solid var(--border-subtle)',
              }}>
                PDF File
              </th>
              {/* Category cols (Sticky to top) */}
              {CATEGORIES.map(c => (
                <th
                  key={c}
                  style={{ 
                    ...TH, 
                    cursor: 'pointer', 
                    minWidth: 100,
                    position: 'sticky',
                    top: 0,
                    background: 'var(--bg-secondary)',
                    zIndex: 10,
                    borderBottom: '1px solid var(--border-subtle)',
                  }}
                  onClick={() => toggleSort(c)}
                >
                  <span style={{ borderBottom: `2px solid ${CAT_COLORS[c]}`, paddingBottom: 1 }}>{c}</span>
                  {' '}{sortArrow(c)}
                </th>
              ))}
              {/* Totals (Sticky to top) */}
              <th
                style={{ 
                  ...TH, 
                  cursor: 'pointer', 
                  minWidth: 110,
                  position: 'sticky',
                  top: 0,
                  background: 'var(--bg-secondary)',
                  color: YELLOW_TEXT,
                  zIndex: 10,
                  borderBottom: '1px solid var(--border-subtle)',
                }}
                onClick={() => toggleSort('total_debit')}
              >
                Total Spent {sortArrow('total_debit')}
              </th>
              <th
                style={{ 
                  ...TH, 
                  cursor: 'pointer', 
                  minWidth: 110,
                  position: 'sticky',
                  top: 0,
                  background: 'var(--bg-secondary)',
                  color: EMERALD,
                  zIndex: 10,
                  borderBottom: '1px solid var(--border-subtle)',
                }}
                onClick={() => toggleSort('total_credit')}
              >
                Total Income {sortArrow('total_credit')}
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedRows.length === 0 ? (
              <tr>
                <td colSpan={CATEGORIES.length + 3} style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No matching bank statements found.
                </td>
              </tr>
            ) : paginatedRows.map((row, ri) => {
              const net = row.totalCredit - row.totalDebit;
              return (
                <tr
                  key={row.id}
                  style={{
                    background: ri % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                  }}
                >
                  {/* Filename (Sticky to left) */}
                  <td style={{
                    ...TD,
                    textAlign: 'left',
                    position: 'sticky',
                    left: 0,
                    background: ri % 2 === 0 ? 'var(--bg-card)' : '#1a1f2c',
                    zIndex: 8,
                    maxWidth: 200,
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                        background: 'var(--blue-glow)', border: '1px solid rgba(99,179,237,0.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <FileText size={13} color="var(--blue)" />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: '0.82rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160 }}
                          title={row.fileName}>
                          {shortName(row.fileName)}
                        </p>
                        <p style={{ margin: 0, fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                          {row.txnCount} txn{row.txnCount !== 1 ? 's' : ''}
                          {row.uploadedAt ? ` · ${new Date(row.uploadedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}` : ''}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Per-category cells */}
                  {CATEGORIES.map(c => {
                    const val = row.catMap[c]?.total || 0;
                    const txns = row.catMap[c]?.transactions || [];
                    return (
                      <td
                        key={c}
                        style={{ 
                          ...TD, 
                          cursor: val > 0 ? 'pointer' : 'default',
                          borderBottom: '1px solid rgba(255,255,255,0.04)',
                        }}
                        onClick={() => val > 0 && setModal({
                          title: `${shortName(row.fileName)} · ${c}`,
                          transactions: txns,
                        })}
                      >
                        {val > 0 ? (
                          <span style={{
                            color: CAT_COLORS[c],
                            fontFamily: 'JetBrains Mono, monospace',
                            fontWeight: 600,
                            textDecoration: 'underline dotted',
                          }}>
                            ₹{fmtINR(val)}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', opacity: 0.4 }}>—</span>
                        )}
                      </td>
                    );
                  })}

                  {/* Total spent */}
                  <td style={{ 
                    ...TD, 
                    background: ri % 2 === 0 ? 'rgba(234,179,8,0.06)' : 'rgba(234,179,8,0.09)', 
                    fontFamily: 'JetBrains Mono, monospace', 
                    fontWeight: 700, 
                    color: row.totalDebit > 0 ? YELLOW_TEXT : 'var(--text-muted)',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                  }}>
                    {row.totalDebit > 0 ? `₹${fmtINR(row.totalDebit)}` : '—'}
                  </td>

                  {/* Total credit */}
                  <td style={{ 
                    ...TD, 
                    background: ri % 2 === 0 ? 'rgba(34,197,94,0.03)' : 'rgba(34,197,94,0.06)', 
                    fontFamily: 'JetBrains Mono, monospace', 
                    fontWeight: 700, 
                    color: row.totalCredit > 0 ? EMERALD : 'var(--text-muted)',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                  }}>
                    {row.totalCredit > 0 ? `₹${fmtINR(row.totalCredit)}` : '—'}
                  </td>
                </tr>
              );
            })}

            {/* Grand totals row (Sticky to bottom) */}
            <tr style={{ 
              position: 'sticky', 
              bottom: 0, 
              background: '#141822', 
              zIndex: 11,
              boxShadow: '0 -4px 12px rgba(0,0,0,0.3)'
            }}>
              <td style={{ 
                ...TD, 
                textAlign: 'left', 
                position: 'sticky', 
                left: 0, 
                bottom: 0, 
                background: '#141822', 
                zIndex: 13, 
                fontWeight: 800, 
                color: YELLOW_TEXT,
                borderTop: '2px solid rgba(234,179,8,0.25)',
              }}>
                Grand Total
              </td>
              {CATEGORIES.map(c => (
                <td key={c} style={{ 
                  ...TD, 
                  fontFamily: 'JetBrains Mono, monospace', 
                  fontWeight: 700, 
                  color: colTotals[c] > 0 ? 'var(--text-primary)' : 'var(--text-muted)',
                  borderTop: '2px solid rgba(234,179,8,0.25)',
                  background: '#141822'
                }}>
                  {colTotals[c] > 0 ? `₹${fmtINR(colTotals[c])}` : '—'}
                </td>
              ))}
              <td style={{ 
                ...TD, 
                fontFamily: 'JetBrains Mono, monospace', 
                fontWeight: 800, 
                color: YELLOW_TEXT,
                borderTop: '2px solid rgba(234,179,8,0.25)',
                background: 'rgba(234,179,8,0.15)'
              }}>
                ₹{fmtINR(colTotals.total_debit)}
              </td>
              <td style={{ 
                ...TD, 
                fontFamily: 'JetBrains Mono, monospace', 
                fontWeight: 800, 
                color: EMERALD,
                borderTop: '2px solid rgba(234,179,8,0.25)',
                background: 'rgba(34,197,94,0.12)'
              }}>
                ₹{fmtINR(colTotals.total_credit)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {pageSize !== 'all' && totalPages > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 16,
          padding: '10px 16px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 12,
          flexWrap: 'wrap',
          gap: 12
        }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Showing {Math.min(filteredRows.length, (currentPage - 1) * pageSize + 1)}-
            {Math.min(filteredRows.length, currentPage * pageSize)} of {filteredRows.length} results
          </span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', opacity: currentPage === 1 ? 0.35 : 1, cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
            >
              <ChevronLeft size={14} /> Prev
            </button>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 600, padding: '0 8px' }}>
              Page {currentPage} of {totalPages}
            </span>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', opacity: currentPage === totalPages ? 0.35 : 1, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Category legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>
        {CATEGORIES.map(c => (
          <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: CAT_COLORS[c] }} />
            {c}
            {colTotals[c] > 0 && (
              <span style={{ color: CAT_COLORS[c], fontWeight: 600 }}>₹{fmtINR(colTotals[c])}</span>
            )}
          </div>
        ))}
      </div>

      {modal && (
        <TransactionModal
          title={modal.title}
          transactions={modal.transactions}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

