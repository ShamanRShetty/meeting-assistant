import { useState, useCallback, useEffect } from 'react';
import axios from 'axios';

// Styles
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';

// Components
import LandingPage from './components/LandingPage';
import Header from './components/Header';
import MeetingSelector from './components/MeetingSelector';
import TranscriptPanel from './components/TranscriptPanel';
import BriefPanel from './components/BriefPanel';
import ResultsPanel from './components/ResultsPanel';
import LogsPanel from './components/LogsPanel';
import ToolsPanel from './components/ToolsPanel';

// Hooks & utils
import { useRecorder, api } from './hooks';
import { buildDemoEvents, DEMO_TRANSCRIPT } from './utils/demoData';

const API = process.env.REACT_APP_API_URL || '/api';

// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  // ── Theme ──
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'dark';
  });

  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('theme-light');
      document.body.classList.remove('theme-dark');
    } else {
      document.body.classList.add('theme-dark');
      document.body.classList.remove('theme-light');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => (t === 'light' ? 'dark' : 'light'));

  // ── Auth ──
  const [appMode, setAppMode]       = useState('landing'); // 'landing' | 'demo' | 'auth'
  const [authChecked, setAuthChecked] = useState(false);
  const [authError, setAuthError]   = useState('');

  // ── Session ──
  const [sessionId, setSessionId]         = useState('');
  const [sessionRestored, setSessionRestored] = useState(false);
  const [restoringSession, setRestoringSession] = useState(false);

  // ── Calendar ──
  const [meetingMode, setMeetingMode]       = useState('calendar');
  const [calEvents, setCalEvents]           = useState(null);
  const [calLoading, setCalLoading]         = useState(false);
  const [selectedEventId, setSelectedEventId] = useState('');

  // ── Transcript ──
  const [transcriptTab, setTranscriptTab] = useState('paste');
  const [transcript, setTranscript]       = useState('');
  const [transcribed, setTranscribed]     = useState('');
  const [uploadFile, setUploadFile]       = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus]   = useState('');

  // ── Results ──
  const [brief, setBrief]           = useState('');
  const [postResult, setPostResult] = useState(null);
  const [logs, setLogs]             = useState([]);

  // ── Tools ──
  const [debtData, setDebtData]         = useState(null);
  const [debtError, setDebtError]       = useState('');
  const [actionItems, setActionItems]   = useState([]);
  const [aiLoaded, setAiLoaded]         = useState(false);
  const [aiError, setAiError]           = useState('');
  const [conflicts, setConflicts]       = useState([]);
  const [conflictsLoaded, setConflictsLoaded] = useState(false);
  const [agendaStatus, setAgendaStatus] = useState('');

  // ── Loading / error ──
  const [loading, setLoading]   = useState('');
  const [apiError, setApiError] = useState('');

  const recorder = useRecorder();
  const isDemo   = appMode === 'demo';

  // ── Session restore ────────────────────────────────────────────────────────
  const restoreLastSession = useCallback(async () => {
    setRestoringSession(true);
    try {
      const session = await api.latestSession();
      if (!session?.meeting_id) return;

      const sid = session.meeting_id;
      setSessionId(sid);
      if (session.brief) setBrief(session.brief);
      if (session.agent_logs) setLogs(session.agent_logs);

      const { notes, task_summary } = session;
      if (notes?.summary) {
        setPostResult({
          meeting_id: sid,
          summary:      notes.summary || '',
          decisions:    notes.decisions || [],
          topics:       notes.topics_discussed || [],
          sentiment:    notes.sentiment || 'neutral',
          action_items: task_summary?.items || [],
          tasks_created: task_summary?.tasks_created || 0,
          emails_sent:  task_summary?.emails_sent || 0,
          roi_result:   session.roi_result || null,
          debt_result:  session.debt_result || null,
          demo_mode:    session.demo_mode || false,
        });
        setSessionRestored(true);
      }

      const [debtRes, itemsRes, conflictsRes] = await Promise.allSettled([
        api.debt(),
        api.actionItems(sid),
        api.conflicts(),
      ]);
      if (debtRes.status === 'fulfilled') setDebtData(debtRes.value);
      if (itemsRes.status === 'fulfilled') { setActionItems(Array.isArray(itemsRes.value) ? itemsRes.value : []); setAiLoaded(true); }
      if (conflictsRes.status === 'fulfilled') { setConflicts(Array.isArray(conflictsRes.value) ? conflictsRes.value : []); setConflictsLoaded(true); }
    } catch { /* non-fatal */ }
    finally { setRestoringSession(false); }
  }, []);

  // ── Auth check ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (params.get('auth') === 'success') {
      window.history.replaceState({}, '', '/');
      setAppMode('auth');
      setAuthChecked(true);
      restoreLastSession();
      return;
    }
    if (params.get('auth_error')) {
      setAuthError(decodeURIComponent(params.get('auth_error') || 'Sign-in failed.'));
      window.history.replaceState({}, '', '/');
      setAppMode('landing');
      setAuthChecked(true);
      return;
    }

    api.authStatus()
      .then(data => {
        setAppMode(data.authenticated ? 'auth' : 'landing');
        setAuthChecked(true);
        if (data.authenticated) restoreLastSession();
      })
      .catch(() => { setAppMode('landing'); setAuthChecked(true); });
  }, [restoreLastSession]);

  // ── Load calendar events ────────────────────────────────────────────────────
  useEffect(() => {
    if (appMode === 'landing' || !authChecked) return;
    loadCalendarEvents();
  }, [appMode, authChecked]); // eslint-disable-line

  async function loadCalendarEvents() {
    setCalLoading(true);
    setCalEvents(null);
    try {
      const data = await api.events();
      if (Array.isArray(data) && data.length) {
        setCalEvents(data);
        setSelectedEventId(data[0].id);
      } else {
        const fallback = buildDemoEvents();
        setCalEvents(fallback);
        setSelectedEventId(fallback[0].id);
      }
    } catch {
      const fallback = buildDemoEvents();
      setCalEvents(fallback);
      setSelectedEventId(fallback[0].id);
    } finally {
      setCalLoading(false);
    }
  }

  // ── Reset ──────────────────────────────────────────────────────────────────
  function resetState() {
    setBrief(''); setPostResult(null); setSessionId(''); setLogs([]);
    setTranscript(''); setTranscribed(''); setDebtData(null); setDebtError('');
    setConflicts([]); setConflictsLoaded(false); setAgendaStatus('');
    setActionItems([]); setAiLoaded(false); setAiError(''); setApiError('');
    setSessionRestored(false);
  }

  // ── Auth actions ───────────────────────────────────────────────────────────
  function startDemo() { resetState(); setAppMode('demo'); }
  function goToGoogleLogin() { window.location.href = `${API}/auth/login`; }
  async function signOut() {
    await api.logout().catch(() => {});
    setAppMode('landing');
    resetState();
    setCalEvents(null);
    setSelectedEventId('');
  }

  // ── Prepare meeting ─────────────────────────────────────────────────────────
  async function prepareMeeting() {
    setLoading('Preparing meeting brief…');
    setApiError(''); setBrief(''); setLogs([]); setPostResult(null); setSessionId('');
    const eventId = (meetingMode === 'calendar' && selectedEventId) ? selectedEventId : null;
    try {
      const data = await api.prepare({ event_id: eventId, demo_mode: isDemo });
      setSessionId(data.meeting_id || '');
      setBrief(data.brief || '');
      if (data.meeting_id) {
        const s = await api.session(data.meeting_id).catch(() => null);
        if (s?.agent_logs) setLogs(prev => [...prev, ...s.agent_logs]);
      }
    } catch (e) {
      setApiError('Prepare failed: ' + (e?.response?.data?.detail || e?.message));
    }
    setLoading('');
  }

  // ── Process transcript ──────────────────────────────────────────────────────
  async function runProcess(t) {
    setLoading('Processing transcript…');
    setApiError(''); setPostResult(null); setDebtData(null);
    setActionItems([]); setAiLoaded(false);

    let sid = sessionId;
    if (!sid) {
      try {
        const res = await api.prepare({ event_id: null, demo_mode: isDemo });
        sid = res.meeting_id;
        setSessionId(sid);
      } catch { /* non-fatal */ }
    }
    try {
      const data = await api.process({ meeting_id: sid || undefined, transcript: t, demo_mode: isDemo });
      if (data.meeting_id) setSessionId(data.meeting_id);
      setPostResult(data);
      if (data.meeting_id || sid) {
        const s = await api.session(data.meeting_id || sid).catch(() => null);
        if (s?.agent_logs) setLogs(s.agent_logs);
      }
    } catch (e) {
      setApiError('Process failed: ' + (e?.response?.data?.detail || e?.message));
    }
    setLoading('');
  }

  const effectiveTranscript = transcribed || transcript;
  const canProcess = effectiveTranscript.trim().length > 20;

  async function processTranscript() {
    if (!canProcess) { alert('No transcript. Use demo data or paste a transcript.'); return; }
    await runProcess(effectiveTranscript.trim());
  }

  // ── Transcription ───────────────────────────────────────────────────────────
  async function submitRecording() {
    if (!recorder.audioBlob) return;
    setLoading('Transcribing…');
    const form = new FormData();
    form.append('file', recorder.audioBlob, 'recording.webm');
    try {
      const data = await api.transcribe(form, setUploadProgress);
      setTranscribed(data.transcript || '');
      recorder.reset();
    } catch (e) {
      setTranscriptTab('paste');
      alert('Transcription failed: ' + (e?.response?.data?.detail || e?.message));
    }
    setUploadProgress(0); setLoading('');
  }

  async function handleFileUpload(file) {
    if (!file) { setUploadFile(null); setUploadStatus(''); setUploadProgress(0); return; }
    setUploadFile(file); setUploadStatus('Uploading and transcribing…'); setUploadProgress(0);
    const form = new FormData();
    form.append('file', file, file.name);
    try {
      const data = await api.transcribe(form, setUploadProgress);
      setTranscribed(data.transcript || '');
      setUploadStatus('Transcription complete');
    } catch (e) {
      setUploadStatus('Failed — ' + (e?.response?.data?.detail || e?.message));
      setTranscriptTab('paste');
    }
  }

  function loadDemo() { setTranscript(DEMO_TRANSCRIPT); setTranscribed(''); setTranscriptTab('paste'); }
  function runFullDemo() { setTranscript(DEMO_TRANSCRIPT); setTranscribed(''); setTranscriptTab('paste'); setTimeout(() => runProcess(DEMO_TRANSCRIPT), 50); }

  // ── Tools ───────────────────────────────────────────────────────────────────
  async function loadDebt() {
    setDebtError(''); setDebtData(null);
    if (!sessionId) { setDebtData({ open: 0, overdue: 0, overdue_items: [], open_items: [], _no_session: true }); return; }
    try { setDebtData(await api.debt()); } catch (e) { setDebtError('Failed: ' + (e?.response?.data?.detail || e?.message)); }
  }

  async function loadAllItems() {
    setAiError(''); setActionItems([]); setAiLoaded(false);
    if (!sessionId) { setAiLoaded(true); return; }
    try {
      const data = await api.actionItems(sessionId);
      setActionItems(Array.isArray(data) ? data : []);
      setAiLoaded(true);
    } catch (e) { setAiError('Failed: ' + (e?.response?.data?.detail || e?.message)); setAiLoaded(true); }
  }

  async function loadConflicts() {
    setConflicts([]); setConflictsLoaded(false);
    try {
      const data = await api.conflicts();
      setConflicts(Array.isArray(data) ? data : []);
    } catch { setConflicts([]); }
    setConflictsLoaded(true);
  }

  async function approveConflict(id) {
    try {
      const r = await api.approveConflict(id);
      alert(r.demo_mode ? 'Demo: approved (no real calendar change)' : `Rescheduled to: ${(r.new_time || '').substring(0, 16)}`);
      loadConflicts();
    } catch (e) { alert('Error: ' + (e?.response?.data?.detail || e?.message)); }
  }

  async function markItemDone(id) {
    try { await api.markDone(id); loadDebt(); loadAllItems(); } catch { /* non-fatal */ }
  }

  async function finalizeAgenda() {
    if (!sessionId) { alert('Prepare a meeting first.'); return; }
    setAgendaStatus('Synthesizing agenda…');
    try {
      const r = await api.finalizeAgenda(sessionId);
      setAgendaStatus(r.demo_mode ? 'Demo agenda generated.' : `Done — ${r.replies_found} replies used. Calendar updated: ${r.calendar_patched}`);
    } catch (e) { setAgendaStatus('Error: ' + (e?.response?.data?.detail || e?.message)); }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (!authChecked) {
    return (
      <div className="landing">
        <div style={{ color: 'var(--text-3)', fontFamily: 'var(--mono)', fontSize: 12 }}>Loading…</div>
      </div>
    );
  }

  if (appMode === 'landing') {
    return <LandingPage onDemo={startDemo} onGoogleLogin={goToGoogleLogin} authError={authError} />;
  }

  const toolsUnlocked = !!sessionId || sessionRestored;
  const noCalendarEvents = meetingMode === 'calendar' && (!Array.isArray(calEvents) || calEvents.length === 0);

  return (
    <div className="app">
      {/* Demo banner */}
      {isDemo && (
        <div className="demo-banner">
          <span className="demo-badge">Demo Mode</span>
          <span className="demo-banner-text">Using demo data · AI processing is live</span>
          <button className="demo-banner-link" onClick={goToGoogleLogin}>Sign in with Google →</button>
        </div>
      )}

      {/* Session restore */}
      {restoringSession && (
        <div className="loading-bar" style={{ marginBottom: 'var(--sp-3)' }}>
          <div className="spinner" /> Restoring your last session…
        </div>
      )}
      {sessionRestored && !restoringSession && (
        <div className="restore-banner">
          Last session restored — results and action items loaded below.
          <button onClick={() => setSessionRestored(false)}>×</button>
        </div>
      )}

      <Header isDemo={isDemo} onSignOut={signOut} onSignIn={goToGoogleLogin} theme={theme} toggleTheme={toggleTheme} />

      {/* ── Step 1: Select meeting ── */}
      <div className="section-label">Step 1 — Select your meeting</div>
      <MeetingSelector
        meetingMode={meetingMode}
        setMeetingMode={setMeetingMode}
        calEvents={calEvents}
        calLoading={calLoading}
        selectedEventId={selectedEventId}
        setSelectedEventId={setSelectedEventId}
        isDemo={isDemo}
      />

      {meetingMode === 'calendar' && (
        <button
          className="btn-primary"
          onClick={prepareMeeting}
          disabled={!!loading || calLoading || noCalendarEvents}
        >
          {loading?.includes('brief') ? <><span className="spinner" />{loading}</> : 'Generate Pre-Meeting Brief'}
        </button>
      )}

      {sessionId && (
        <div className="session-pill">
          <div className="session-dot" />
          Session {sessionId}
        </div>
      )}

      {apiError && <div className="error-bar"><span>{apiError}</span></div>}
      {loading && !loading.includes('brief') && !loading.includes('Transcribing') && (
        <div className="loading-bar"><div className="spinner" />{loading}</div>
      )}

      <LogsPanel logs={logs} />
      <BriefPanel brief={brief} isDemo={isDemo} />

      <div className="divider" />

      {/* ── Step 2: Transcript ── */}
      <div className="section-label">Step 2 — Capture transcript</div>
      <TranscriptPanel
        transcriptTab={transcriptTab}
        setTranscriptTab={setTranscriptTab}
        transcript={transcript}
        setTranscript={setTranscript}
        transcribed={transcribed}
        setTranscribed={setTranscribed}
        recorder={recorder}
        uploadFile={uploadFile}
        uploadProgress={uploadProgress}
        uploadStatus={uploadStatus}
        onFileUpload={handleFileUpload}
        onSubmitRecording={submitRecording}
        onLoadDemo={loadDemo}
        onRunFullDemo={runFullDemo}
        isDemo={isDemo}
        loading={loading}
      />

      <button className="btn-primary" onClick={processTranscript} disabled={!!loading || !canProcess}>
        {loading?.includes('Processing') ? <><span className="spinner" />{loading}</> : 'Process Meeting'}
      </button>

      {/* ── Results ── */}
      {postResult && (
        <>
          <div className="divider" />
          <div className="section-label">
            Meeting Results
            {postResult.demo_mode && <span style={{ color: 'var(--teal)', marginLeft: 8, textTransform: 'none', letterSpacing: 0 }}>· Demo</span>}
          </div>
          <ResultsPanel result={postResult} onMarkDone={markItemDone} />
        </>
      )}

      {/* ── Tools ── */}
      <div className="divider" />
      <div className="section-label">Tools & History</div>
      <ToolsPanel
        toolsUnlocked={toolsUnlocked}
        sessionId={sessionId}
        debtData={debtData}
        debtError={debtError}
        actionItems={actionItems}
        aiLoaded={aiLoaded}
        aiError={aiError}
        conflicts={conflicts}
        conflictsLoaded={conflictsLoaded}
        agendaStatus={agendaStatus}
        onLoadDebt={loadDebt}
        onLoadItems={loadAllItems}
        onLoadConflicts={loadConflicts}
        onFinalizeAgenda={finalizeAgenda}
        onMarkDone={markItemDone}
        onApproveConflict={approveConflict}
      />
    </div>
  );
}