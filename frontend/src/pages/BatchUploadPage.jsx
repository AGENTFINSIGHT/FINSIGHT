import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FolderOpen, Upload, Play, CheckCircle2, XCircle,
  Clock, ChevronDown, ChevronUp, Download, Loader2,
  BarChart3, X, AlertCircle, RefreshCw
} from 'lucide-react';
import ResultsDashboard from '../components/ResultsDashboard';
import { useBatch, S } from '../contexts/BatchContext';

const STATUS_UI = {
  pending: { icon: Clock, color: 'var(--text-muted)', label: 'Pending' },
  analyzing: { icon: Loader2, color: 'var(--blue)', label: 'Analyzing…' },
  done: { icon: CheckCircle2, color: 'var(--emerald)', label: 'Completed' },
  failed: { icon: XCircle, color: 'var(--red)', label: 'Failed' },
};

function fmt(n, c = '₹') {
  const locale = c === '₹' ? 'en-IN' : 'en-US';
  return `${c}${Number(n || 0).toLocaleString(locale, { minimumFractionDigits: 2 })}`;
}

export default function BatchUploadPage() {
  const { queue, running, addFiles, removeItem, clearDone, retryItem, runAll, stopAll } = useBatch();
  const [expanded, setExpanded] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef();
  const folderRef = useRef();
  const navigate = useNavigate();

  // webkitdirectory must be set imperatively — React does not support it as a JSX prop
  useEffect(() => {
    if (folderRef.current) {
      folderRef.current.setAttribute('webkitdirectory', '');
      folderRef.current.setAttribute('directory', '');
      folderRef.current.setAttribute('mozdirectory', '');
    }
  }, []);

  const exportCombinedCSV = () => {
    const done = queue.filter(q => q.status === S.done && q.result);
    if (!done.length) return;

    const rows = [
      ['FinSight AI — Batch Analysis Report'],
      ['Generated', new Date().toLocaleString()],
      ['Files Analyzed', done.length],
      [],
      // Per-file summary
      ['FILE SUMMARIES', '', '', ''],
      ['File Name', 'Total Debited', 'Total Credited', 'Net Balance', 'Transactions'],
      ...done.map(q => [
        `"${q.name}"`,
        `-${Number(q.result.total_debit || 0).toFixed(2)}`,
        Number(q.result.total_credit || 0).toFixed(2),
        (Number(q.result.total_credit || 0) - Number(q.result.total_debit || 0)).toFixed(2),
        q.result.transactions?.length || 0,
      ]),
      [],
      // Grand totals
      ['GRAND TOTAL', '', '', ''],
      ['Total Debited All Files', '', '', `-${done.reduce((s, q) => s + Number(q.result.total_debit || 0), 0).toFixed(2)}`],
      ['Total Credited All Files', '', '', done.reduce((s, q) => s + Number(q.result.total_credit || 0), 0).toFixed(2)],
      ['Total Transactions', '', '', done.reduce((s, q) => s + (q.result.transactions?.length || 0), 0)],
      [],
      // All transactions combined
      ['ALL TRANSACTIONS', '', '', '', '', ''],
      ['Source File', 'Date', 'Description', 'Category', 'Type', 'Amount'],
      ...done.flatMap(q =>
        (q.result.transactions || []).map(t => [
          `"${q.name}"`, t.date,
          `"${String(t.description).replace(/"/g, '""')}"`,
          t.category, t.type.toUpperCase(),
          t.type === 'debit' ? `-${Number(t.amount).toFixed(2)}` : Number(t.amount).toFixed(2),
        ])
      ),
    ];

    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement('a'), { href: url, download: `finsight_batch_${Date.now()}.csv` }).click();
    URL.revokeObjectURL(url);
  };

  const doneCount = queue.filter(q => q.status === S.done).length;
  const failedCount = queue.filter(q => q.status === S.failed).length;
  const pendingCount = queue.filter(q => q.status === S.pending).length;
  const totalDebit = queue.filter(q => q.result).reduce((s, q) => s + Number(q.result.total_debit || 0), 0);
  const totalCredit = queue.filter(q => q.result).reduce((s, q) => s + Number(q.result.total_credit || 0), 0);

  // Detect active currency symbol from successfully completed items, default to rupees
  const firstDoneWithCurrency = queue.find(q => q.status === S.done && q.result?.currency);
  const activeCurrency = firstDoneWithCurrency ? firstDoneWithCurrency.result.currency : '₹';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* Page header */}
      <div style={{ borderBottom: '1px solid var(--border-subtle)', padding: '16px 0', marginBottom: 32 }}>
        <div className="container page-header-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--blue-glow)', border: '1px solid rgba(99,179,237,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FolderOpen size={18} color="var(--blue)" />
            </div>
            <div>
              <h3 style={{ margin: 0 }}>Batch Upload</h3>
              <p className="text-xs text-muted">Analyze multiple PDFs at once</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {doneCount > 0 && <button className="btn btn-ghost btn-sm" onClick={clearDone}>Clear Done</button>}
            {doneCount > 0 && (
              <button className="btn btn-primary btn-sm" onClick={exportCombinedCSV}>
                <Download size={13} /> Export All CSV
              </button>
            )}
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>← Single Upload</button>
          </div>
        </div>
      </div>

      <div className="container" style={{ paddingBottom: 60 }}>
        {/* Drop zone */}
        {!running && (
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
            style={{
              border: `2px dashed ${dragOver ? 'var(--blue)' : 'var(--border-subtle)'}`,
              borderRadius: 'var(--radius-lg)', padding: '40px 32px', textAlign: 'center',
              background: dragOver ? 'var(--blue-glow)' : 'var(--bg-secondary)',
              transition: 'all var(--transition)', marginBottom: 24,
            }}
          >
            {/* Hidden inputs */}
            <input ref={fileRef} type="file" accept=".pdf" multiple style={{ display: 'none' }}
              onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
            <input ref={folderRef} type="file" accept=".pdf" multiple style={{ display: 'none' }}
              onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />

            {/* Clickable icon+text area — only this triggers file picker on click */}
            <div
              style={{ cursor: 'pointer' }}
              onClick={() => fileRef.current.click()}
            >
              <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--blue-glow)', border: '1px solid rgba(99,179,237,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <Upload size={26} color="var(--blue)" />
              </div>
              <p style={{ fontWeight: 600, marginBottom: 6 }}>Drop multiple PDFs here</p>
              <p className="text-sm text-muted" style={{ marginBottom: 16 }}>or use the buttons below</p>
            </div>

            {/* Buttons — stopPropagation prevents triggering the icon click above */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={e => { e.stopPropagation(); fileRef.current.click(); }}
              >
                <Upload size={13} /> Select Files
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={e => { e.stopPropagation(); folderRef.current.click(); }}
              >
                <FolderOpen size={13} /> Select Folder
              </button>
            </div>
          </div>
        )}

        {/* Grand total summary (shown after any completions) */}
        {doneCount > 0 && (
          <div className="card p-24 mb-24 stagger-children" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))', gap: 16 }}>
            <div className="stat-card red" style={{ margin: 0 }}>
              <div className="stat-label">Total Spent</div>
              <div className="stat-value" style={{ fontSize: '1.3rem' }}>{fmt(totalDebit, activeCurrency)}</div>
              <div className="stat-sub">All files · debits</div>
            </div>
            <div className="stat-card emerald" style={{ margin: 0 }}>
              <div className="stat-label">Total Income</div>
              <div className="stat-value" style={{ fontSize: '1.3rem' }}>{fmt(totalCredit, activeCurrency)}</div>
              <div className="stat-sub">All files · credits</div>
            </div>
            <div className="stat-card blue" style={{ margin: 0 }}>
              <div className="stat-label">Net Balance</div>
              <div className="stat-value" style={{ fontSize: '1.3rem', color: totalCredit - totalDebit >= 0 ? 'var(--emerald)' : 'var(--red)' }}>
                {fmt(Math.abs(totalCredit - totalDebit), activeCurrency)}{totalCredit - totalDebit >= 0 ? ' ▲' : ' ▼'}
              </div>
              <div className="stat-sub">Income minus spent</div>
            </div>
            <div className="stat-card purple" style={{ margin: 0 }}>
              <div className="stat-label">Files Done</div>
              <div className="stat-value" style={{ fontSize: '1.3rem' }}>{doneCount} / {queue.length}</div>
              <div className="stat-sub">{failedCount > 0 ? `${failedCount} failed` : 'All successful'}</div>
            </div>
          </div>
        )}

        {/* Queue */}
        {queue.length > 0 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h4 style={{ margin: 0 }}>{queue.length} file{queue.length !== 1 ? 's' : ''} queued</h4>
              <div style={{ display: 'flex', gap: 8 }}>
                {!running && (pendingCount > 0 || failedCount > 0) && (
                  <button className="btn btn-primary" id="btn-analyze-all" onClick={runAll}>
                    <Play size={14} /> Analyze {pendingCount + failedCount > 1 ? `All ${pendingCount + failedCount} Pending Files` : '1 File'}
                  </button>
                )}
                {running && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--blue)', fontSize: '0.85rem' }}>
                      <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                      Processing… ({doneCount + failedCount}/{queue.length})
                    </div>
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)', border: '1px solid rgba(248, 113, 113, 0.2)', padding: '4px 12px' }} onClick={stopAll}>
                      Stop
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Progress bar */}
            {(running || doneCount + failedCount > 0) && (
              <div style={{ height: 4, background: 'var(--border-subtle)', borderRadius: 99, marginBottom: 16, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 99,
                  width: `${((doneCount + failedCount) / queue.length) * 100}%`,
                  background: failedCount > 0 ? 'linear-gradient(90deg, var(--emerald), var(--amber))' : 'var(--gradient-primary)',
                  transition: 'width 0.5s ease',
                }} />
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {queue.map(item => {
                const { icon: StatusIcon, color, label } = STATUS_UI[item.status];
                const isExpanded = expanded === item.id;
                return (
                  <div key={item.id} className="card" style={{ overflow: 'hidden' }}>
                    {/* File row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px' }}>
                      <StatusIcon size={18} color={color} style={item.status === S.analyzing ? { animation: 'spin 1s linear infinite' } : {}} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontWeight: 600, margin: 0, fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</p>
                        {item.status === S.analyzing && item.progress && (
                          <p className="text-xs" style={{ color: 'var(--blue)', margin: '2px 0 0' }}>
                            {item.progress}
                          </p>
                        )}
                        {item.status === S.done && item.result && (
                          <p className="text-xs" style={{ color: 'var(--text-muted)', margin: '2px 0 0' }}>
                            Spent <span style={{ color: 'var(--red)' }}>{fmt(item.result.total_debit, item.result.currency)}</span>
                            {' · '}Income <span style={{ color: 'var(--emerald)' }}>{fmt(item.result.total_credit, item.result.currency)}</span>
                            {' · '}{item.result.transactions?.length || 0} transactions
                          </p>
                        )}
                        {item.status === S.failed && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                            <p className="text-xs" style={{ color: 'var(--red)', margin: 0 }}>
                              {item.error}
                            </p>
                            <button
                              className="btn btn-ghost btn-sm"
                              style={{ fontSize: '0.7rem', color: 'var(--blue)', padding: '2px 8px' }}
                              onClick={() => retryItem(item.id)}
                            >
                              <RefreshCw size={12} style={{ marginRight: 4 }} /> Retry
                            </button>
                            {item.error?.includes('scanned') && (
                              <button
                                className="btn btn-ghost btn-sm"
                                style={{ fontSize: '0.7rem', color: 'var(--blue)', padding: '2px 8px' }}
                                onClick={() => navigate('/')}
                              >
                                → Upload as Snapshot
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      <span style={{ fontSize: '0.75rem', color, fontWeight: 600 }}>{label}</span>
                      {item.status === S.done && (
                        <button className="btn btn-ghost btn-sm" onClick={() => setExpanded(isExpanded ? null : item.id)}>
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          {isExpanded ? 'Hide' : 'View'}
                        </button>
                      )}
                      {(item.status === S.pending || item.status === S.failed) && !running && (
                        <button className="btn btn-ghost btn-sm" onClick={() => removeItem(item.id)}>
                          <X size={13} />
                        </button>
                      )}
                    </div>

                    {/* Expanded analysis */}
                    {isExpanded && item.result && (
                      <div style={{ borderTop: '1px solid var(--border-subtle)', padding: 24, background: 'var(--bg-secondary)' }}>
                        <ResultsDashboard data={item.result} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {queue.length === 0 && (
          <div className="text-center" style={{ paddingTop: 40 }}>
            <BarChart3 size={40} color="var(--text-muted)" style={{ marginBottom: 12 }} />
            <p className="text-muted">Add PDF files above to get started</p>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  );
}
