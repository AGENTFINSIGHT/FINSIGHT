import { useState } from 'react';
import {
  List, PieChart, Lightbulb,
  MessageSquare, TrendingDown, TrendingUp,
  Receipt, Check
} from 'lucide-react';
import TransactionsTable from './TransactionsTable';
import CategoryChart from './CategoryChart';
import InsightsPanel from './InsightsPanel';
import SuggestionsPanel from './SuggestionsPanel';
import ChatBot from './ChatBot';

const TABS = [
  { id: 'transactions', label: 'Transactions',   icon: List },
  { id: 'chart',        label: 'Spending Chart', icon: PieChart },
  { id: 'insights',     label: 'Insights',       icon: Lightbulb },
  { id: 'suggestions',  label: 'Suggestions',    icon: Receipt },
  { id: 'chat',         label: 'AI Chat',        icon: MessageSquare },
];

function fmt(amount, currency = '$') {
  return `${currency}${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ResultsDashboard({ data, onReset, apiKey, saved = false }) {
  const [activeTab, setActiveTab] = useState('transactions');
  const currency = data.currency || '$';

  const totalDebit  = data.total_debit  || 0;
  const totalCredit = data.total_credit || 0;
  const txnCount    = data.transactions?.length || 0;
  const topCat      = Object.entries(data.category_summary || {})
    .sort(([, a], [, b]) => Number(b) - Number(a))[0]?.[0] || '—';

  return (
    <div className="animate-fade">
      {/* Saved badge */}
      {saved && (
        <div className="alert alert-success mb-16" style={{ maxWidth: 340 }}>
          <Check size={14} /> Analysis saved to your history
        </div>
      )}

      {/* Summary Stats */}
      <div className="stat-grid mb-24 stagger-children">
        <div className="stat-card blue">
          <div className="stat-label">Total Spent</div>
          <div className="stat-value">{fmt(totalDebit, currency)}</div>
          <div className="stat-sub flex items-center gap-4"><TrendingDown size={11} /> Total debits</div>
        </div>
        <div className="stat-card emerald">
          <div className="stat-label">Total Income</div>
          <div className="stat-value">{fmt(totalCredit, currency)}</div>
          <div className="stat-sub flex items-center gap-4"><TrendingUp size={11} /> Total credits</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-label">Transactions</div>
          <div className="stat-value">{txnCount}</div>
          <div className="stat-sub">Records analyzed</div>
        </div>
        <div className="stat-card red">
          <div className="stat-label">Top Category</div>
          <div className="stat-value" style={{ fontSize: '1.4rem' }}>{topCat}</div>
          <div className="stat-sub">Highest spend area</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs mb-24">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} id={`tab-${id}`} className={`tab-btn ${activeTab === id ? 'active' : ''}`} onClick={() => setActiveTab(id)}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="card p-24 animate-fade" key={activeTab}>
        {activeTab === 'transactions' && <TransactionsTable transactions={data.transactions || []} currency={currency} />}
        {activeTab === 'chart'        && <CategoryChart categorySummary={data.category_summary || {}} currency={currency} />}
        {activeTab === 'insights'     && <InsightsPanel insights={data.insights || []} />}
        {activeTab === 'suggestions'  && <SuggestionsPanel suggestions={data.suggestions || []} />}
        {activeTab === 'chat'         && <ChatBot financialData={data} />}
      </div>

      {onReset && (
        <div className="text-center mt-24">
          <button className="btn btn-ghost" id="btn-analyze-new" onClick={onReset}>Analyze Another Statement</button>
        </div>
      )}
    </div>
  );
}
