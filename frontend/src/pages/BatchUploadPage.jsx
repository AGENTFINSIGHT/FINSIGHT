import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FolderOpen, Folder, Upload, Play, CheckCircle2, XCircle,
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

// Recursively walk a directory entry to find all PDF files
async function traverseFileTree(item) {
  return new Promise((resolve) => {
    if (item.isFile) {
      if (item.name.toLowerCase().endsWith('.pdf')) {
        item.file(
          (file) => resolve([file]),
          () => resolve([])
        );
      } else {
        resolve([]);
      }
    } else if (item.isDirectory) {
      const dirReader = item.createReader();
      const allEntries = [];
      
      const readEntries = () => {
        dirReader.readEntries(async (entries) => {
          if (entries.length > 0) {
            allEntries.push(...entries);
            readEntries();
          } else {
            const files = [];
            for (const entry of allEntries) {
              const subFiles = await traverseFileTree(entry);
              files.push(...subFiles);
            }
            resolve(files);
          }
        }, () => resolve([]));
      };
      
      readEntries();
    } else {
      resolve([]);
    }
  });
}

export default function BatchUploadPage() {
  const { queue, running, addFiles, removeItem, clearDone, retryItem, runAll, stopAll } = useBatch();
  const [expanded, setExpanded] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState({});
  const fileRef = useRef();
  const folderRef = useRef();
  const navigate = useNavigate();

  // Automatically expand newly added folders
  useEffect(() => {
    const foldersInQueue = [...new Set(queue.map(item => item.folderPath || 'Direct Uploads'))];
    setExpandedFolders(prev => {
      const next = { ...prev };
      foldersInQueue.forEach(folder => {
        if (next[folder] === undefined) {
          next[folder] = true; // default to expanded
        }
      });
      return next;
    });
  }, [queue]);

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

  const uploadedCount = queue.filter(q => q.uploadStatus === 'uploaded' || q.status === S.done).length;
  const uploadPercent = queue.length > 0 ? Math.round((uploadedCount / queue.length) * 100) : 0;
  const analyzePercent = queue.length > 0 ? Math.round((doneCount / queue.length) * 100) : 0;

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
            onDrop={async (e) => {
              e.preventDefault();
              setDragOver(false);
              const items = e.dataTransfer.items;
              if (items && items.length > 0) {
                const filePromises = [];
                for (let i = 0; i < items.length; i++) {
                  const entry = items[i].webkitGetAsEntry();
                  if (entry) {
                    filePromises.push(traverseFileTree(entry));
                  }
                }
                const filesArrays = await Promise.all(filePromises);
                const allFiles = filesArrays.flat();
                if (allFiles.length > 0) {
                  addFiles(allFiles);
                }
              } else {
                addFiles(e.dataTransfer.files);
              }
            }}
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

            {/* Dual Progress Bars */}
            {(running || doneCount + failedCount > 0) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20, padding: '16px 20px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-subtle)', borderRadius: 12 }}>
                {/* Upload Progress */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, fontSize: '0.78rem' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>1. Text Extraction & Storage Upload Progress</span>
                    <span style={{ fontWeight: 700, color: 'var(--blue)' }}>{uploadPercent}%</span>
                  </div>
                  <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 99,
                      width: `${uploadPercent}%`,
                      background: 'linear-gradient(90deg, #60a5fa, #3b82f6)',
                      transition: 'width 0.4s ease',
                    }} />
                  </div>
                </div>

                {/* AI Analysis Progress */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, fontSize: '0.78rem' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>2. Gemini AI Financial Analysis Progress</span>
                    <span style={{ fontWeight: 700, color: 'var(--emerald)' }}>{analyzePercent}%</span>
                  </div>
                  <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 99,
                      width: `${analyzePercent}%`,
                      background: failedCount > 0 ? 'linear-gradient(90deg, var(--emerald), var(--amber))' : 'linear-gradient(90deg, #34d399, #10b981)',
                      transition: 'width 0.4s ease',
                    }} />
                  </div>
                </div>
              </div>
            )}

            {/* Group queue by folderPath */}
            {(() => {
              const groupedQueue = {};
              queue.forEach(item => {
                const folderKey = item.folderPath || 'Direct Uploads';
                if (!groupedQueue[folderKey]) {
                  groupedQueue[folderKey] = [];
                }
                groupedQueue[folderKey].push(item);
              });

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {Object.entries(groupedQueue).map(([folderName, items]) => {
                    const isFolderExpanded = expandedFolders[folderName];
                    const doneCount = items.filter(item => item.status === S.done).length;
                    const failedCount = items.filter(item => item.status === S.failed).length;
                    const folderPercent = items.length > 0 ? Math.round((doneCount / items.length) * 100) : 0;
                    const hasFailed = failedCount > 0;

                    return (
                      <div key={folderName} className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border-subtle)', background: 'rgba(255, 255, 255, 0.01)' }}>
                        {/* Folder Header */}
                        <div 
                          onClick={() => setExpandedFolders(prev => ({ ...prev, [folderName]: !prev[folderName] }))}
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'space-between', 
                            padding: '16px 20px', 
                            background: 'var(--bg-secondary)', 
                            cursor: 'pointer',
                            userSelect: 'none',
                            borderBottom: isFolderExpanded ? '1px solid var(--border-subtle)' : 'none',
                            transition: 'background 0.2s',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                            <div style={{ 
                              width: 36, 
                              height: 36, 
                              borderRadius: 10, 
                              background: 'var(--blue-glow)', 
                              border: '1px solid rgba(99,179,237,0.2)', 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center',
                              flexShrink: 0
                            }}>
                              {isFolderExpanded ? (
                                <FolderOpen size={18} color="var(--blue)" />
                              ) : (
                                <Folder size={18} color="var(--blue)" />
                              )}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {folderName}
                              </h4>
                              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                                {items.length} PDF{items.length !== 1 ? 's' : ''} • {doneCount} completed {hasFailed && `• ${failedCount} failed`}
                              </span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            {/* Mini Folder Progress Bar */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: 140, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                              <div style={{ flex: 1, height: 5, background: 'rgba(255,255,255,0.05)', borderRadius: 99, overflow: 'hidden' }}>
                                <div style={{ 
                                  height: '100%', 
                                  width: `${folderPercent}%`, 
                                  background: hasFailed ? 'linear-gradient(90deg, var(--emerald), var(--amber))' : 'linear-gradient(90deg, var(--blue), var(--emerald))',
                                  borderRadius: 99,
                                  transition: 'width 0.4s ease'
                                }} />
                              </div>
                              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: folderPercent === 100 ? 'var(--emerald)' : 'var(--text-secondary)', width: 34, textAlign: 'right' }}>
                                {folderPercent}%
                              </span>
                            </div>
                            
                            <button className="btn btn-ghost btn-sm" style={{ padding: 4 }} onClick={(e) => {
                              e.stopPropagation();
                              setExpandedFolders(prev => ({ ...prev, [folderName]: !prev[folderName] }));
                            }}>
                              {isFolderExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                          </div>
                        </div>

                        {/* Folder Contents */}
                        {isFolderExpanded && (
                          <div style={{ 
                            padding: '16px 20px', 
                            display: 'flex', 
                            flexDirection: 'column', 
                            gap: 12,
                            borderLeft: '2px dashed var(--border-subtle)',
                            marginLeft: '36px',
                            marginTop: '12px',
                            marginBottom: '12px',
                            paddingLeft: '20px'
                          }}>
                            {items.map(item => {
                              const { icon: StatusIcon, color, label } = STATUS_UI[item.status];
                              const isExpanded = expanded === item.id;
                              return (
                                <div key={item.id} className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border-subtle)', background: 'var(--bg-primary)' }}>
                                  {/* File row */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 18px' }}>
                                    <StatusIcon size={16} color={color} style={item.status === S.analyzing ? { animation: 'spin 1s linear infinite' } : {}} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <p style={{ fontWeight: 600, margin: 0, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {item.name}
                                      </p>
                                      {item.status === S.analyzing && item.progress && (
                                        <p className="text-xs" style={{ color: 'var(--blue)', margin: '2px 0 0' }}>
                                          {item.progress}
                                        </p>
                                      )}
                                      {item.status === S.done && item.result && (
                                        <p className="text-xs" style={{ color: 'var(--text-muted)', margin: '2px 0 0' }}>
                                          Spent <span style={{ color: 'var(--red)' }}>{fmt(item.result.total_debit, item.result.currency)}</span>
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
                                    <span style={{ fontSize: '0.72rem', color, fontWeight: 600 }}>{label}</span>
                                    {item.status === S.done && (
                                      <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => setExpanded(isExpanded ? null : item.id)}>
                                        {isExpanded ? <ChevronUp size={12} style={{ marginRight: 4 }} /> : <ChevronDown size={12} style={{ marginRight: 4 }} />}
                                        {isExpanded ? 'Hide' : 'View'}
                                      </button>
                                    )}
                                    {(item.status === S.pending || item.status === S.failed) && !running && (
                                      <button className="btn btn-ghost btn-sm" style={{ padding: 4 }} onClick={() => removeItem(item.id)}>
                                        <X size={12} />
                                      </button>
                                    )}
                                  </div>

                                  {/* Expanded analysis */}
                                  {isExpanded && item.result && (
                                    <div style={{ borderTop: '1px solid var(--border-subtle)', padding: 20, background: 'var(--bg-secondary)' }}>
                                      <ResultsDashboard data={item.result} />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
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
