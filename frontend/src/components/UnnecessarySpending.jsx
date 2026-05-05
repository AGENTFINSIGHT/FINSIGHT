import { AlertTriangle } from 'lucide-react';

export default function UnnecessarySpending({ items }) {
  if (!items || items.length === 0) {
    return (
      <div className="alert alert-success">
        <AlertTriangle size={16} />
        <span>No unnecessary spending patterns detected — great financial discipline!</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-12 stagger-children">
      <div className="alert alert-warning">
        <AlertTriangle size={16} className="shrink-0" />
        <span>The following spending patterns may be avoidable or reducible:</span>
      </div>
      {items.map((item, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 14,
            padding: '16px 20px',
            background: 'var(--red-glow)',
            border: '1px solid rgba(252,129,129,0.15)',
            borderRadius: 'var(--radius-md)',
            borderLeft: '3px solid var(--red)',
          }}
        >
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'rgba(252,129,129,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, marginTop: 1,
          }}>
            <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, color: 'var(--red)', fontSize: '0.85rem' }}>
              {i + 1}
            </span>
          </div>
          <p style={{ color: 'var(--text-primary)', fontSize: '0.875rem', lineHeight: 1.6, margin: 0 }}>{item}</p>
        </div>
      ))}
    </div>
  );
}
