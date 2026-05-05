import { useState, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Search, Filter } from 'lucide-react';

const CATEGORIES = ['All', 'Food', 'Fuel', 'Travel', 'Shopping', 'Bills', 'Entertainment', 'Healthcare', 'Others'];

function formatAmount(amount, currency) {
  return `${currency}${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function TransactionsTable({ transactions, currency = '$' }) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [sortKey, setSortKey] = useState('date');
  const [sortDir, setSortDir] = useState('desc');

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const filtered = useMemo(() => {
    return transactions
      .filter(t => {
        const q = search.toLowerCase();
        const matchSearch = !q ||
          t.description?.toLowerCase().includes(q) ||
          t.category?.toLowerCase().includes(q) ||
          t.date?.includes(q);
        const matchCat = categoryFilter === 'All' || t.category === categoryFilter;
        const matchType = typeFilter === 'All' || t.type === typeFilter;
        return matchSearch && matchCat && matchType;
      })
      .sort((a, b) => {
        let va = a[sortKey], vb = b[sortKey];
        if (sortKey === 'amount') { va = Number(va); vb = Number(vb); }
        else { va = String(va || ''); vb = String(vb || ''); }
        if (va < vb) return sortDir === 'asc' ? -1 : 1;
        if (va > vb) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
  }, [transactions, search, categoryFilter, typeFilter, sortKey, sortDir]);

  const SortIcon = ({ col }) => {
    if (sortKey !== col) return <ArrowUpDown size={12} opacity={0.4} />;
    return sortDir === 'asc' ? <ArrowUp size={12} color="var(--blue)" /> : <ArrowDown size={12} color="var(--blue)" />;
  };

  return (
    <div>
      {/* Filters */}
      <div className="filter-bar mb-16">
        <div className="relative flex-1" style={{ minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            id="txn-search"
            className="input"
            style={{ paddingLeft: 36 }}
            placeholder="Search transactions…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          id="txn-category-filter"
          className="input"
          style={{ width: 'auto' }}
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
        >
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
        <select
          id="txn-type-filter"
          className="input"
          style={{ width: 'auto' }}
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
        >
          <option>All</option>
          <option value="debit">Debit</option>
          <option value="credit">Credit</option>
        </select>
        <span className="text-xs text-muted" style={{ whiteSpace: 'nowrap' }}>
          {filtered.length} of {transactions.length} txns
        </span>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              {[
                { key: 'date', label: 'Date' },
                { key: 'description', label: 'Description' },
                { key: 'category', label: 'Category' },
                { key: 'type', label: 'Type' },
                { key: 'amount', label: 'Amount' },
              ].map(col => (
                <th key={col.key} onClick={() => handleSort(col.key)} className="select-none">
                  <span className="flex items-center gap-4">
                    {col.label} <SortIcon col={col.key} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center" style={{ padding: '40px 16px', color: 'var(--text-muted)' }}>
                  No transactions match your filters
                </td>
              </tr>
            ) : (
              filtered.map((t, i) => (
                <tr key={i}>
                  <td className="font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>{t.date}</td>
                  <td style={{ fontWeight: 500, maxWidth: 260 }}>
                    <span style={{
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block'
                    }}>
                      {t.description}
                    </span>
                  </td>
                  <td>
                    <span className={`badge badge-${t.category?.toLowerCase() || 'others'}`}>
                      {t.category}
                    </span>
                  </td>
                  <td>
                    <span className={`badge badge-${t.type?.toLowerCase()}`}>
                      {t.type}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: t.type === 'credit' ? 'var(--emerald)' : 'var(--red)' }}>
                    {t.type === 'credit' ? '+' : '-'}{formatAmount(t.amount, currency)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
