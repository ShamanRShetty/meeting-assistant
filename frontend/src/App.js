import { useState } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';

const API = process.env.REACT_APP_API_URL || '/api';

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300&family=DM+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #0d0f14;
    --surface: #13161d;
    --surface-2: #1a1e28;
    --border: #252a38;
    --border-hover: #353d52;
    --text-primary: #e8eaf0;
    --text-secondary: #7b82a0;
    --text-muted: #4a5068;
    --accent: #4f8ef7;
    --accent-dim: rgba(79,142,247,0.12);
    --accent-hover: #6ba3f9;
    --green: #3ecf7a;
    --green-dim: rgba(62,207,122,0.1);
    --amber: #f5a623;
    --amber-dim: rgba(245,166,35,0.1);
    --red: #f55656;
    --red-dim: rgba(245,86,86,0.1);
    --radius: 10px;
    --font: 'DM Sans', sans-serif;
    --mono: 'DM Mono', monospace;
  }

  body {
    background: var(--bg);
    color: var(--text-primary);
    font-family: var(--font);
    font-size: 16px;
    line-height: 1.6;
    min-height: 100vh;
  }

  .app {
    max-width: 1000px;
    margin: 0 auto;
    padding: 40px 24px 80px;
  }

  /* Header */
  .header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    margin-bottom: 40px;
    padding-bottom: 28px;
    border-bottom: 1px solid var(--border);
  }
  .header-left {}
  .header-eyebrow {
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--accent);
    margin-bottom: 6px;
  }
  .header-title {
    font-size: 26px;
    font-weight: 600;
    color: var(--text-primary);
    letter-spacing: -0.02em;
  }
  .header-sub {
    font-size: 13px;
    color: var(--text-secondary);
    margin-top: 4px;
    font-weight: 300;
    font-style: italic;
  }
  .header-badge {
    background: var(--accent-dim);
    border: 1px solid rgba(79,142,247,0.25);
    color: var(--accent);
    font-size: 11px;
    font-weight: 500;
    padding: 5px 12px;
    border-radius: 99px;
    letter-spacing: 0.04em;
    font-family: var(--mono);
  }

  /* Two-column grid */
  .panel-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-bottom: 24px;
  }

  /* Card */
  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 24px;
    transition: border-color 0.2s;
  }
  .card:hover { border-color: var(--border-hover); }
  .card-icon {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 14px;
    font-size: 15px;
  }
  .card-icon.blue { background: var(--accent-dim); }
  .card-icon.green { background: var(--green-dim); }
  .card-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 4px;
  }
  .card-desc {
    font-size: 12.5px;
    color: var(--text-secondary);
    margin-bottom: 18px;
    line-height: 1.5;
    font-weight: 300;
  }

  /* Session badge */
  .session-id {
    font-family: var(--mono);
    font-size: 11px;
    color: var(--accent);
    background: var(--accent-dim);
    border: 1px solid rgba(79,142,247,0.2);
    padding: 4px 10px;
    border-radius: 6px;
    margin-bottom: 14px;
    display: inline-block;
  }

  /* Inputs */
  .input, .textarea {
    width: 100%;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px 13px;
    color: var(--text-primary);
    font-family: var(--font);
    font-size: 15px;
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
    margin-bottom: 14px;
  }
  .input::placeholder, .textarea::placeholder { color: var(--text-muted); }
  .input:focus, .textarea:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(79,142,247,0.1);
  }
  .textarea {
    font-family: var(--mono);
    font-size: 14px;
    resize: vertical;
    line-height: 1.6;
  }

  /* Buttons */
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 9px 18px;
    border: none;
    border-radius: 8px;
    font-family: var(--font);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
    letter-spacing: 0.01em;
  }
  .btn:active { transform: scale(0.98); }
  .btn-blue {
    background: var(--accent);
    color: #fff;
  }
  .btn-blue:hover { background: var(--accent-hover); box-shadow: 0 4px 14px rgba(79,142,247,0.35); }
  .btn-green {
    background: var(--green);
    color: #0d1a10;
  }
  .btn-green:hover { filter: brightness(1.1); box-shadow: 0 4px 14px rgba(62,207,122,0.3); }
  .btn-ghost {
    background: var(--surface-2);
    color: var(--text-secondary);
    border: 1px solid var(--border);
  }
  .btn-ghost:hover { border-color: var(--border-hover); color: var(--text-primary); }

  /* Loading */
  .loading-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: var(--accent-dim);
    border: 1px solid rgba(79,142,247,0.2);
    border-radius: 8px;
    color: var(--accent);
    font-size: 13px;
    margin-bottom: 20px;
  }
  .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(79,142,247,0.3);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    flex-shrink: 0;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* Log box */
  .log-box {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
    margin-bottom: 20px;
  }
  .log-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-muted);
  }
  .log-dot {
    width: 6px; height: 6px;
    background: var(--green);
    border-radius: 50%;
    animation: pulse 1.5s ease-in-out infinite;
  }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
  .log-entries {
    padding: 14px 16px;
    font-family: var(--mono);
    font-size: 12px;
    line-height: 1.8;
    max-height: 220px;
    overflow-y: auto;
  }
  .log-entries::-webkit-scrollbar { width: 4px; }
  .log-entries::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
  .log-entry { display: flex; gap: 10px; }
  .log-agent { color: var(--green); min-width: 90px; }
  .log-time { color: var(--text-muted); }
  .log-msg { color: var(--text-secondary); }

  /* Brief */
  .result-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
    margin-bottom: 20px;
  }
  .result-header {
    padding: 14px 20px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .result-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
    letter-spacing: 0.01em;
  }
  .result-tag {
    font-size: 10.5px;
    font-weight: 500;
    padding: 3px 8px;
    border-radius: 99px;
    letter-spacing: 0.04em;
    font-family: var(--mono);
  }
  .tag-blue { background: var(--accent-dim); color: var(--accent); border: 1px solid rgba(79,142,247,0.2); }
  .tag-green { background: var(--green-dim); color: var(--green); border: 1px solid rgba(62,207,122,0.2); }
  .result-body { padding: 20px; }

  /* Markdown */
  .md-content { color: var(--text-secondary); font-size: 15px; line-height: 1.75; }
  .md-content h1,.md-content h2,.md-content h3 { color: var(--text-primary); font-size: 14px; font-weight: 600; margin: 16px 0 6px; }
  .md-content p { margin-bottom: 10px; }
  .md-content ul,.md-content ol { padding-left: 18px; margin-bottom: 10px; }
  .md-content li { margin-bottom: 4px; }
  .md-content strong { color: var(--text-primary); font-weight: 500; }
  .md-content code { font-family: var(--mono); font-size: 12px; background: var(--surface-2); padding: 2px 5px; border-radius: 4px; color: var(--accent); }

  /* Post-meeting stats */
  .stats-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-bottom: 20px;
  }
  .stat {
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 14px;
    text-align: center;
  }
  .stat-num {
    font-size: 24px;
    font-weight: 600;
    color: var(--text-primary);
    font-family: var(--mono);
    letter-spacing: -0.02em;
  }
  .stat-label {
    font-size: 11px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-top: 2px;
  }

  /* Summary */
  .summary-text {
    font-size: 15px;
    color: var(--text-secondary);
    line-height: 1.65;
    margin-bottom: 20px;
    padding: 14px 16px;
    background: var(--surface-2);
    border-radius: 8px;
    border-left: 3px solid var(--accent);
  }

  /* Decisions */
  .section-label {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-bottom: 10px;
  }
  .decisions-list { list-style: none; margin-bottom: 20px; }
  .decision-item {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 8px 0;
    border-bottom: 1px solid var(--border);
    font-size: 14.5px;
    color: var(--text-secondary);
  }
  .decision-item:last-child { border-bottom: none; }
  .decision-item::before {
    content: '—';
    color: var(--text-muted);
    flex-shrink: 0;
    margin-top: 1px;
  }

  /* Action items */
  .action-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 11px 14px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 8px;
    margin-bottom: 8px;
    transition: border-color 0.15s;
  }
  .action-item:hover { border-color: var(--border-hover); }
  .action-owner {
    font-size: 12px;
    font-weight: 600;
    color: var(--accent);
    min-width: 90px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-family: var(--mono);
  }
  .action-task {
    flex: 1;
    font-size: 14px;
    color: var(--text-secondary);
  }
  .priority-badge {
    font-size: 10px;
    font-weight: 600;
    padding: 3px 8px;
    border-radius: 99px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-family: var(--mono);
    flex-shrink: 0;
  }
  .priority-high { background: var(--red-dim); color: var(--red); border: 1px solid rgba(245,86,86,0.2); }
  .priority-medium { background: var(--amber-dim); color: var(--amber); border: 1px solid rgba(245,166,35,0.2); }
  .priority-low { background: var(--green-dim); color: var(--green); border: 1px solid rgba(62,207,122,0.2); }
  .action-due {
    font-size: 11.5px;
    color: var(--text-muted);
    font-family: var(--mono);
    flex-shrink: 0;
  }

  /* Bottom section */
  .bottom-section {
    margin-top: 32px;
    padding-top: 24px;
    border-top: 1px solid var(--border);
  }
  .bottom-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }
  .bottom-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
  }
  .count-badge {
    font-family: var(--mono);
    font-size: 11px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    color: var(--text-secondary);
    padding: 3px 9px;
    border-radius: 99px;
  }

  @media (max-width: 640px) {
    .panel-grid { grid-template-columns: 1fr; }
    .stats-row { grid-template-columns: 1fr 1fr; }
    .header { flex-direction: column; align-items: flex-start; gap: 12px; }
  }
