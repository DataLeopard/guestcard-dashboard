import React, { useState, useEffect, useCallback, useMemo } from 'react';

const API_URL = 'http://localhost:3001/api/submissions';

function getSubmissions() {
  try {
    return JSON.parse(localStorage.getItem('guestcard_submissions') || '[]');
  } catch {
    console.error('Corrupted guestcard_submissions in localStorage, resetting.');
    localStorage.removeItem('guestcard_submissions');
    return [];
  }
}

async function fetchSubmissions() {
  try {
    const res = await fetch(API_URL);
    if (res.ok) return await res.json();
  } catch { /* API not available, fall through */ }
  return null;
}

function formatRelativeTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getSubmissionsPerDay(submissions) {
  const counts = {};
  const now = new Date();
  // Initialize last 7 days
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    counts[d.toISOString().slice(0, 10)] = 0;
  }
  submissions.forEach(s => {
    const day = new Date(s.submittedAt).toISOString().slice(0, 10);
    if (day in counts) counts[day]++;
  });
  return Object.entries(counts).map(([date, count]) => ({ date, count }));
}

export default function App() {
  const [submissions, setSubmissions] = useState(getSubmissions);
  const [sortField, setSortField] = useState('submittedAt');
  const [sortDir, setSortDir] = useState('desc');
  const [filterStatus, setFilterStatus] = useState('all');
  const [expandedId, setExpandedId] = useState(null);

  // Poll shared API every 2 seconds (falls back to localStorage)
  const refresh = useCallback(async () => {
    const apiData = await fetchSubmissions();
    if (apiData) {
      setSubmissions(prev => {
        const statusMap = new Map(prev.map(s => [s.id, s.status]));
        const merged = apiData.map(s => ({ ...s, status: statusMap.get(s.id) ?? s.status }));
        return JSON.stringify(prev) === JSON.stringify(merged) ? prev : merged;
      });
    } else {
      // Fallback to localStorage if API is not running
      const raw = localStorage.getItem('guestcard_submissions') || '[]';
      setSubmissions(prev => {
        try {
          const next = JSON.parse(raw);
          const statusMap = new Map(prev.map(s => [s.id, s.status]));
          const merged = next.map(s => ({ ...s, status: statusMap.get(s.id) ?? s.status }));
          return JSON.stringify(prev) === JSON.stringify(merged) ? prev : merged;
        } catch { return prev; }
      });
    }
  }, []);

  useEffect(() => {
    window.addEventListener('storage', refresh);
    const interval = setInterval(refresh, 2000);
    return () => {
      window.removeEventListener('storage', refresh);
      clearInterval(interval);
    };
  }, [refresh]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const handleStatusChange = (id, newStatus) => {
    const updated = submissions.map(s => s.id === id ? { ...s, status: newStatus } : s);
    setSubmissions(updated);
    fetch(`${API_URL}/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }) })
      .catch(() => localStorage.setItem('guestcard_submissions', JSON.stringify(updated)));
  };

  const handleDelete = (id) => {
    const updated = submissions.filter(s => s.id !== id);
    setSubmissions(updated);
    fetch(`${API_URL}/${id}`, { method: 'DELETE' })
      .catch(() => localStorage.setItem('guestcard_submissions', JSON.stringify(updated)));
  };

  const handleClearAll = () => {
    if (confirm('Clear all guest card submissions? This cannot be undone.')) {
      setSubmissions([]);
      fetch(API_URL, { method: 'DELETE' })
        .catch(() => localStorage.setItem('guestcard_submissions', '[]'));
    }
  };

  const handleExportCSV = () => {
    if (!submissions.length) return;
    const headers = ['Name', 'Email', 'Phone', 'Move-In', 'Beds', 'Budget', 'Pets', 'Must-Haves', 'Notes', 'Sent To', 'Properties', 'Status', 'Submitted'];
    const rows = submissions.map(s => [
      s.fullName, s.email, s.phone, s.moveIn, s.beds, `$${s.budget}`,
      s.pets, s.extras, s.notes, s.sentTo, s.propertyCount, s.status,
      new Date(s.submittedAt).toLocaleString(),
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `guestcards-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // Filter and sort
  let filtered = filterStatus === 'all' ? submissions : submissions.filter(s => s.status === filterStatus);
  filtered = [...filtered].sort((a, b) => {
    let aVal = a[sortField] ?? '';
    let bVal = b[sortField] ?? '';
    if (sortField === 'submittedAt') return sortDir === 'asc' ? new Date(aVal) - new Date(bVal) : new Date(bVal) - new Date(aVal);
    if (sortField === 'budget' || sortField === 'beds') {
      const aNum = Number(aVal) || 0;
      const bNum = Number(bVal) || 0;
      return sortDir === 'asc' ? aNum - bNum : bNum - aNum;
    }
    const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
    return sortDir === 'asc' ? cmp : -cmp;
  });

  // Stats
  const totalLeads = submissions.length;
  const totalSent = submissions.filter(s => s.status === 'sent').length;
  const totalContacted = submissions.filter(s => s.status === 'contacted').length;
  const totalToured = submissions.filter(s => s.status === 'toured').length;
  const totalPlaced = submissions.filter(s => s.status === 'placed').length;
  const validBudgets = submissions.map(s => Number(s.budget)).filter(n => !isNaN(n) && n > 0);
  const avgBudget = validBudgets.length
    ? Math.round(validBudgets.reduce((a, b) => a + b, 0) / validBudgets.length)
    : 0;

  const dailyData = useMemo(() => getSubmissionsPerDay(submissions), [submissions]);
  const maxDaily = Math.max(...dailyData.map(d => d.count), 1);

  const columns = [
    { key: 'fullName', label: 'Name', width: '140px' },
    { key: 'email', label: 'Email', width: '180px' },
    { key: 'phone', label: 'Phone', width: '130px' },
    { key: 'moveIn', label: 'Move-In', width: '110px' },
    { key: 'beds', label: 'BR', width: '50px' },
    { key: 'budget', label: 'Budget', width: '90px' },
    { key: 'pets', label: 'Pets', width: '70px' },
    { key: 'sentTo', label: 'Sent To', width: '200px' },
    { key: 'status', label: 'Status', width: '120px' },
    { key: 'submittedAt', label: 'Submitted', width: '140px' },
  ];

  const statusColors = {
    sent: '#3b82f6',
    contacted: '#f59e0b',
    toured: '#f97316',
    placed: '#22c55e',
    lost: '#ef4444',
  };

  return (
    <div className="dashboard">
      <header className="dash-header">
        <div className="dash-title-row">
          <div>
            <div className="dash-label">GuestCard &mdash; Live Dashboard</div>
            <h1>Guest Card Submissions</h1>
          </div>
          <div className="dash-actions">
            <button className="action-btn export" onClick={handleExportCSV} disabled={!submissions.length}>Export CSV</button>
            <button className="action-btn clear" onClick={handleClearAll} disabled={!submissions.length}>Clear All</button>
          </div>
        </div>

        <div className="stats-bar">
          {[
            { label: 'Total Leads', value: totalLeads, color: '#3b82f6' },
            { label: 'Sent', value: totalSent, color: '#3b82f6' },
            { label: 'Contacted', value: totalContacted, color: '#f59e0b' },
            { label: 'Toured', value: totalToured, color: statusColors.toured },
            { label: 'Placed', value: totalPlaced, color: '#22c55e' },
            { label: 'Avg Budget', value: avgBudget ? `$${avgBudget.toLocaleString()}` : '—', color: '#e2e0dc' },
          ].map(s => (
            <div key={s.label} className="stat">
              <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
          <div className="stat stat-chart">
            <div className="sparkline" title="Submissions per day (last 7 days)">
              {dailyData.map((d, i) => (
                <div key={d.date} className="spark-bar-wrap" title={`${d.date}: ${d.count}`}>
                  <div
                    className="spark-bar"
                    style={{
                      height: `${Math.max((d.count / maxDaily) * 100, d.count > 0 ? 8 : 2)}%`,
                      background: d.count > 0 ? '#3b82f6' : 'rgba(255,255,255,0.06)',
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="stat-label">7-Day Trend</div>
          </div>
        </div>

        <div className="filter-row">
          <span className="filter-label">Filter:</span>
          {['all', 'sent', 'contacted', 'toured', 'placed', 'lost'].map(s => (
            <button
              key={s}
              className={`filter-btn ${filterStatus === s ? 'active' : ''}`}
              onClick={() => setFilterStatus(s)}
            >
              {s}
            </button>
          ))}
          <span className="live-dot" />
          <span className="live-text">Live — polling every 2s</span>
        </div>
      </header>

      {filtered.length === 0 ? (
        <div className="empty-state">
          {submissions.length === 0 ? (
            <>
              <div className="empty-icon">📋</div>
              <h2>No guest cards yet</h2>
              <p>Open the GuestCard chatbot at <strong>localhost:5175</strong> and complete a search. Submissions will appear here in real-time.</p>
              <div className="empty-steps">
                <div className="empty-step">
                  <div className="step-number">1</div>
                  <span>Open the GuestCard chatbot</span>
                </div>
                <div className="empty-step">
                  <div className="step-number">2</div>
                  <span>Fill out the guest card form</span>
                </div>
                <div className="empty-step">
                  <div className="step-number">3</div>
                  <span>Submissions appear here instantly</span>
                </div>
              </div>
              <div className="empty-pulse-hint">
                <span className="live-dot" />
                <span>Listening for new submissions...</span>
              </div>
            </>
          ) : (
            <>
              <div className="empty-icon">🔍</div>
              <h2>No results</h2>
              <p>No submissions match the <strong>"{filterStatus}"</strong> filter. Try selecting a different status or "all" to see everything.</p>
            </>
          )}
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                {columns.map(col => (
                  <th
                    key={col.key}
                    style={{ width: col.width }}
                    onClick={() => handleSort(col.key)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort(col.key); } }}
                    tabIndex={0}
                    aria-sort={sortField === col.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className={sortField === col.key ? 'sorted' : ''}
                  >
                    {col.label}
                    {sortField === col.key && (
                      <span className="sort-arrow">{sortDir === 'asc' ? ' ▲' : ' ▼'}</span>
                    )}
                  </th>
                ))}
                <th style={{ width: '80px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(sub => (
                <React.Fragment key={sub.id}>
                  <tr className={expandedId === sub.id ? 'expanded' : ''} aria-expanded={expandedId === sub.id} onClick={() => setExpandedId(expandedId === sub.id ? null : sub.id)}>
                    <td className="name-cell">{sub.fullName}</td>
                    <td>{sub.email}</td>
                    <td>{sub.phone}</td>
                    <td>{sub.moveIn}</td>
                    <td className="center">{sub.beds}</td>
                    <td>${(Number(sub.budget) || 0).toLocaleString()}</td>
                    <td>{sub.pets}</td>
                    <td className="sentto-cell">{sub.sentTo}</td>
                    <td>
                      <select
                        className="status-select"
                        value={sub.status}
                        aria-label={`Status for ${sub.fullName}`}
                        onChange={e => { e.stopPropagation(); handleStatusChange(sub.id, e.target.value); }}
                        onClick={e => e.stopPropagation()}
                        style={{
                          borderColor: statusColors[sub.status],
                          color: statusColors[sub.status],
                          backgroundColor: `${statusColors[sub.status]}15`,
                        }}
                      >
                        <option value="sent">Sent</option>
                        <option value="contacted">Contacted</option>
                        <option value="toured">Toured</option>
                        <option value="placed">Placed</option>
                        <option value="lost">Lost</option>
                      </select>
                    </td>
                    <td
                      className="date-cell"
                      title={sub.submittedAt ? new Date(sub.submittedAt).toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' }) : ''}
                    >
                      {formatRelativeTime(sub.submittedAt)}
                    </td>
                    <td>
                      <button className="delete-btn" aria-label={`Delete ${sub.fullName}`} onClick={e => { e.stopPropagation(); handleDelete(sub.id); }} title="Delete">✕</button>
                    </td>
                  </tr>
                  {expandedId === sub.id && (
                    <tr key={`${sub.id}-detail`} className="detail-row">
                      <td colSpan={columns.length + 1}>
                        <div className="detail-grid">
                          <div><span>Must-Haves</span><strong>{sub.extras}</strong></div>
                          <div><span>Notes</span><strong>{sub.notes || '—'}</strong></div>
                          <div><span>Sent To Emails</span><strong>{sub.sentToEmails}</strong></div>
                          <div><span>Properties Contacted</span><strong>{sub.propertyCount}</strong></div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <footer className="dash-footer">
        GuestCard Dashboard &mdash; built in the Lab &middot; 2026
      </footer>
    </div>
  );
}
