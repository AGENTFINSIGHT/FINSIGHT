import React, { useMemo } from 'react';
import { Clock, FileText, ChevronRight, Trash2 } from 'lucide-react';
import { deleteAnalysis } from '../utils/apiClient';

function fmt(n, c = '$') {
  return `${c}${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

// Groups analyses by date and chunks them into batches if they are close in time
export default function HistorySnapshot({ analyses, onDeleted }) {
  const batches = useMemo(() => {
    if (!analyses || analyses.length === 0) return [];
    
    // Sort descending by created_at
    const sorted = [...analyses].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    const groups = [];
    let currentBatch = [];
    
    sorted.forEach((item, i) => {
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
  }, [analyses]);

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this analysis?")) return;
    try {
      await deleteAnalysis(id);
      if (onDeleted) onDeleted();
    } catch (e) {
      alert("Failed to delete analysis");
    }
  };

  if (batches.length === 0) {
    return (
      <div className="text-center p-32">
        <p className="text-muted">No history found.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {batches.map((batch, idx) => {
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
      })}
    </div>
  );
}
