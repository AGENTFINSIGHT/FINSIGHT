import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, RefreshCw, BarChart2, Tag, AlertCircle, Clock, FileStack } from 'lucide-react';
import { fetchHistory } from '../utils/apiClient';
import { fetchAnalysisById } from '../utils/apiClient';
import TotalDuesSnapshot from '../components/TotalDuesSnapshot';
import SpendCategorySnapshot from '../components/SpendCategorySnapshot';
import HistorySnapshot from '../components/HistorySnapshot';
import PdfExpenditureSnapshot from '../components/PdfExpenditureSnapshot';
import RemainingDuesSnapshot from '../components/RemainingDuesSnapshot';
import { sanitizeAnalyses } from '../utils/dashboardUtils';

const TABS = [
  { key: 'snapshot',      label: 'Total Dues Snapshot',    icon: BarChart2   },
  { key: 'pdf_spend',     label: 'PDF Expenditure',        icon: FileStack   },
  { key: 'remaining_due', label: 'Remaining Dues',        icon: AlertCircle },
  { key: 'categories',   label: 'Spend Category Snapshot', icon: Tag         },
  { key: 'history',      label: 'Upload History',          icon: Clock       },
];

export default function DashboardPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('snapshot');
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      // fetchHistory returns summary rows; we need full result_json for each
      const summaries = await fetchHistory();
      const full = await Promise.all(summaries.map(s => fetchAnalysisById(s.id)));
      setAnalyses(sanitizeAnalyses(full.filter(Boolean)));
    } catch (e) {
      setError('Failed to load analyses. ' + (e.message || ''));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* Page header */}
      <div style={{ borderBottom: '1px solid var(--border-subtle)', padding: '18px 0', marginBottom: 32 }}>
        <div className="container page-header-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--blue-glow)', border: '1px solid rgba(99,179,237,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <LayoutDashboard size={18} color="var(--blue)" />
            </div>
            <div>
              <h3 style={{ margin: 0 }}>Dashboard</h3>
              <p className="text-xs text-muted">{analyses.length} statement{analyses.length !== 1 ? 's' : ''} analysed</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={13} /> Refresh</button>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>← Upload Statement</button>
          </div>
        </div>
      </div>

      <div className="container" style={{ paddingBottom: 60 }}>
        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 28, background: 'var(--bg-card)', padding: 4, borderRadius: 12, border: '1px solid var(--border-subtle)', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {TABS.map(t => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 18px', borderRadius: 9, border: 'none', cursor: 'pointer', fontWeight: active ? 700 : 500, fontSize: '0.84rem', transition: 'all 0.2s', background: active ? 'var(--bg-primary)' : 'transparent', color: active ? 'var(--blue)' : 'var(--text-muted)', boxShadow: active ? '0 2px 8px rgba(0,0,0,0.2)' : 'none', whiteSpace: 'nowrap' }}>
                <Icon size={14} />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* States */}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
            <div className="spinner" style={{ width: 40, height: 40 }} />
          </div>
        )}
        {error && !loading && (
          <div className="alert alert-danger" style={{ maxWidth: 480 }}>
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {/* Tab content */}
        {!loading && !error && tab === 'snapshot' && (
          <TotalDuesSnapshot analyses={analyses} />
        )}
        {!loading && !error && tab === 'pdf_spend' && (
          <PdfExpenditureSnapshot analyses={analyses} />
        )}
        {!loading && !error && tab === 'remaining_due' && (
          <RemainingDuesSnapshot analyses={analyses} />
        )}
        {!loading && !error && tab === 'categories' && (
          <SpendCategorySnapshot analyses={analyses} />
        )}
        {!loading && !error && tab === 'history' && (
          <HistorySnapshot analyses={analyses} onDeleted={load} />
        )}
      </div>
    </div>
  );
}
