import React, { useState, useMemo } from 'react';
import { Clock, FileText, ChevronRight, Trash2, Search, X, ChevronLeft } from 'lucide-react';
import { deleteAnalysis } from '../utils/apiClient';

function fmt(n, c = '$') {
  return `${c}${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

export default function HistorySnapshot({ analyses, onDeleted }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10); // 5, 10, 20, 50, all

  const filteredAnalyses = useMemo(() => {
    if (!analyses) return [];
    if (!searchQuery.trim()) return analyses;
    const q = searchQuery.toLowerCase().trim();
    return analyses.filter(item => (item.file_name || '').toLowerCase().includes(q));
  }, [analyses, searchQuery]);

  // Groups analyses by date and chunks them into batches if they are close in time
  const batches = useMemo(() => {
    if (!filteredAnalyses || filteredAnalyses.length === 0) return [];
    
    // Sort descending by created_at
    const sorted = [...filteredAnalyses].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    const groups = [];
    let currentBatch = [];
    
    sorted.forEach((item) => {
      if (currentBatch.length === 0) {
        currentBatch.push(item);
      } else {
        const lastItemTime = new Date(currentBatch[currentBatch.length - 1].created_at).getTime();
        const thisItemTime = new Date(item.created_at).getTime();
        // If within 30 minutes, consider it the same batch
        if (Math.abs(lastItemTime - thisItemTime) < 30 * 60 * 1000) {
          currentBatch.push(item);
        } else {
          groups.push([...currentBatch]);
          currentBatch = [item];
        }
      }
    });
    if (currentBatch.length > 0) groups.push(currentBatch);
    return groups;
  }, [filteredAnalyses]);

  const paginatedBatches = useMemo(() => {
    if (pageSize === 'all') return batches;
    const startIndex = (currentPage - 1) * pageSize;
    return batches.slice(startIndex, startIndex + pageSize);
  }, [batches, currentPage, pageSize]);

  const totalPages = useMemo(() => {
    if (pageSize === 'all') return 1;
    return Math.ceil(batches.length / pageSize) || 1;
  }, [batches, pageSize]);

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this analysis?")) return;
    try {
      await deleteAnalysis(id);
      if (onDeleted) onDeleted();
    } catch (e) {
      alert("Failed to delete analysis");
    }
  };

  if (!analyses || analyses.length === 0) {
    return (
      <div className="text-center p-32">
        <p className="text-muted">No history found.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Control Bar (Search & Page Size) */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 16,
        marginBottom: 20,
        flexWrap: 'wrap'
      }}>
        {/* Search Input */}
        <div style={{ position: 'relative', flex: 1, minWidth: '240px', maxWidth: '380px' }}>
          <input
            type="text"
            placeholder="Search history by file name..."
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

        {/* Page Size Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Showing {filteredAnalyses.length} of {analyses.length} statements
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Batches:</span>
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

      {/* Batches List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {paginatedBatches.length === 0 ? (
          <div className="card text-center p-32" style={{ background: 'var(--bg-card)' }}>
            <p className="text-muted" style={{ margin: 0 }}>No matching history found.</p>
          </div>
        ) : (
          paginatedBatches.map((batch, idx) => {
            const batchDate = new Date(batch[0].created_at);
            const dateStr = batchDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
            const timeStr = batchDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

            return (
              <div key={idx} className="card">
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Clock size={16} color="var(--blue)" />
                    <h4 style={{ margin: 0, fontSize: '1rem' }}>Batch • {dateStr}</h4>
                  </div>
                  <span className="text-xs text-muted">{timeStr} • {batch.length} file{batch.length !== 1 ? 's' : ''}</span>
                </div>
                
                <div style={{ padding: '8px 20px' }}>
                  {batch.map((item, j) => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: j < batch.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--blue-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <FileText size={16} color="var(--blue)" />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.file_name}</p>
                          <p className="text-xs text-muted" style={{ margin: '2px 0 0' }}>
                            Spent: <span style={{ color: 'var(--red)' }}>{fmt(item.total_debit, item.currency)}</span> • 
                            Income: <span style={{ color: 'var(--emerald)' }}>{fmt(item.total_credit, item.currency)}</span> • 
                            {item.txn_count} txns
                          </p>
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', gap: 8 }}>
                        <a href={`/analysis/${item.id}`} className="btn btn-ghost btn-sm" style={{ padding: '6px 10px' }}>
                          View <ChevronRight size={14} />
                        </a>
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)', padding: '6px 10px' }} onClick={() => handleDelete(item.id)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Footer */}
      {pageSize !== 'all' && totalPages > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 24,
          padding: '10px 16px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 12,
          flexWrap: 'wrap',
          gap: 12
        }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Showing {Math.min(batches.length, (currentPage - 1) * pageSize + 1)}-
            {Math.min(batches.length, currentPage * pageSize)} of {batches.length} batches
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
    </div>
  );
}
