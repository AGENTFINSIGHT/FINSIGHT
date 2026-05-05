import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Image, Type, Calendar, Download } from 'lucide-react';
import { fetchAnalysisById } from '../utils/apiClient';
import ResultsDashboard from '../components/ResultsDashboard';

const TYPE_ICON  = { pdf: FileText, image: Image, text: Type };
const TYPE_COLOR = { pdf: 'var(--red)', image: 'var(--purple)', text: 'var(--blue)' };

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmt(n, c = '$') {
  return `${c}${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

export default function AnalysisPage() {
  const { id }    = useParams();
  const navigate  = useNavigate();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    fetchAnalysisById(id)
      .then(setData)
      .catch(() => setError('Analysis not found or you do not have access.'))
      .finally(() => setLoading(false));
  }, [id]);

  const exportCSV = () => {
    if (!data) return;
    const { transactions = [], total_debit = 0, total_credit = 0, currency = '$' } = data.result_json;
    const rows = [
      ['FinSight AI — Bank Statement Analysis'],
      ['File', data.file_name],
      ['Date', fmtDate(data.created_at)],
      ['Exported', new Date().toLocaleString()],
      [],
      ['Date', 'Description', 'Category', 'Type', `Amount (${currency})`],
      ...transactions.map(t => [
        t.date,
        `"${String(t.description).replace(/"/g, '""')}"`,
        t.category, t.type.toUpperCase(),
        t.type === 'debit' ? `-${Number(t.amount).toFixed(2)}` : Number(t.amount).toFixed(2),
      ]),
      [],
      ['SUMMARY', '', '', '', ''],
      ['Total Debited (Spent)',   '', '', '', `-${Number(total_debit).toFixed(2)}`],
      ['Total Credited (Income)', '', '', '',  Number(total_credit).toFixed(2)],
      ['Net Balance',             '', '', '',  (Number(total_credit) - Number(total_debit)).toFixed(2)],
      ['Total Transactions',      '', '', '',  transactions.length],
    ];
    const csv  = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const name = data.file_name.replace(/\.[^.]+$/, '') || 'statement';
    Object.assign(document.createElement('a'), { href: url, download: `finsight_${name}.csv` }).click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* Page header */}
      <div style={{ borderBottom: '1px solid var(--border-subtle)', padding: '16px 0', marginBottom: 32 }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/history')}>
              <ArrowLeft size={14} /> Back to History
            </button>
            {data && (() => {
              const Icon  = TYPE_ICON[data.file_type]  || FileText;
              const color = TYPE_COLOR[data.file_type] || 'var(--blue)';
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}1a`, border: `1px solid ${color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={16} color={color} />
                  </div>
                  <div>
                    <p style={{ fontWeight: 700, margin: 0, fontSize: '0.95rem' }}>{data.file_name}</p>
                    <p className="text-xs text-muted" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Calendar size={10} /> {fmtDate(data.created_at)}
                    </p>
                  </div>
                </div>
              );
            })()}
          </div>

          {data && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {/* Quick stats */}
              <div style={{ display: 'flex', gap: 20 }}>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 2 }}>SPENT</p>
                  <p style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: 'var(--red)', fontSize: '0.9rem' }}>{fmt(data.total_debit, data.currency)}</p>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 2 }}>INCOME</p>
                  <p style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: 'var(--emerald)', fontSize: '0.9rem' }}>{fmt(data.total_credit, data.currency)}</p>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 2 }}>TXNs</p>
                  <p style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{data.txn_count}</p>
                </div>
              </div>
              <button className="btn btn-primary btn-sm" onClick={exportCSV}>
                <Download size={13} /> Export CSV
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="container" style={{ paddingBottom: 60 }}>
        {loading && <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><div className="spinner" style={{ width: 40, height: 40 }} /></div>}
        {error   && <div className="alert alert-danger" style={{ maxWidth: 480 }}>{error}</div>}
        {data    && <ResultsDashboard data={data.result_json} onReset={() => navigate('/')} />}
      </div>
    </div>
  );
}
