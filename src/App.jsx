import { useState, useEffect, useCallback } from 'react';

function getSubmissions() {
  return JSON.parse(localStorage.getItem('guestcard_submissions') || '[]');
}

export default function App() {
  const [submissions, setSubmissions] = useState(getSubmissions);
  const [sortField, setSortField] = useState('submittedAt');
  const [sortDir, setSortDir] = useState('desc');
  const [filterStatus, setFilterStatus] = useState('all');
  const [expandedId, setExpandedId] = useState(null);

  // Poll localStorage every 2 seconds AND listen for storage events
  const refresh = useCallback(() => setSubmissions(getSubmissions()), []);

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
    localStorage.setItem('guestcard_submissions', JSON.stringify(updated));
  };

  const handleDelete = (id) => {
    const updated = submissions.filter(s => s.id !== id);
    setSubmissions(updated);
    localStorage.setItem('guestcard_submissions', JSON.stringify(updated));
  };

  const handleClearAll = () => {
    if (confirm('Clear all guest card submissions? This cannot be undone.')) {
      setSubmissions([]);
      localStorage.setItem('guestcard_submissions', '[]');
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
    URL.revokeObjectURL(url);
  };

  // Filter and sort
  let filtered = filterStatus === 'all' ? submissions : submissions.filter(s => s.status === filterStatus);
  filtered = [...filtered].sort((a, b) => {
    const aVal = a[sortField] || '';
    const bVal = b[sortField] || '';
    const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
    return sortDir === 'asc' ? cmp : -cmp;
  });

  // Stats
  const totalLeads = submissions.length;
  const totalSent = submissions.filter(s => s.status === 'sent').length;
  const totalContacted = submissions.filter(s => s.status === 'contacted').length;
  const totalToured = submissions.filter(s => s.status === 'toured').length;
  const totalPlaced = submissions.filter(s => s.status === 'placed').length;
  const avgBudget = submissions.length
    ? Math.round(submissions.reduce((a, s) => a + Number(s.budget), 0) / submissions.length)
    : 0;

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
    toured: '#8b5cf6',
    placed: '#22c55e',
    lost: '#6b7280',
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
            { label: 'Toured', value: totalToured, color: '#8b5cf6' },
            { label: 'Placed', value: totalPlaced, color: '#22c55e' },
            { label: 'Avg Budget', value: avgBudget ? `$${avgBudget.toLocaleString()}` : '—', color: '#e2e0dc' },
          ].map(s => (
            <div key={s.label} className="stat">
              <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
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
            </>
          ) : (
            <p>No submissions match the "{filterStatus}" filter.</p>
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
                <>
                  <tr key={sub.id} className={expandedId === sub.id ? 'expanded' : ''} onClick={() => setExpandedId(expandedId === sub.id ? null : sub.id)}>
                    <td className="name-cell">{sub.fullName}</td>
                    <td>{sub.email}</td>
                    <td>{sub.phone}</td>
                    <td>{sub.moveIn}</td>
                    <td className="center">{sub.beds}</td>
                    <td>${Number(sub.budget).toLocaleString()}</td>
                    <td>{sub.pets}</td>
                    <td className="sentto-cell">{sub.sentTo}</td>
                    <td>
                      <select
                        className="status-select"
                        value={sub.status}
                        onChange={e => { e.stopPropagation(); handleStatusChange(sub.id, e.target.value); }}
                        onClick={e => e.stopPropagation()}
                        style={{ borderColor: statusColors[sub.status], color: statusColors[sub.status] }}
                      >
                        <option value="sent">Sent</option>
                        <option value="contacted">Contacted</option>
                        <option value="toured">Toured</option>
                        <option value="placed">Placed</option>
                        <option value="lost">Lost</option>
                      </select>
                    </td>
                    <td className="date-cell">{new Date(sub.submittedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</td>
                    <td>
                      <button className="delete-btn" onClick={e => { e.stopPropagation(); handleDelete(sub.id); }} title="Delete">✕</button>
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
                </>
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
