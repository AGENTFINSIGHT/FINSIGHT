import { Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

const CATEGORY_COLORS = {
  Food:          '#f6ad55',
  Fuel:          '#fc8181',
  Travel:        '#76e4f7',
  Shopping:      '#b794f4',
  Bills:         '#63b3ed',
  Entertainment: '#f687b3',
  Healthcare:    '#48bb78',
  Others:        '#718096',
};

function formatAmount(amount, currency) {
  return `${currency}${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function CategoryChart({ categorySummary, currency = '$' }) {
  const entries = Object.entries(categorySummary).filter(([, v]) => v > 0);
  const total = entries.reduce((s, [, v]) => s + Number(v), 0);

  if (entries.length === 0) {
    return <p className="text-muted text-center" style={{ padding: 40 }}>No category data available.</p>;
  }

  const data = {
    labels: entries.map(([k]) => k),
    datasets: [{
      data: entries.map(([, v]) => Number(v)),
      backgroundColor: entries.map(([k]) => CATEGORY_COLORS[k] || '#718096'),
      borderColor: entries.map(([k]) => CATEGORY_COLORS[k] || '#718096'),
      borderWidth: 2,
      hoverOffset: 8,
    }],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '70%',
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0f1628',
        borderColor: 'rgba(99,179,237,0.3)',
        borderWidth: 1,
        titleColor: '#f0f4ff',
        bodyColor: '#8892a4',
        padding: 12,
        callbacks: {
          label: (ctx) => {
            const pct = ((ctx.parsed / total) * 100).toFixed(1);
            return ` ${formatAmount(ctx.parsed, currency)} (${pct}%)`;
          },
        },
      },
    },
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, alignItems: 'center' }}>
      {/* Chart */}
      <div style={{ height: 280, position: 'relative' }}>
        <Doughnut data={data} options={options} />
        {/* Center label */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total Spent</span>
          <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '1.4rem', color: 'var(--text-primary)' }}>
            {formatAmount(total, currency)}
          </span>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {entries
          .sort(([, a], [, b]) => Number(b) - Number(a))
          .map(([cat, amount]) => {
            const pct = ((Number(amount) / total) * 100).toFixed(1);
            return (
              <div key={cat}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: CATEGORY_COLORS[cat] || '#718096', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.84rem', color: 'var(--text-primary)', fontWeight: 500 }}>{cat}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>
                      {formatAmount(amount, currency)}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 6 }}>{pct}%</span>
                  </div>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${pct}%`, background: CATEGORY_COLORS[cat] || '#718096' }} />
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
