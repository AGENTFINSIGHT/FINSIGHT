import { X } from 'lucide-react';

const TH = { padding: '10px 16px', fontWeight: 600, fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-subtle)' };
const TD = { padding: '10px 16px', color: 'var(--text-primary)', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.84rem' };

export default function TransactionModal({ title, transactions = [], onClose }) {
  const debits = transactions.filter(t => t.type === 'debit');
  const total = debits.reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const fmt = n => Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 });

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 16, width: '100%', maxWidth: 760, maxHeight: '82vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}
      >
        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex', alignItems: 'center' }}>
            <X size={18} />
          </button>
        </div>

        {/* Table */}
        <div style={{ overflow: 'auto', flex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
            <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-primary)' }}>
              <tr>
                <th style={{ ...TH, textAlign: 'left', width: 110 }}>Date</th>
                <th style={{ ...TH, textAlign: 'left' }}>Transaction Details</th>
                <th style={{ ...TH, textAlign: 'right', width: 140 }}>Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr><td colSpan={3} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No transactions for this period</td></tr>
              ) : (
                transactions.map((t, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                    <td style={{ ...TD, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>{t.date}</td>
                    <td style={{ ...TD }}>{t.description}</td>
                    <td style={{ ...TD, textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: t.type === 'credit' ? 'var(--emerald)' : 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                      {t.type === 'credit' ? '+' : ''}{fmt(t.amount)}{t.type === 'credit' ? ' CR' : ''}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 24px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <span className="text-sm text-muted">{transactions.length} transaction{transactions.length !== 1 ? 's' : ''}</span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: 'var(--red)', fontSize: '0.9rem' }}>
            Total Spend: ₹{fmt(total)}
          </span>
        </div>
      </div>
    </div>
  );
}
