import { TrendingUp, AlertTriangle, Lightbulb, BarChart2, Star } from 'lucide-react';

const ICON_MAP = [TrendingUp, BarChart2, Star, AlertTriangle, Lightbulb];
const COLOR_MAP = ['var(--blue)', 'var(--purple)', 'var(--amber)', 'var(--red)', 'var(--emerald)'];
const BG_MAP = ['var(--blue-glow)', 'var(--purple-glow)', 'var(--amber-glow)', 'var(--red-glow)', 'var(--emerald-glow)'];

export default function InsightsPanel({ insights }) {
  if (!insights || insights.length === 0) {
    return <div className="empty-state"><p>No insights generated.</p></div>;
  }

  return (
    <div className="insight-grid stagger-children">
      {insights.map((insight, i) => {
        const Icon = ICON_MAP[i % ICON_MAP.length];
        const color = COLOR_MAP[i % COLOR_MAP.length];
        const bg = BG_MAP[i % BG_MAP.length];
        return (
          <div key={i} className="insight-card">
            <div className="insight-icon" style={{ background: bg, border: `1px solid ${color}33` }}>
              <Icon size={18} color={color} />
            </div>
            <div>
              <p style={{ color: 'var(--text-primary)', fontSize: '0.875rem', lineHeight: 1.6 }}>{insight}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
