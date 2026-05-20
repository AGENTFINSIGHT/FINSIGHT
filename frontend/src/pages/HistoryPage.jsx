import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, FileText, Image, Type, Trash2, Eye, RefreshCw, AlertCircle, Download, FolderOpen } from 'lucide-react';
import { fetchHistory, fetchAnalysisById, deleteAnalysis } from '../utils/apiClient';


const TYPE_ICON  = { pdf: FileText, image: Image, text: Type };
const TYPE_COLOR = { pdf: 'var(--red)', image: 'var(--purple)', text: 'var(--blue)' };

function fmt(n, c = '₹') {
  const locale = c === '₹' ? 'en-IN' : 'en-US';
  return `${c}${Number(n).toLocaleString(locale, { minimumFractionDigits: 2 })}`;
}
function fmtDate(iso) { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }

export default function HistoryPage() {
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [deleting, setDeleting] = useState(null);
  const navigate = useNavigate();

  const load = async () => { setLoading(true); setError(''); const d = await fetchHistory().catch(() => null); if (!d) setError('Failed to load.'); else setAnalyses(d); setLoading(false); };
  useEffect(() => { load(); }, []);

  const handleDelete = async (id) => {
    if (!confirm('Delete this analysis?')) return;
    setDeleting(id);
    const ok = await deleteAnalysis(id);
    setDeleting(null);
    if (ok) setAnalyses(p => p.filter(a => a.id !== id));
  };

  const exportCSV = async (a) => {
    const full = await fetchAnalysisById(a.id);
    if (!full) return;
    const { transactions = [], total_debit = 0, total_credit = 0, currency = '₹' } = full.result_json;

    // Build CSV rows
    const rows = [
      ['FinSight AI — Bank Statement Analysis'],
      ['File', a.file_name],
      ['Exported', new Date().toLocaleString()],
      [],
      ['Date', 'Description', 'Category', 'Type', `Amount (${currency})`],
      ...transactions.map(t => [
        t.date,
        `"${String(t.description).replace(/"/g, '""')}"`,
        t.category,
        t.type.toUpperCase(),
        t.type === 'debit' ? `-${Number(t.amount).toFixed(2)}` : Number(t.amount).toFixed(2),
      ]),
      [],
      ['SUMMARY', '', '', '', ''],
      ['Total Debited (Spent)',  '', '', '', `-${Number(total_debit).toFixed(2)}`],
      ['Total Credited (Income)', '', '', '',  Number(total_credit).toFixed(2)],
      ['Net Balance',           '', '', '',  (Number(total_credit) - Number(total_debit)).toFixed(2)],
      ['Total Transactions',    '', '', '',  transactions.length],
    ];

    const csv  = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const name = a.file_name.replace(/\.[^.]+$/, '') || 'statement';
    Object.assign(document.createElement('a'), { href: url, download: `finsight_${name}_${Date.now()}.csv` }).click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <div style={{ borderBottom: '1px solid var(--border-subtle)', padding: '20px 0', marginBottom: 32 }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--blue-glow)', border: '1px solid rgba(99,179,237,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Clock size={18} color="var(--blue)" /></div>
            <div><h3 style={{ margin: 0 }}>Analysis History</h3><p className="text-xs text-muted">{analyses.length} saved</p></div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/batch')}><FolderOpen size={13} /> Batch Upload</button>
            <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={13} /> Refresh</button>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>← New Analysis</button>
          </div>
        </div>
      </div>

      <div className="container" style={{ paddingBottom: 60 }}>
        {loading && <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>}
        {error && !loading && <div className="alert alert-danger" style={{ maxWidth: 480 }}><AlertCircle size={16} /> {error}</div>}
        {!loading && !error && analyses.length === 0 && (
          <div className="card p-32 text-center" style={{ maxWidth: 420, margin: '60px auto' }}>
            <Clock size={40} color="var(--text-muted)" style={{ marginBottom: 16 }} />
            <h3 style={{ marginBottom: 8 }}>No analyses yet</h3>
            <p className="text-sm text-muted" style={{ marginBottom: 20 }}>Upload a bank statement to get started</p>
            <button className="btn btn-primary" style={{ justifyContent: 'center' }} onClick={() => navigate('/')}>Upload Statement</button>
          </div>
        )}

        {!loading && analyses.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }} className="stagger-children">
            {analyses.map(a => {
              const Icon  = TYPE_ICON[a.file_type]  || FileText;
              const color = TYPE_COLOR[a.file_type] || 'var(--blue)';
              return (
                <div key={a.id} className="card" style={{ padding: '16px 24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}1a`, border: `1px solid ${color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon size={18} color={color} /></div>
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2, fontSize: '0.9rem' }}>{a.file_name}</p>
                      <p className="text-xs text-muted">{fmtDate(a.created_at)}</p>
                    </div>
                    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                      {[['SPENT', fmt(a.total_debit, a.currency), 'var(--red)'], ['INCOME', fmt(a.total_credit, a.currency), 'var(--emerald)'], ['TXNs', a.txn_count, 'var(--text-primary)']].map(([l, v, c]) => (
                        <div key={l} style={{ textAlign: 'center' }}>
                          <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 2 }}>{l}</p>
                          <p style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: c, fontSize: '0.86rem' }}>{v}</p>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/analysis/${a.id}`)}><Eye size={13} /> Open Dashboard</button>
                      <button className="btn btn-ghost btn-sm" title="Export CSV" onClick={() => exportCSV(a)} style={{ color: 'var(--emerald)' }}><Download size={13} /> CSV</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(a.id)} disabled={deleting === a.id} style={{ color: 'var(--red)' }}>
                        {deleting === a.id ? <div className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} /> : <Trash2 size={13} />}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
