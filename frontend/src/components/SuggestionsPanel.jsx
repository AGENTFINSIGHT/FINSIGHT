import { Lightbulb, CheckCircle2, ArrowRight } from 'lucide-react';

const PRIORITY_COLORS = ['var(--red)', 'var(--amber)', 'var(--blue)', 'var(--emerald)', 'var(--purple)'];
const PRIORITY_LABELS = ['High Priority', 'Important', 'Recommended', 'Helpful', 'Bonus Tip'];

export default function SuggestionsPanel({ suggestions }) {
  if (!suggestions || suggestions.length === 0) {
    return <div className="empty-state"><p>No suggestions available.</p></div>;
  }

  return (
    <div className="flex flex-col gap-12 stagger-children">
      <div className="alert alert-info">
        <Lightbulb size={16} className="shrink-0" />
        <span>Here are personalized recommendations based on your spending patterns:</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
        {suggestions.map((s, i) => {
          const color = PRIORITY_COLORS[i % PRIORITY_COLORS.length];
          const label = PRIORITY_LABELS[i % PRIORITY_LABELS.length];
          return (
            <div
              key={i}
              className="card"
              style={{
                padding: '20px 24px',
                borderLeft: `3px solid ${color}`,
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{
                  fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.08em', color,
                }}>{label}</span>
                <CheckCircle2 size={16} color={color} opacity={0.6} />
              </div>
              <p style={{ color: 'var(--text-primary)', fontSize: '0.875rem', lineHeight: 1.7, margin: 0 }}>{s}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
