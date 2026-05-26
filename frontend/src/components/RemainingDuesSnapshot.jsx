import { useState, useMemo } from 'react';
import { FileText, Search, X, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import TransactionModal from './TransactionModal';
import { fmtINR, extractCardLabel } from '../utils/dashboardUtils';
import { supabase } from '../lib/supabase.js';

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
  const noExt = (fileName || '').replace(/\.[^.]+$/, '');
  return noExt.length > 30 ? noExt.slice(0, 28) + '…' : noExt;
}

export default function RemainingDuesSnapshot({ analyses }) {
  const [modal, setModal] = useState(null);
  const [sortField, setSortField] = useState('remainingDue'); // 'fileName' | 'totalDebit' | 'totalCredit' | 'remainingDue'
  const [sortDir, setSortDir] = useState(-1); // -1 = desc, 1 = asc
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCard, setSelectedCard] = useState('all');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Process rows
  const rows = useMemo(() => {
    return analyses.map(a => {
      const txns = a.result_json?.transactions || [];
      let totalDebit = 0;
      let totalCredit = 0;

      txns.forEach(t => {
        const amt = Number(t.amount) || 0;
        if (t.type === 'debit') {
          totalDebit += amt;
        } else if (t.type === 'credit') {
          totalCredit += amt;
        }
      });

      const totalDebitRound = Math.round(totalDebit * 100) / 100;
      const totalCreditRound = Math.round(totalCredit * 100) / 100;
      const remainingDue = Math.max(0, Math.round((totalDebitRound - totalCreditRound) * 100) / 100);
      const cardLabel = extractCardLabel(a);

      return {
        id: a.id,
        fileName: a.file_name || 'Unknown Statement',
        cardLabel,
        currency: a.currency || '₹',
        totalDebit: totalDebitRound,
        totalCredit: totalCreditRound,
        remainingDue,
        status: remainingDue === 0 ? 'Paid' : 'Unpaid',
        txnCount: txns.length,
        uploadedAt: a.created_at,
        transactions: txns,
        fileUrl: a.file_url,
      };
    });
  }, [analyses]);

  // Dynamically extract all unique card labels
  const uniqueCards = useMemo(() => {
    const seen = new Set();
    const result = [];
    rows.forEach(r => {
      if (r.cardLabel && !seen.has(r.cardLabel)) {
        seen.add(r.cardLabel);
        result.push(r.cardLabel);
      }
    });
    return result.sort();
  }, [rows]);

  // Sort rows
  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      let av, bv;
      if (sortField === 'fileName') {
        av = a.fileName.toLowerCase();
        bv = b.fileName.toLowerCase();
        return av.localeCompare(bv) * sortDir;
      }
      if (sortField === 'totalDebit') { av = a.totalDebit; bv = b.totalDebit; }
      else if (sortField === 'totalCredit') { av = a.totalCredit; bv = b.totalCredit; }
      else if (sortField === 'remainingDue') { av = a.remainingDue; bv = b.remainingDue; }
      else { av = a.uploadedAt; bv = b.uploadedAt; }
      return (av - bv) * sortDir;
    });
  }, [rows, sortField, sortDir]);

  // Filter by search query AND card selection
  const filteredRows = useMemo(() => {
    let result = sortedRows;
    
    // Filter by card selection
    if (selectedCard !== 'all') {
      result = result.filter(r => r.cardLabel === selectedCard);
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(r => r.fileName.toLowerCase().includes(query) || r.cardLabel.toLowerCase().includes(query));
    }
    
    return result;
  }, [sortedRows, searchQuery, selectedCard]);

  // Column totals
  const colTotals = useMemo(() => {
    const totals = { totalDebit: 0, totalCredit: 0 };
    filteredRows.forEach(r => {
      totals.totalDebit += r.totalDebit;
      totals.totalCredit += r.totalCredit;
    });
    totals.totalDebit = Math.round(totals.totalDebit * 100) / 100;
    totals.totalCredit = Math.round(totals.totalCredit * 100) / 100;
    // Consolidated remaining due is the global difference between total statement dues and payments
    totals.remainingDue = Math.max(0, Math.round((totals.totalDebit - totals.totalCredit) * 100) / 100);
    return totals;
  }, [filteredRows]);

  // Paginated rows
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
        <p className="text-muted">No statements found. Upload a credit card statement to begin.</p>
      </div>
    );
  }

  const YELLOW_TEXT = 'var(--table-yellow-text)';

  return (
    <div>
      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 320px)', gap: 16, marginBottom: 24 }}>
        <div className="stat-card red" style={{ margin: 0 }}>
          <div className="stat-label">Total Statement Dues</div>
          <div className="stat-value" style={{ fontSize: '1.3rem' }}>₹{fmtINR(colTotals.totalDebit)}</div>
          <div className="stat-sub">{filteredRows.length} Statement{filteredRows.length !== 1 ? 's' : ''}</div>
        </div>
      </div>

      {/* Search & Filtration Control Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 16,
        marginBottom: 16,
        flexWrap: 'wrap'
      }}>
        {/* Search & Filtration Selector Wrapper */}
        <div style={{ display: 'flex', gap: 12, flex: 1, minWidth: '240px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: 1, minWidth: '200px', maxWidth: '380px' }}>
            <input
              type="text"
              placeholder="Search statements..."
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

          {/* Dynamic Card filter dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500 }}>Card:</span>
            <select
              value={selectedCard}
              onChange={(e) => {
                setSelectedCard(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                padding: '0 12px',
                fontSize: '0.8rem',
                height: '38px',
                borderRadius: '10px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                outline: 'none',
                minWidth: '130px',
                transition: 'all 0.2s',
              }}
              onFocus={(e) => e.target.style.borderColor = 'rgba(99,179,237,0.4)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border-subtle)'}
            >
              <option value="all">All Cards</option>
              {uniqueCards.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Page Size */}
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
              <option value="all">All</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div style={{ 
        maxHeight: '440px', 
        overflowY: 'auto', 
        overflowX: 'auto', 
        borderRadius: 12, 
        border: '1px solid var(--border-subtle)',
        position: 'relative',
        background: 'var(--bg-card)'
      }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: 800 }}>
          <thead>
            <tr style={{ background: 'var(--bg-secondary)' }}>
              <th style={{ 
                ...TH, 
                textAlign: 'left', 
                minWidth: 200, 
                position: 'sticky', 
                left: 0, 
                top: 0, 
                background: 'var(--bg-secondary)', 
                zIndex: 12,
                borderBottom: '1px solid var(--border-subtle)',
              }}>
                Statement File
              </th>
              <th style={{ ...TH, textAlign: 'center', minWidth: 120, position: 'sticky', top: 0, background: 'var(--bg-secondary)', zIndex: 10, borderBottom: '1px solid var(--border-subtle)' }}>
                Card Number
              </th>
              <th style={{ ...TH, minWidth: 100, position: 'sticky', top: 0, background: 'var(--bg-secondary)', zIndex: 10, borderBottom: '1px solid var(--border-subtle)' }}>
                Upload Date
              </th>
              <th
                style={{ ...TH, cursor: 'pointer', minWidth: 110, position: 'sticky', top: 0, background: 'var(--bg-secondary)', zIndex: 10, borderBottom: '1px solid var(--border-subtle)' }}
                onClick={() => toggleSort('totalDebit')}
              >
                Total Due {sortArrow('totalDebit')}
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedRows.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No matching statements found.
                </td>
              </tr>
            ) : paginatedRows.map((row, ri) => {
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
                    background: ri % 2 === 0 ? 'var(--bg-card)' : 'var(--table-stripe-alt)',
                    zIndex: 8,
                    maxWidth: 220,
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
                      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ margin: 0, fontWeight: 600, fontSize: '0.82rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160 }}
                             title={row.fileName}>
                            {shortName(row.fileName)}
                          </span>
                          {row.fileUrl && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                supabase.auth.getSession().then(({ data: { session } }) => {
                                  const base = import.meta.env.VITE_API_URL || '';
                                  const downloadUrl = `${base}/api/history/${row.id}/file?token=${session?.access_token || ''}`;
                                  window.open(downloadUrl, '_blank');
                                });
                              }}
                              title="Open PDF"
                              style={{
                                background: 'none',
                                border: 'none',
                                padding: 0,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                color: 'var(--blue)',
                                opacity: 0.7,
                                transition: 'opacity 0.2s',
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.opacity = 1}
                              onMouseLeave={(e) => e.currentTarget.style.opacity = 0.7}
                            >
                              <Eye size={13} />
                            </button>
                          )}
                        </div>
                        <span style={{ margin: 0, fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                          {row.txnCount} txn{row.txnCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Card number */}
                  <td style={{ ...TD, textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <span className="badge" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.74rem', fontWeight: 600, border: '1px solid var(--border-subtle)' }}>
                      {row.cardLabel}
                    </span>
                  </td>

                  {/* Upload Date */}
                  <td style={{ ...TD, borderBottom: '1px solid rgba(255,255,255,0.04)', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                    {row.uploadedAt ? new Date(row.uploadedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                  </td>

                  {/* Total Due */}
                  <td style={{ 
                    ...TD, 
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    color: 'var(--text-primary)',
                    fontWeight: 600
                  }}>
                    ₹{fmtINR(row.totalDebit)}
                  </td>
                </tr>
              );
            })}

            {/* Grand Totals */}
            <tr style={{ 
              position: 'sticky', 
              bottom: 0, 
              background: 'var(--table-footer-bg)', 
              zIndex: 11,
              boxShadow: '0 -4px 12px rgba(0,0,0,0.3)'
            }}>
              <td colSpan={3} style={{ 
                ...TD, 
                textAlign: 'left', 
                position: 'sticky', 
                left: 0, 
                bottom: 0, 
                background: 'var(--table-footer-bg)', 
                zIndex: 13, 
                fontWeight: 800, 
                color: YELLOW_TEXT,
                borderTop: '2px solid rgba(234,179,8,0.25)',
              }}>
                Grand Total
              </td>
              <td style={{ 
                ...TD, 
                fontWeight: 800, 
                color: YELLOW_TEXT,
                borderTop: '2px solid rgba(234,179,8,0.25)',
                background: 'rgba(234,179,8,0.15)'
              }}>
                ₹{fmtINR(colTotals.totalDebit)}
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