`;

export default function App() {
  const [eventId, setEventId] = useState('');
  const [transcript, setTranscript] = useState('');
  const [meetingId, setMeetingId] = useState('');
  const [brief, setBrief] = useState('');
  const [postResult, setPostResult] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState('');
  const [actionItems, setActionItems] = useState([]);
  const [actionItemsLoaded, setActionItemsLoaded] = useState(false);

  async function prepareMeeting() {
    if (!eventId.trim()) { alert('Enter a Calendar Event ID'); return; }
    setLoading('Generating meeting brief…');
    setBrief(''); setLogs([]); setPostResult(null);
    try {
      const res = await axios.post(`${API}/prepare`, { event_id: eventId });
      setMeetingId(res.data.meeting_id);
      setBrief(res.data.brief || '');
      await pollLogs(res.data.meeting_id);
    } catch (e) { alert('Error: ' + (e.response?.data?.detail || e.message)); }
    setLoading('');
  }

  async function processMeeting() {
    if (!meetingId) { alert('Prepare a meeting first'); return; }
    if (!transcript.trim()) { alert('Paste a transcript'); return; }
    setLoading('Processing transcript…');
    setPostResult(null);
    try {
      const res = await axios.post(`${API}/process`, { meeting_id: meetingId, transcript });
      setPostResult(res.data);
      await pollLogs(meetingId);
    } catch (e) { alert('Error: ' + (e.response?.data?.detail || e.message)); }
    setLoading('');
  }

  async function pollLogs(id) {
    try {
      const res = await axios.get(`${API}/session/${id}`);
      setLogs(res.data.agent_logs || []);
    } catch (e) {}
  }

  async function loadActionItems() {
    try {
      const res = await axios.get(`${API}/action-items`);
      setActionItems(res.data);
      setActionItemsLoaded(true);
    } catch (e) {}
  }

  const getPriorityClass = (p) => {
    if (!p) return 'priority-medium';
    return `priority-${p.toLowerCase()}`;
  };

  return (
    <>
      <style>{styles}</style>
      <div className="app">

        {/* Header */}
        <header className="header">
          <div className="header-left">
            <h1 className="header-title">Meeting Assistant</h1>
          </div>
        </header>

        {/* Two panels */}
        <div className="panel-grid">
          {/* Pre-meeting */}
          <div className="card">
            <div className="card-icon blue">📋</div>
            <div className="card-title">Pre-Meeting Brief</div>
            <div className="card-desc">
              Enter a Google Calendar event ID to generate an AI-powered research brief before your meeting.
            </div>
            <input
              className="input"
              placeholder="Calendar Event ID (e.g. abc123xyz)"
              value={eventId}
              onChange={e => setEventId(e.target.value)}
            />
            {meetingId && (
              <div className="session-id">Session: {meetingId}</div>
            )}
            <button className="btn btn-blue" onClick={prepareMeeting}>
              <span>↗</span> Prepare Brief
            </button>
          </div>

          {/* Post-meeting */}
          <div className="card">
            <div className="card-icon green">✓</div>
            <div className="card-title">Post-Meeting</div>
            <div className="card-desc">
              Paste a meeting transcript to extract action items, decisions, and send notifications automatically.
            </div>
            <textarea
              className="textarea"
              placeholder="Paste meeting transcript here…"
              rows={5}
              value={transcript}
              onChange={e => setTranscript(e.target.value)}
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-ghost" onClick={() => setTranscript('')}>Clear</button>
              <button className="btn btn-green" onClick={processMeeting}><span>⚡</span> Process Transcript</button>
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="loading-bar">
            <div className="spinner" />
            {loading}
          </div>
        )}

        {/* Agent logs */}
        {logs.length > 0 && (
          <div className="log-box">
            <div className="log-header">
              <div className="log-dot" />
              Agent Logs
            </div>
            <div className="log-entries">
              {logs.map((l, i) => (
                <div key={i} className="log-entry">
                  <span className="log-agent">[{l.agent}]</span>
                  <span className="log-time">{l.timestamp?.substring(11, 19)}</span>
                  <span className="log-msg">{l.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Brief */}
        {brief && (
          <div className="result-card">
            <div className="result-header">
              <span className="result-title">Meeting Brief</span>
              <span className="result-tag tag-blue">AI Generated</span>
            </div>
            <div className="result-body">
              <div className="md-content">
                <ReactMarkdown>{brief}</ReactMarkdown>
              </div>
            </div>
          </div>
        )}

        {/* Post-meeting result */}
        {postResult && (
          <div className="result-card">
            <div className="result-header">
              <span className="result-title">Meeting Processed</span>
              <span className="result-tag tag-green">Complete</span>
            </div>
            <div className="result-body">

              {/* Stats */}
              <div className="stats-row">
                <div className="stat">
                  <div className="stat-num">{postResult.tasks_created ?? 0}</div>
                  <div className="stat-label">Action Items</div>
                </div>
                <div className="stat">
                  <div className="stat-num">{postResult.emails_sent ?? 0}</div>
                  <div className="stat-label">Emails Sent</div>
                </div>
                <div className="stat">
                  <div className="stat-num">{postResult.decisions?.length ?? 0}</div>
                  <div className="stat-label">Decisions</div>
                </div>
              </div>

              {/* Summary */}
              {postResult.summary && (
                <div className="summary-text">{postResult.summary}</div>
              )}

              {/* Decisions */}
              {postResult.decisions?.length > 0 && (
                <>
                  <div className="section-label">Key Decisions</div>
                  <ul className="decisions-list">
                    {postResult.decisions.map((d, i) => (
                      <li key={i} className="decision-item">{d}</li>
                    ))}
                  </ul>
                </>
              )}

              {/* Action items */}
              {postResult.action_items?.length > 0 && (
                <>
                  <div className="section-label">Action Items</div>
                  {postResult.action_items.map((a, i) => (
                    <div key={i} className="action-item">
                      <span className="action-owner">{a.owner}</span>
                      <span className="action-task">{a.task}</span>
                      <span className={`priority-badge ${getPriorityClass(a.priority)}`}>
                        {a.priority}
                      </span>
                      <span className="action-due">{a.due_date}</span>
                    </div>
                  ))}
                </>
              )}

            </div>
          </div>
        )}

        {/* All open action items */}
        <div className="bottom-section">
          <div className="bottom-header">
            <div className="bottom-title">Open Action Items</div>
            {actionItemsLoaded && (
              <span className="count-badge">{actionItems.length} items</span>
            )}
          </div>
          <button className="btn btn-ghost" onClick={loadActionItems}>
            Load All Open Items
          </button>

          {actionItems.length > 0 && (
            <div style={{ marginTop: 16 }}>
              {actionItems.map((a, i) => (
                <div key={i} className="action-item">
                  <span className="action-owner">{a.owner}</span>
                  <span className="action-task">{a.task}</span>
                  <span className={`priority-badge ${getPriorityClass(a.priority)}`}>
                    {a.priority}
                  </span>
                  <span className="action-due">{a.due_date}</span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </>
  );
}