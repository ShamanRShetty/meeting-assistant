import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';

const API = process.env.REACT_APP_API_URL || 'http://localhost:8080';

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Mono:wght@300;400;500&family=Geist:wght@300;400;500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --ink: #0f0e11;
    --paper: #f7f4ef;
    --paper-dark: #edeae3;
    --accent: #c8502a;
    --accent-dim: rgba(200, 80, 42, 0.12);
    --green: #1e6b4a;
    --green-dim: rgba(30, 107, 74, 0.1);
    --muted: #7a7570;
    --border: rgba(15,14,17,0.12);
    --shadow: 0 1px 2px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.06);
    --radius: 10px;
  }

  body {
    background: var(--paper);
    color: var(--ink);
    font-family: 'Geist', sans-serif;
    font-weight: 400;
    line-height: 1.6;
    min-height: 100vh;
  }

  .app {
    max-width: 860px;
    margin: 0 auto;
    padding: 48px 24px 80px;
  }

  /* Header */
  .header {
    display: flex;
    align-items: baseline;
    gap: 14px;
    margin-bottom: 52px;
    padding-bottom: 28px;
    border-bottom: 1.5px solid var(--border);
    position: relative;
  }
  .header::after {
    content: '';
    position: absolute;
    bottom: -1.5px;
    left: 0;
    width: 48px;
    height: 1.5px;
    background: var(--accent);
  }
  .header-icon {
    width: 36px;
    height: 36px;
    background: var(--ink);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .header-icon svg { color: var(--paper); }
  .header-title {
    font-family: 'Instrument Serif', Georgia, serif;
    font-size: 28px;
    font-weight: 400;
    letter-spacing: -0.02em;
    color: var(--ink);
    line-height: 1;
  }
  .header-sub {
    font-size: 13px;
    color: var(--muted);
    font-family: 'DM Mono', monospace;
    font-weight: 300;
    margin-left: auto;
    letter-spacing: 0.02em;
  }

  /* Grid layout */
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    margin-bottom: 24px;
  }
  @media (max-width: 640px) {
    .grid { grid-template-columns: 1fr; }
  }

  /* Cards */
  .card {
    background: #fff;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 28px;
    box-shadow: var(--shadow);
    transition: box-shadow 0.2s;
  }
  .card:hover { box-shadow: 0 2px 4px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.08); }

  .card-label {
    font-family: 'DM Mono', monospace;
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 18px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .card-label-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: currentColor;
    flex-shrink: 0;
  }
  .card-label-dot.accent { color: var(--accent); }
  .card-label-dot.green { color: var(--green); }

  .card-title {
    font-family: 'Instrument Serif', Georgia, serif;
    font-size: 20px;
    font-weight: 400;
    margin-bottom: 20px;
    letter-spacing: -0.01em;
    color: var(--ink);
  }

  /* Inputs */
  input, textarea {
    width: 100%;
    background: var(--paper);
    border: 1px solid var(--border);
    border-radius: 7px;
    padding: 10px 14px;
    font-family: 'Geist', sans-serif;
    font-size: 14px;
    color: var(--ink);
    transition: border-color 0.15s, background 0.15s;
    outline: none;
    margin-bottom: 14px;
    resize: none;
    display: block;
  }
  input::placeholder, textarea::placeholder { color: var(--muted); }
  input:focus, textarea:focus {
    border-color: var(--ink);
    background: #fff;
  }

  /* Buttons */
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 9px 20px;
    border: none;
    border-radius: 7px;
    font-family: 'Geist', sans-serif;
    font-size: 13.5px;
    font-weight: 500;
    cursor: pointer;
    letter-spacing: 0.01em;
    transition: opacity 0.15s, transform 0.1s;
  }
  .btn:active { transform: scale(0.98); }
  .btn:disabled { opacity: 0.55; cursor: not-allowed; }

  .btn-primary {
    background: var(--ink);
    color: var(--paper);
  }
  .btn-primary:hover:not(:disabled) { opacity: 0.88; }

  .btn-success {
    background: var(--green);
    color: #fff;
  }
  .btn-success:hover:not(:disabled) { opacity: 0.88; }

  /* Loading bar */
  .loading-bar {
    height: 2px;
    background: var(--paper-dark);
    border-radius: 2px;
    margin-top: 24px;
    overflow: hidden;
  }
  .loading-bar-inner {
    height: 100%;
    background: var(--accent);
    border-radius: 2px;
    animation: loading 1.4s ease-in-out infinite;
    width: 40%;
  }
  @keyframes loading {
    0% { transform: translateX(-200%); }
    100% { transform: translateX(400%); }
  }
  .loading-text {
    font-family: 'DM Mono', monospace;
    font-size: 12px;
    color: var(--muted);
    margin-top: 10px;
    letter-spacing: 0.04em;
  }

  /* Agent logs */
  .logs-card {
    background: #111017;
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: var(--radius);
    padding: 24px;
    margin-top: 20px;
    animation: fadeUp 0.3s ease;
  }
  .logs-header {
    font-family: 'DM Mono', monospace;
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #5c5a7a;
    margin-bottom: 14px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .logs-header::before {
    content: '';
    width: 6px; height: 6px;
    border-radius: 50%;
    background: #22c55e;
    box-shadow: 0 0 6px #22c55e;
    animation: pulse 2s infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
  .log-entry {
    display: flex;
    gap: 12px;
    padding: 5px 0;
    border-bottom: 1px solid rgba(255,255,255,0.04);
    animation: fadeIn 0.2s ease;
  }
  .log-entry:last-child { border-bottom: none; }
  .log-agent {
    font-family: 'DM Mono', monospace;
    font-size: 11px;
    color: #7c9fdd;
    white-space: nowrap;
    min-width: 100px;
    font-weight: 500;
  }
  .log-msg {
    font-family: 'DM Mono', monospace;
    font-size: 11px;
    color: #8a8898;
    line-height: 1.5;
  }

  /* Brief card */
  .brief-card {
    margin-top: 20px;
    background: #fff;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
    box-shadow: var(--shadow);
    animation: fadeUp 0.35s ease;
  }
  .brief-card-header {
    padding: 18px 28px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--paper);
  }
  .brief-card-title {
    font-family: 'Instrument Serif', Georgia, serif;
    font-size: 17px;
    font-weight: 400;
  }
  .brief-badge {
    font-family: 'DM Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.08em;
    padding: 4px 10px;
    background: var(--accent-dim);
    color: var(--accent);
    border-radius: 20px;
    text-transform: uppercase;
  }
  .brief-content {
    padding: 28px;
    font-size: 14.5px;
    line-height: 1.75;
    color: #2a2832;
  }
  .brief-content h1, .brief-content h2, .brief-content h3 {
    font-family: 'Instrument Serif', Georgia, serif;
    font-weight: 400;
    letter-spacing: -0.01em;
    margin: 20px 0 8px;
    color: var(--ink);
  }
  .brief-content h1 { font-size: 22px; }
  .brief-content h2 { font-size: 18px; }
  .brief-content h3 { font-size: 16px; }
  .brief-content p { margin-bottom: 10px; }
  .brief-content ul, .brief-content ol { padding-left: 20px; margin-bottom: 10px; }
  .brief-content li { margin-bottom: 4px; }
  .brief-content strong { font-weight: 600; color: var(--ink); }

  /* Post-meeting result */
  .result-card {
    margin-top: 20px;
    background: #fff;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
    box-shadow: var(--shadow);
    animation: fadeUp 0.35s ease;
  }
  .result-header {
    padding: 18px 28px;
    background: var(--green-dim);
    border-bottom: 1px solid rgba(30,107,74,0.15);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .result-title {
    font-family: 'Instrument Serif', Georgia, serif;
    font-size: 17px;
    color: var(--green);
  }
  .result-badge {
    font-family: 'DM Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.08em;
    padding: 4px 10px;
    background: var(--green);
    color: #fff;
    border-radius: 20px;
    text-transform: uppercase;
  }
  .result-body { padding: 28px; }
  .result-summary {
    font-size: 14.5px;
    line-height: 1.7;
    color: #2a2832;
    padding-bottom: 20px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 20px;
  }
  .stats-row {
    display: flex;
    gap: 16px;
    margin-bottom: 24px;
    flex-wrap: wrap;
  }
  .stat-pill {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 6px 14px;
    background: var(--paper);
    border: 1px solid var(--border);
    border-radius: 20px;
    font-family: 'DM Mono', monospace;
    font-size: 12px;
    color: var(--muted);
  }
  .stat-pill strong { color: var(--ink); font-weight: 500; }

  .action-items-label {
    font-family: 'DM Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 12px;
  }
  .action-list { list-style: none; display: flex; flex-direction: column; gap: 10px; }
  .action-item {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px 16px;
    background: var(--paper);
    border: 1px solid var(--border);
    border-radius: 8px;
    font-size: 13.5px;
  }
  .action-dot {
    width: 8px; height: 8px;
    border-radius: 50%;
    background: var(--green);
    margin-top: 5px;
    flex-shrink: 0;
  }
  .action-owner {
    font-weight: 600;
    color: var(--ink);
    margin-right: 4px;
  }
  .action-task { color: #2a2832; }
  .action-due {
    margin-left: auto;
    font-family: 'DM Mono', monospace;
    font-size: 11px;
    color: var(--muted);
    white-space: nowrap;
    padding-left: 12px;
  }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
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
  const logsRef = useRef(null);

  useEffect(() => {
    if (logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight;
  }, [logs]);

  async function prepareMeeting() {
    setLoading('Preparing meeting brief…');
    setBrief(''); setLogs([]);
    try {
      const res = await axios.post(`${API}/prepare`, { event_id: eventId });
      setMeetingId(res.data.meeting_id);
      setBrief(res.data.brief);
      pollLogs(res.data.meeting_id);
    } catch (e) { alert(e.message); }
    setLoading('');
  }

  async function processMeeting() {
    setLoading('Processing transcript…');
    setPostResult(null);
    try {
      const res = await axios.post(`${API}/process`, { meeting_id: meetingId, transcript });
      setPostResult(res.data);
      pollLogs(meetingId);
    } catch (e) { alert(e.message); }
    setLoading('');
  }

  async function pollLogs(id) {
    const res = await axios.get(`${API}/session/${id}`);
    setLogs(res.data.agent_logs || []);
  }

  return (
    <>
      <style>{styles}</style>
      <div className="app">

        {/* Header */}
        <header className="header">
          <div className="header-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          <h1 className="header-title">Meeting Assistant</h1>
        </header>

        {/* Two-column cards */}
        <div className="grid">
          {/* Pre-meeting */}
          <div className="card">
            <div className="card-label">
              <span className="card-label-dot accent" />
              Pre-meeting
            </div>
            <h2 className="card-title">Prepare Brief</h2>
            <input
              placeholder="Google Calendar Event ID"
              value={eventId}
              onChange={e => setEventId(e.target.value)}
            />
            <button
              className="btn btn-primary"
              onClick={prepareMeeting}
              disabled={!!loading || !eventId}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/>
              </svg>
              Generate Brief
            </button>
          </div>

          {/* Post-meeting */}
          <div className="card">
            <div className="card-label">
              <span className="card-label-dot green" />
              Post-meeting
            </div>
            <h2 className="card-title">Process Transcript</h2>
            <textarea
              placeholder="Paste your meeting transcript here…"
              value={transcript}
              onChange={e => setTranscript(e.target.value)}
              rows={4}
            />
            <button
              className="btn btn-success"
              onClick={processMeeting}
              disabled={!!loading || !transcript}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Process
            </button>
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <div style={{ marginTop: 4 }}>
            <div className="loading-bar"><div className="loading-bar-inner" /></div>
            <p className="loading-text">{loading}</p>
          </div>
        )}

        {/* Agent logs */}
        {logs.length > 0 && (
          <div className="logs-card">
            <div className="logs-header">Agent Logs</div>
            <div ref={logsRef} style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0 }}>
              {logs.map((l, i) => (
                <div key={i} className="log-entry">
                  <span className="log-agent">[{l.agent}]</span>
                  <span className="log-msg">{l.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Meeting brief */}
        {brief && (
          <div className="brief-card">
            <div className="brief-card-header">
              <span className="brief-card-title">Meeting Brief</span>
              <span className="brief-badge">Ready</span>
            </div>
            <div className="brief-content">
              <ReactMarkdown>{brief}</ReactMarkdown>
            </div>
          </div>
        )}

        {/* Post-meeting result */}
        {postResult && (
          <div className="result-card">
            <div className="result-header">
              <span className="result-title">Meeting Processed</span>
              <span className="result-badge">✓ Complete</span>
            </div>
            <div className="result-body">
              <p className="result-summary">{postResult.summary}</p>

              <div className="stats-row">
                <span className="stat-pill">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  <strong>{postResult.tasks_created}</strong> tasks created
                </span>
                <span className="stat-pill">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                  <strong>{postResult.emails_sent}</strong> emails sent
                </span>
              </div>

              {postResult.action_items?.length > 0 && (
                <>
                  <p className="action-items-label">Action Items</p>
                  <ul className="action-list">
                    {postResult.action_items.map((a, i) => (
                      <li key={i} className="action-item">
                        <span className="action-dot" />
                        <span>
                          <span className="action-owner">{a.owner}:</span>
                          <span className="action-task">{a.task}</span>
                        </span>
                        <span className="action-due">{a.due_date}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        )}

      </div>
    </>
  );
}