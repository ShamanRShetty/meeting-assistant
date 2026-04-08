import { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';

const API = process.env.REACT_APP_API_URL || '/api';

const DEMO_TRANSCRIPT = `Alice: Let's get started. The main blocker right now is the login bug in production — users on mobile can't sign in with Google OAuth.
Bob: I reproduced it this morning. It only happens on iOS Safari. I can have a fix ready by Monday.
Alice: Great. Carol, can you do a code review Monday evening?
Carol: Yes, I'll block time for it.
Alice: Good. Moving on — the Q3 report. David, where are we?
David: I'm still waiting on the sales data from Priya in finance. I'll follow up with her today and make sure we have everything by Wednesday.
Alice: The board needs the report by Friday. Please make that happen, David.
Carol: I'll also update the API documentation this week — it's been out of date since the last release.
Alice: Perfect. Let's sync again Thursday at 3 PM to check on the login fix and report progress. Does that work for everyone?
Bob: Works for me.
David: Same.
Carol: I'll send a calendar invite.`;

/* ── SVG Icon set ─────────────────────────────────────────────────────────── */
const Icon = {
  Calendar: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  Zap: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  ),
  Mic: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
    </svg>
  ),
  MicOff: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
    </svg>
  ),
  Upload: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  ),
  FileText: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  ),
  Copy: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
  ),
  Check: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  Download: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  ),
  CheckCircle: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  ),
  AlertTriangle: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  TrendingUp: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
    </svg>
  ),
  RefreshCw: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
    </svg>
  ),
  List: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
    </svg>
  ),
  ClipboardList: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="15" y2="16"/>
    </svg>
  ),
  Cpu: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/>
    </svg>
  ),
  Trash2: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
    </svg>
  ),
};

/* ── Styles ─────────────────────────────────────────────────────────────────── */
const css = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

:root{
  --bg:#07090f;
  --s1:#0c0f1a;
  --s2:#111521;
  --s3:#181e2e;
  --border:#1e2538;
  --border2:#28304a;
  --text:#dce4f2;
  --text2:#8494b8;
  --text3:#3a4a6a;
  --accent:#4f7cff;
  --accent2:#6b95ff;
  --accent-glow:rgba(79,124,255,0.12);
  --green:#27c96e;
  --green-dim:rgba(39,201,110,0.1);
  --amber:#e8a020;
  --amber-dim:rgba(232,160,32,0.1);
  --red:#e84040;
  --red-dim:rgba(232,64,64,0.1);
  --purple:#9b6dff;
  --purple-dim:rgba(155,109,255,0.1);
  --r:10px;
  --font:'Inter',system-ui,-apple-system,sans-serif;
  --mono:'JetBrains Mono',ui-monospace,monospace;
}

body{background:var(--bg);color:var(--text);font-family:var(--font);font-size:16px;line-height:1.65;min-height:100vh;-webkit-font-smoothing:antialiased}

.app{max-width:1020px;margin:0 auto;padding:52px 28px 120px}

/* Header */
.header{margin-bottom:56px}
.header-eyebrow{font-family:var(--mono);font-size:11px;color:var(--accent);letter-spacing:0.18em;text-transform:uppercase;margin-bottom:14px;display:flex;align-items:center;gap:10px}
.header-eyebrow::before{content:'';display:block;width:22px;height:1px;background:var(--accent)}
.header-title{font-size:38px;font-weight:700;color:#fff;letter-spacing:-0.04em;line-height:1.1;margin-bottom:8px}
.header-title span{color:var(--accent)}
.header-sub{font-size:15px;color:var(--text2)}

/* Section eyebrow */
.section-eyebrow{font-family:var(--mono);font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:var(--text3);margin-bottom:22px;display:flex;align-items:center;gap:12px}
.section-eyebrow::after{content:'';flex:1;height:1px;background:var(--border)}

/* Meeting grid */
.meeting-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px}
.meeting-option{background:var(--s1);border:1px solid var(--border);border-radius:var(--r);padding:22px 20px;cursor:pointer;transition:all 0.18s}
.meeting-option:hover{border-color:var(--border2)}
.meeting-option.selected{border-color:var(--accent);background:var(--s2)}
.mo-icon{margin-bottom:12px;color:var(--accent);display:block}
.mo-title{font-size:15px;font-weight:600;color:var(--text);margin-bottom:4px}
.mo-desc{font-size:14px;color:var(--text2);line-height:1.5}

/* Calendar dropdown */
.cal-select-wrap{margin-top:14px}
.cal-select{
  width:100%;background:var(--s2);border:1px solid var(--border);border-radius:8px;
  padding:13px 44px 13px 16px;color:var(--text);font-family:var(--font);font-size:15px;
  outline:none;cursor:pointer;transition:border-color 0.18s;
  -webkit-appearance:none;appearance:none;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%238494b8' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
  background-repeat:no-repeat;background-position:right 16px center;
}
.cal-select:focus{border-color:var(--accent)}
.cal-select option{background:#111521;color:#dce4f2;padding:8px}

/* Session badge */
.session-pill{display:inline-flex;align-items:center;gap:8px;font-family:var(--mono);font-size:12px;color:var(--accent);background:var(--accent-glow);border:1px solid rgba(79,124,255,0.2);padding:6px 14px;border-radius:99px;margin-top:14px}
.session-dot{width:6px;height:6px;background:var(--green);border-radius:50%;animation:pulse 1.5s ease-in-out infinite}

/* Transcript tabs */
.transcript-tabs{display:flex;gap:4px;margin-bottom:18px;background:var(--s1);border:1px solid var(--border);border-radius:10px;padding:4px}
.tab-btn{flex:1;padding:10px 14px;border:none;border-radius:8px;cursor:pointer;font-family:var(--font);font-size:14px;font-weight:500;color:var(--text2);background:transparent;transition:all 0.18s;display:flex;align-items:center;justify-content:center;gap:7px;white-space:nowrap}
.tab-btn:hover{color:var(--text)}
.tab-btn.active{background:var(--s3);color:var(--text);border:1px solid var(--border2)}

/* Record panel */
.record-panel{background:var(--s1);border:1px solid var(--border);border-radius:var(--r);padding:36px 28px;text-align:center}
.record-btn{width:84px;height:84px;border-radius:50%;border:2px solid var(--border2);cursor:pointer;background:var(--s3);display:flex;align-items:center;justify-content:center;margin:0 auto 18px;transition:all 0.18s;color:var(--text2)}
.record-btn:hover{border-color:var(--red);color:var(--red);transform:scale(1.04)}
.record-btn.recording{background:var(--red-dim);border-color:var(--red);color:var(--red);animation:recpulse 1s ease-in-out infinite}
@keyframes recpulse{0%,100%{box-shadow:0 0 0 0 rgba(232,64,64,0.35)} 50%{box-shadow:0 0 0 18px rgba(232,64,64,0)}}
.record-label{font-size:15px;color:var(--text2);margin-bottom:8px}
.record-timer{font-family:var(--mono);font-size:24px;color:var(--text);letter-spacing:0.06em}
.record-hint{font-size:13px;color:var(--text3);margin-top:10px}

/* Upload zone */
.upload-zone{background:var(--s1);border:2px dashed var(--border);border-radius:var(--r);padding:44px 28px;text-align:center;cursor:pointer;transition:all 0.18s;position:relative}
.upload-zone:hover,.upload-zone.drag{border-color:var(--accent);background:var(--s2)}
.upload-zone input{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%}
.upload-icon{margin-bottom:14px;color:var(--text3);display:flex;justify-content:center}
.upload-icon svg{width:34px;height:34px}
.upload-title{font-size:15px;font-weight:500;color:var(--text);margin-bottom:5px}
.upload-sub{font-size:13px;color:var(--text3)}

/* Upload progress */
.upload-progress{background:var(--s2);border:1px solid var(--border);border-radius:var(--r);padding:22px}
.progress-file{display:flex;align-items:center;gap:14px;margin-bottom:14px}
.progress-name{font-size:14px;color:var(--text);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.progress-bar-wrap{height:4px;background:var(--s3);border-radius:2px;overflow:hidden}
.progress-bar{height:100%;background:var(--accent);border-radius:2px;transition:width 0.3s}
.progress-status{font-family:var(--mono);font-size:12px;color:var(--text2);margin-top:10px}

/* Textarea */
.paste-panel{position:relative}
.textarea{width:100%;background:var(--s1);border:1px solid var(--border);border-radius:var(--r);padding:16px;color:var(--text);font-family:var(--mono);font-size:14px;line-height:1.7;resize:vertical;outline:none;transition:border-color 0.18s;min-height:170px}
.textarea:focus{border-color:var(--accent)}
.textarea::placeholder{color:var(--text3)}
.char-count{position:absolute;bottom:13px;right:16px;font-family:var(--mono);font-size:12px;color:var(--text3)}

/* Demo button */
.demo-row{margin-top:12px;display:flex;justify-content:flex-end}
.demo-btn{font-family:var(--mono);font-size:12px;color:var(--purple);background:var(--purple-dim);border:1px solid rgba(155,109,255,0.2);padding:7px 16px;border-radius:99px;cursor:pointer;transition:all 0.18s;display:flex;align-items:center;gap:6px}
.demo-btn:hover{background:rgba(155,109,255,0.2)}

/* Transcript preview */
.transcript-preview{background:var(--s1);border:1px solid var(--green);border-radius:var(--r);padding:18px;margin-top:14px}
.preview-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
.preview-label{font-family:var(--mono);font-size:11px;color:var(--green);letter-spacing:0.12em;text-transform:uppercase}
.preview-text{font-family:var(--mono);font-size:13px;color:var(--text2);line-height:1.65;max-height:130px;overflow-y:auto}
.preview-text::-webkit-scrollbar{width:3px}
.preview-text::-webkit-scrollbar-thumb{background:var(--border2);border-radius:2px}

/* Primary button */
.primary-btn{width:100%;padding:15px 26px;background:var(--accent);color:#fff;border:none;border-radius:var(--r);font-family:var(--font);font-size:16px;font-weight:600;cursor:pointer;transition:all 0.18s;display:flex;align-items:center;justify-content:center;gap:9px;margin-top:22px}
.primary-btn:hover{background:var(--accent2);box-shadow:0 8px 28px rgba(79,124,255,0.28)}
.primary-btn:active{transform:scale(0.99)}
.primary-btn:disabled{background:var(--s3);color:var(--text3);cursor:not-allowed;box-shadow:none}

/* Buttons */
.btn{display:inline-flex;align-items:center;gap:7px;padding:9px 16px;border:1px solid var(--border2);border-radius:8px;background:transparent;color:var(--text2);font-family:var(--font);font-size:14px;cursor:pointer;transition:all 0.18s}
.btn:hover{color:var(--text);border-color:var(--accent);background:var(--accent-glow)}
.btn-danger{border-color:rgba(232,64,64,0.3);color:var(--red)}
.btn-danger:hover{background:var(--red-dim);border-color:var(--red)}
.btn-green{border-color:rgba(39,201,110,0.3);color:var(--green)}
.btn-green:hover{background:var(--green-dim)}
.btn-sm{padding:6px 12px;font-size:13px}
.btn-copy{display:inline-flex;align-items:center;gap:6px;padding:7px 13px;border:1px solid var(--border2);border-radius:7px;background:transparent;color:var(--text2);font-family:var(--font);font-size:13px;cursor:pointer;transition:all 0.18s}
.btn-copy:hover{color:var(--text);border-color:var(--accent);background:var(--accent-glow)}
.btn-copy.copied{color:var(--green);border-color:rgba(39,201,110,0.3);background:var(--green-dim)}
.btn-pdf{display:inline-flex;align-items:center;gap:6px;padding:7px 13px;border:1px solid var(--border2);border-radius:7px;background:transparent;color:var(--text2);font-family:var(--font);font-size:13px;cursor:pointer;transition:all 0.18s}
.btn-pdf:hover{color:var(--text);border-color:var(--accent);background:var(--accent-glow)}

/* Loading */
.loading-bar{display:flex;align-items:center;gap:13px;padding:14px 18px;background:var(--accent-glow);border:1px solid rgba(79,124,255,0.2);border-radius:var(--r);color:var(--accent);font-size:15px;margin:18px 0}
.spinner{width:15px;height:15px;border:2px solid rgba(79,124,255,0.2);border-top-color:var(--accent);border-radius:50%;animation:spin 0.7s linear infinite;flex-shrink:0}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}

/* Error bar */
.error-bar{display:flex;align-items:flex-start;gap:13px;padding:14px 18px;background:var(--red-dim);border:1px solid rgba(232,64,64,0.3);border-radius:var(--r);color:var(--red);font-size:14px;margin:18px 0;line-height:1.5}

/* Agent logs */
.log-box{background:var(--s1);border:1px solid var(--border);border-radius:var(--r);overflow:hidden;margin:18px 0}
.log-header{display:flex;align-items:center;gap:9px;padding:12px 18px;border-bottom:1px solid var(--border);font-family:var(--mono);font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:var(--text3)}
.log-dot{width:6px;height:6px;background:var(--green);border-radius:50%;animation:pulse 1.5s ease-in-out infinite}
.log-entries{padding:14px 18px;max-height:210px;overflow-y:auto}
.log-entries::-webkit-scrollbar{width:3px}
.log-entries::-webkit-scrollbar-thumb{background:var(--border2);border-radius:2px}
.log-entry{display:flex;gap:12px;font-family:var(--mono);font-size:13px;line-height:1.9}
.la{color:var(--green);min-width:105px}
.lt{color:var(--text3)}
.lm{color:var(--text2)}

/* Result cards */
.result-card{background:var(--s1);border:1px solid var(--border);border-radius:var(--r);overflow:hidden;margin-bottom:18px}
.result-card.green-border{border-color:rgba(39,201,110,0.25)}
.result-card.blue-border{border-color:rgba(79,124,255,0.25)}
.result-card.amber-border{border-color:rgba(232,160,32,0.25)}
.result-card.red-border{border-color:rgba(232,64,64,0.25)}
.rh{display:flex;align-items:center;justify-content:space-between;padding:15px 22px;border-bottom:1px solid var(--border)}
.rh-left{display:flex;align-items:center;gap:11px}
.rh-actions{display:flex;align-items:center;gap:8px}
.rt{font-size:15px;font-weight:600;color:var(--text)}
.rtag{font-family:var(--mono);font-size:11px;font-weight:500;padding:4px 10px;border-radius:99px;letter-spacing:0.06em;text-transform:uppercase}
.rtag-green{background:var(--green-dim);color:var(--green);border:1px solid rgba(39,201,110,0.2)}
.rtag-blue{background:var(--accent-glow);color:var(--accent);border:1px solid rgba(79,124,255,0.2)}
.rtag-amber{background:var(--amber-dim);color:var(--amber);border:1px solid rgba(232,160,32,0.2)}
.rtag-red{background:var(--red-dim);color:var(--red);border:1px solid rgba(232,64,64,0.2)}
.rb{padding:22px}

/* Stats row */
.stats-row{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:18px}
.stat{background:var(--s2);border:1px solid var(--border);border-radius:9px;padding:16px;text-align:center}
.sn{font-family:var(--mono);font-size:28px;font-weight:500;color:#fff;letter-spacing:-0.02em}
.sl{font-family:var(--mono);font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:0.1em;margin-top:3px}

/* Summary */
.summary-block{font-size:15px;color:var(--text2);line-height:1.7;padding:16px 18px;background:var(--s2);border-radius:9px;border-left:3px solid var(--accent);margin-bottom:18px}

/* Section label */
.slabel{font-family:var(--mono);font-size:11px;letter-spacing:0.13em;text-transform:uppercase;color:var(--text3);margin-bottom:12px}

/* Decisions */
.decisions-list{list-style:none;margin-bottom:18px}
.di{display:flex;align-items:flex-start;gap:12px;padding:10px 0;border-bottom:1px solid var(--border);font-size:15px;color:var(--text2)}
.di:last-child{border-bottom:none}
.di::before{content:'—';color:var(--text3);flex-shrink:0;margin-top:1px}

/* Action items */
.ai-row{display:flex;align-items:center;gap:12px;padding:12px 16px;background:var(--s2);border:1px solid var(--border);border-radius:9px;margin-bottom:9px;transition:border-color 0.15s}
.ai-row:hover{border-color:var(--border2)}
.ai-owner{font-family:var(--mono);font-size:13px;color:var(--accent);min-width:86px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ai-task{flex:1;font-size:15px;color:var(--text2)}
.ai-due{font-family:var(--mono);font-size:12px;color:var(--text3);flex-shrink:0}
.pbadge{font-family:var(--mono);font-size:11px;font-weight:500;padding:3px 9px;border-radius:99px;text-transform:uppercase;letter-spacing:0.06em;flex-shrink:0}
.ph{background:var(--red-dim);color:var(--red);border:1px solid rgba(232,64,64,0.2)}
.pm{background:var(--amber-dim);color:var(--amber);border:1px solid rgba(232,160,32,0.2)}
.pl{background:var(--green-dim);color:var(--green);border:1px solid rgba(39,201,110,0.2)}

/* Markdown */
.md h1,.md h2,.md h3{font-size:15px;font-weight:600;color:var(--text);margin:16px 0 7px}
.md p{font-size:15px;color:var(--text2);margin-bottom:10px;line-height:1.7}
.md ul,.md ol{padding-left:20px;margin-bottom:10px}
.md li{font-size:15px;color:var(--text2);margin-bottom:5px}
.md strong{color:var(--text);font-weight:500}
.md code{font-family:var(--mono);font-size:13px;background:var(--s3);padding:2px 6px;border-radius:4px;color:var(--accent)}
.md a{color:var(--accent);text-decoration:none}

/* Bottom panel */
.bottom-wrap{margin-top:44px;padding-top:36px;border-top:1px solid var(--border)}
.mini-card{background:var(--s1);border:1px solid var(--border);border-radius:var(--r);padding:22px;text-align:center}
.mc-num{font-family:var(--mono);font-size:30px;color:#fff}
.mc-num.red{color:var(--red)}
.mc-label{font-family:var(--mono);font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:0.1em;margin-top:3px}

/* ROI ring */
.roi-row{display:flex;align-items:center;gap:22px;margin-bottom:18px}
.roi-ring{position:relative;width:84px;height:84px;flex-shrink:0}
.roi-ring svg{transform:rotate(-90deg)}
.roi-ring-bg{fill:none;stroke:var(--s3);stroke-width:6}
.roi-ring-fill{fill:none;stroke-width:6;stroke-linecap:round;transition:stroke-dashoffset 1s ease}
.roi-ring-num{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:var(--mono);font-size:19px;font-weight:500;color:#fff}
.roi-rec{font-size:15px;color:var(--text2);line-height:1.55}
.roi-cost{font-family:var(--mono);font-size:13px;color:var(--text3);margin-top:5px}

/* Conflict card */
.conflict-item{background:var(--s2);border:1px solid rgba(232,160,32,0.2);border-radius:9px;padding:16px;margin-bottom:12px}
.conflict-meta{display:flex;gap:11px;align-items:center;margin-bottom:10px;flex-wrap:wrap}
.conflict-type{font-family:var(--mono);font-size:11px;color:var(--amber);background:var(--amber-dim);padding:3px 9px;border-radius:99px;text-transform:uppercase}
.conflict-title{font-size:15px;color:var(--text)}
.conflict-slot{font-family:var(--mono);font-size:13px;color:var(--text2);margin-bottom:6px}
.conflict-note{font-size:14px;color:var(--text3);margin:7px 0 11px;font-style:italic}

/* Divider */
.divider{height:1px;background:var(--border);margin:36px 0}

/* Info message */
.info-msg{font-size:14px;color:var(--text3);padding:16px;background:var(--s2);border-radius:8px;border:1px solid var(--border);text-align:center}

@media(max-width:640px){
  .meeting-grid{grid-template-columns:1fr}
  .stats-row{grid-template-columns:1fr 1fr}
  .transcript-tabs{flex-wrap:wrap}
  .tab-btn{flex:none;width:calc(50% - 2px)}
}
`;

/* ── Sub-components ───────────────────────────────────────────────────────── */
function PriorityBadge({ priority }) {
  const p = (priority || 'medium').toLowerCase();
  const cls = p === 'high' ? 'ph' : p === 'low' ? 'pl' : 'pm';
  return <span className={`pbadge ${cls}`}>{p}</span>;
}

function ActionItemRow({ item, onDone }) {
  return (
    <div className="ai-row">
      <span className="ai-owner">{item.owner || 'Unknown'}</span>
      <span className="ai-task">{item.task || '—'}</span>
      <PriorityBadge priority={item.priority} />
      <span className="ai-due">{item.due_date || 'TBD'}</span>
      {item.id && onDone && (
        <button className="btn btn-sm btn-green" onClick={() => onDone(item.id)}>
          <Icon.CheckCircle /> Done
        </button>
      )}
    </div>
  );
}

function AgentLogs({ logs }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [logs]);
  if (!logs.length) return null;
  return (
    <div className="log-box">
      <div className="log-header">
        <div className="log-dot" />
        <Icon.Cpu /> Agent Activity
      </div>
      <div className="log-entries" ref={ref}>
        {logs.map((l, i) => (
          <div key={i} className="log-entry">
            <span className="la">[{l.agent}]</span>
            <span className="lt">{(l.timestamp || '').substring(11, 19)}</span>
            <span className="lm">{l.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RoiRing({ score, verdict }) {
  const r = 36, circ = 2 * Math.PI * r;
  const safeScore = typeof score === 'number' ? score : 0;
  const offset = circ - (safeScore / 100) * circ;
  const color = verdict === 'high' ? '#27c96e' : verdict === 'low' ? '#e84040' : '#4f7cff';
  return (
    <div className="roi-ring">
      <svg width="84" height="84" viewBox="0 0 84 84">
        <circle className="roi-ring-bg" cx="42" cy="42" r={r} />
        <circle
          className="roi-ring-fill"
          cx="42" cy="42" r={r}
          stroke={color}
          strokeDasharray={circ}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="roi-ring-num">{safeScore}</div>
    </div>
  );
}

function useCopy() {
  const [copied, setCopied] = useState(false);
  const copy = useCallback((text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);
  return { copied, copy };
}

function exportPDF(content, title = 'Meeting Summary') {
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>${title}</title>
<style>body{font-family:system-ui,sans-serif;font-size:15px;line-height:1.65;color:#1a1a2e;max-width:740px;margin:40px auto;padding:0 24px}
h1{font-size:24px;font-weight:700;margin-bottom:6px}
.meta{font-size:13px;color:#666;margin-bottom:28px}
h2{font-size:17px;font-weight:600;margin:22px 0 8px;border-bottom:1px solid #e0e0e0;padding-bottom:6px}
p{margin-bottom:10px}ul{padding-left:20px}li{margin-bottom:5px}
strong{font-weight:600}code{background:#f3f3f3;padding:2px 5px;border-radius:3px;font-family:monospace;font-size:13px}
</style></head><body>
<h1>${title}</h1>
<p class="meta">Exported · ${new Date().toLocaleString()}</p>
<div>${content.replace(/\n\n/g,'</p><p>').replace(/\n/g,'<br/>').replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/#{1,3} (.+)/g,'<h2>$1</h2>')}</div>
<script>window.onload=()=>window.print();<\/script>
</body></html>`);
  win.document.close();
}

function useRecorder() {
  const [recording, setRecording]   = useState(false);
  const [seconds, setSeconds]       = useState(0);
  const [audioBlob, setAudioBlob]   = useState(null);
  const mediaRef  = useRef(null);
  const timerRef  = useRef(null);
  const chunksRef = useRef([]);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        setAudioBlob(new Blob(chunksRef.current, { type: 'audio/webm' }));
        stream.getTracks().forEach(t => t.stop());
      };
      mr.start(250);
      mediaRef.current = mr;
      setRecording(true);
      setSeconds(0);
      setAudioBlob(null);
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } catch {
      alert('Microphone access denied. Please allow microphone access and try again.');
    }
  }, []);

  const stop = useCallback(() => {
    if (mediaRef.current && mediaRef.current.state !== 'inactive') mediaRef.current.stop();
    clearInterval(timerRef.current);
    setRecording(false);
  }, []);

  const reset = useCallback(() => { setAudioBlob(null); setSeconds(0); }, []);
  const fmt   = s => `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;

  return { recording, seconds, audioBlob, start, stop, reset, fmt };
}

/* ── Main App ────────────────────────────────────────────────────────────── */
export default function App() {
  // ── State ──
  const [meetingMode, setMeetingMode]       = useState('calendar');
  const [calEvents, setCalEvents]           = useState(null);     // null=loading, []|[..]=loaded, {error}=failed
  const [selectedEventId, setSelectedEventId] = useState('');    // just the ID string — avoids object ref issues
  const [sessionId, setSessionId]           = useState('');
  const [brief, setBrief]                   = useState('');
  const [transcriptTab, setTranscriptTab]   = useState('record');
  const [transcript, setTranscript]         = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadFile, setUploadFile]         = useState(null);
  const [uploadStatus, setUploadStatus]     = useState('');
  const [transcribed, setTranscribed]       = useState('');
  const [postResult, setPostResult]         = useState(null);
  const [logs, setLogs]                     = useState([]);
  const [loading, setLoading]               = useState('');
  const [apiError, setApiError]             = useState('');
  const [debtData, setDebtData]             = useState(null);
  const [debtError, setDebtError]           = useState('');
  const [conflicts, setConflicts]           = useState([]);
  const [conflictsLoaded, setConflictsLoaded] = useState(false);
  const [agendaStatus, setAgendaStatus]     = useState('');
  const [actionItems, setActionItems]       = useState([]);
  const [aiLoaded, setAiLoaded]             = useState(false);
  const [aiError, setAiError]               = useState('');

  const recorder    = useRecorder();
  const summaryCopy = useCopy();
  const briefCopy   = useCopy();

  // ── Load calendar events on mount ──────────────────────────────────────
  useEffect(() => {
    axios.get(`${API}/events`)
      .then(r => {
        const data = r.data;
        if (!Array.isArray(data)) {
          // Backend returned {error, fallback}
          setCalEvents({ error: data.error || 'Calendar unavailable' });
        } else {
          setCalEvents(data);
          // Auto-select first event
          if (data.length > 0) {
            setSelectedEventId(data[0].id);
          }
        }
      })
      .catch(err => {
        setCalEvents({ error: err.message || 'Calendar unavailable' });
      });
  }, []);

  // ── Derived values ──────────────────────────────────────────────────────
  const effectiveTranscript = transcribed || transcript;
  const canProcess = effectiveTranscript.trim().length > 20;

  // The currently selected event object (for reading attendees etc.)
  const selectedEvent = Array.isArray(calEvents)
    ? calEvents.find(ev => ev.id === selectedEventId) || null
    : null;

  // ── Prepare meeting ─────────────────────────────────────────────────────
  async function prepareMeeting() {
    setLoading('Preparing your meeting brief…');
    setApiError('');
    setBrief(''); setLogs([]); setPostResult(null); setSessionId('');

    const eventId = (meetingMode === 'calendar' && selectedEventId) ? selectedEventId : null;
    try {
      const res = await axios.post(`${API}/prepare`, { event_id: eventId });
      const data = res.data;
      setSessionId(data.meeting_id || '');
      setBrief(data.brief || '');
      if (data.meeting_id) await pollLogs(data.meeting_id);
    } catch (e) {
      setApiError('Prepare failed: ' + (e.response?.data?.detail || e.message));
    }
    setLoading('');
  }

  // ── Process transcript ──────────────────────────────────────────────────
  async function processTranscript() {
    const t = effectiveTranscript.trim();
    if (!t) { alert('No transcript found. Record audio, upload a file, or paste text.'); return; }

    setLoading('Processing transcript through agents…');
    setApiError('');
    setPostResult(null);

    // Auto-create session if Step 1 was skipped
    let sid = sessionId;
    if (!sid) {
      try {
        const res = await axios.post(`${API}/prepare`, { event_id: null });
        sid = res.data.meeting_id;
        setSessionId(sid);
      } catch { /* non-fatal */ }
    }

    try {
      const res = await axios.post(`${API}/process`, {
        meeting_id: sid || undefined,
        transcript: t,
      });
      const data = res.data;

      // Always set sessionId in case it was generated server-side
      if (data.meeting_id) setSessionId(data.meeting_id);

      // ── FIX: set postResult to the full response object ──
      // The component reads: data.summary, data.decisions, data.action_items,
      // data.tasks_created, data.emails_sent, data.roi_result, data.debt_result
      setPostResult(data);

      await pollLogs(data.meeting_id || sid);
    } catch (e) {
      setApiError('Process failed: ' + (e.response?.data?.detail || e.message));
    }
    setLoading('');
  }

  async function pollLogs(id) {
    if (!id) return;
    try {
      const res = await axios.get(`${API}/session/${id}`);
      setLogs(res.data.agent_logs || []);
    } catch { /* non-fatal */ }
  }

  // ── Recording → transcribe ──────────────────────────────────────────────
  async function submitRecording() {
    if (!recorder.audioBlob) return;
    setLoading('Transcribing recording…');
    const form = new FormData();
    form.append('file', recorder.audioBlob, 'recording.webm');
    try {
      const res = await axios.post(`${API}/transcribe`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: e => setUploadProgress(Math.round((e.loaded / e.total) * 100)),
      });
      setTranscribed(res.data.transcript || '');
      recorder.reset();
    } catch (e) {
      setTranscriptTab('paste');
      alert('Transcription failed: ' + (e.response?.data?.detail || e.message) + '\n\nPlease paste the transcript manually.');
    }
    setUploadProgress(0);
    setLoading('');
  }

  // ── File upload → transcribe ────────────────────────────────────────────
  async function handleFileUpload(file) {
    if (!file) return;
    setUploadFile(file);
    setUploadStatus('Uploading and transcribing…');
    setUploadProgress(0);
    const form = new FormData();
    form.append('file', file, file.name);
    try {
      const res = await axios.post(`${API}/transcribe`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: e => setUploadProgress(Math.round((e.loaded / e.total) * 100)),
      });
      setTranscribed(res.data.transcript || '');
      setUploadStatus('Transcription complete');
    } catch (e) {
      setUploadStatus('Failed — ' + (e.response?.data?.detail || e.message));
      setTranscriptTab('paste');
    }
  }

  function loadDemo() {
    setTranscript(DEMO_TRANSCRIPT);
    setTranscribed('');
    setTranscriptTab('paste');
  }

  // ── Differentiator handlers ─────────────────────────────────────────────
  async function loadDebt() {
    setDebtError('');
    try {
      const r = await axios.get(`${API}/debt`);
      setDebtData(r.data);
    } catch (e) {
      setDebtError('Failed to load debt data: ' + (e.response?.data?.detail || e.message));
    }
  }

  async function loadConflicts() {
    try {
      const r = await axios.get(`${API}/conflicts`);
      setConflicts(Array.isArray(r.data) ? r.data : []);
      setConflictsLoaded(true);
    } catch (e) {
      setConflicts([]);
      setConflictsLoaded(true);
    }
  }

  async function approveConflict(id) {
    try {
      const r = await axios.post(`${API}/conflicts/${id}/approve`);
      alert(`Rescheduled to: ${(r.data.new_time || '').substring(0, 16)}`);
      loadConflicts();
    } catch (e) {
      alert('Error: ' + (e.response?.data?.detail || e.message));
    }
  }

  async function markItemDone(id) {
    try {
      await axios.post(`${API}/action-items/${id}/done`);
      loadDebt();
      loadAllItems();
    } catch { /* non-fatal */ }
  }

  async function finalizeAgenda() {
    if (!sessionId) { alert('Prepare a meeting first.'); return; }
    setAgendaStatus('Synthesizing agenda from replies…');
    try {
      const r = await axios.post(`${API}/agenda/finalize/${sessionId}`);
      setAgendaStatus(`Done — ${r.data.replies_found} replies used. Calendar updated: ${r.data.calendar_patched}`);
    } catch (e) {
      setAgendaStatus('Error: ' + (e.response?.data?.detail || e.message));
    }
  }

  async function loadAllItems() {
    setAiError('');
    try {
      const r = await axios.get(`${API}/action-items`);
      setActionItems(Array.isArray(r.data) ? r.data : []);
      setAiLoaded(true);
    } catch (e) {
      setAiError('Failed to load action items: ' + (e.response?.data?.detail || e.message));
      setAiLoaded(true);
    }
  }

  function buildExportText() {
    if (!postResult) return '';
    const lines = [];
    if (postResult.summary) lines.push('# Summary\n\n' + postResult.summary);
    if (postResult.decisions?.length) {
      lines.push('\n## Key Decisions\n\n' + postResult.decisions.map(d => '- ' + d).join('\n'));
    }
    if (postResult.action_items?.length) {
      lines.push('\n## Action Items\n\n' + postResult.action_items.map(a =>
        `- [${a.owner}] ${a.task}  (${a.due_date || 'TBD'}, ${a.priority || 'medium'})`
      ).join('\n'));
    }
    return lines.join('\n');
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{css}</style>
      <div className="app">

        {/* ── HEADER ── */}
        <header className="header">
          <div className="header-eyebrow">Meeting Intelligence</div>
          <h1 className="header-title">Meri<span>dian</span></h1>
          <p className="header-sub">Capture · Analyse · Act on every meeting</p>
        </header>

        {/* ══════════════════════════════════════════════════
            STEP 1 — SELECT MEETING
        ══════════════════════════════════════════════════ */}
        <div className="section-eyebrow">Step 1 — Select your meeting</div>

        <div className="meeting-grid">
          <div
            className={`meeting-option ${meetingMode === 'calendar' ? 'selected' : ''}`}
            onClick={() => setMeetingMode('calendar')}
          >
            <span className="mo-icon"><Icon.Calendar /></span>
            <div className="mo-title">Select from Calendar</div>
            <div className="mo-desc">Pick an upcoming meeting from your connected Google Calendar</div>
          </div>
          <div
            className={`meeting-option ${meetingMode === 'auto' ? 'selected' : ''}`}
            onClick={() => { setMeetingMode('auto'); setSelectedEventId(''); }}
          >
            <span className="mo-icon"><Icon.Zap /></span>
            <div className="mo-title">Quick Session</div>
            <div className="mo-desc">Skip calendar — jump straight to transcript processing</div>
          </div>
        </div>

        {/* Calendar dropdown */}
        {meetingMode === 'calendar' && (
          <div className="cal-select-wrap">
            {calEvents === null && (
              <div className="info-msg">Loading calendar events…</div>
            )}
            {calEvents !== null && !Array.isArray(calEvents) && (
              <div style={{ color: 'var(--amber)', fontSize: 14, padding: '10px 0' }}>
                Calendar unavailable ({calEvents.error}) — use Quick Session instead.
              </div>
            )}
            {Array.isArray(calEvents) && calEvents.length === 0 && (
              <div className="info-msg">No upcoming events found in the next 7 days.</div>
            )}
            {Array.isArray(calEvents) && calEvents.length > 0 && (
              <>
                {/*
                  KEY FIX: value is selectedEventId (a plain string).
                  onChange sets selectedEventId directly to e.target.value.
                  No .find(), no object comparison — avoids async state mismatch.
                */}
                <select
                  className="cal-select"
                  value={selectedEventId}
                  onChange={e => setSelectedEventId(e.target.value)}
                >
                  {calEvents.map(ev => (
                    <option key={ev.id} value={ev.id}>
                      {/* Use the pre-formatted label from the backend */}
                      {ev.label || `${ev.title}  ·  ${ev.start || ''}`}
                    </option>
                  ))}
                </select>
                <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 6 }}>
                  {calEvents.length} upcoming event{calEvents.length !== 1 ? 's' : ''} found
                </div>
              </>
            )}
          </div>
        )}

        {meetingMode === 'calendar' && (
          <button
            className="primary-btn"
            style={{ marginTop: 18 }}
            onClick={prepareMeeting}
            disabled={!!loading || (meetingMode === 'calendar' && (!Array.isArray(calEvents) || calEvents.length === 0))}
          >
            {loading && loading.includes('brief') ? <div className="spinner" /> : <Icon.FileText />}
            {loading && loading.includes('brief') ? loading : 'Generate Pre-Meeting Brief'}
          </button>
        )}

        {sessionId && (
          <div className="session-pill">
            <div className="session-dot" />
            Session active
          </div>
        )}

        {apiError && (
          <div className="error-bar">
            <Icon.AlertTriangle />
            <span>{apiError}</span>
          </div>
        )}

        {loading && !loading.includes('brief') && !loading.includes('Transcribing') && (
          <div className="loading-bar"><div className="spinner" />{loading}</div>
        )}

        <AgentLogs logs={logs} />

        {brief && (
          <div className="result-card blue-border">
            <div className="rh">
              <div className="rh-left">
                <span className="rt">Pre-Meeting Brief</span>
                <span className="rtag rtag-blue">Generated</span>
              </div>
              <div className="rh-actions">
                <button className={`btn-copy ${briefCopy.copied ? 'copied' : ''}`} onClick={() => briefCopy.copy(brief)}>
                  {briefCopy.copied ? <Icon.Check /> : <Icon.Copy />}
                  {briefCopy.copied ? 'Copied' : 'Copy'}
                </button>
                <button className="btn-pdf" onClick={() => exportPDF(brief, 'Pre-Meeting Brief')}>
                  <Icon.Download /> PDF
                </button>
              </div>
            </div>
            <div className="rb">
              <div className="md"><ReactMarkdown>{brief}</ReactMarkdown></div>
            </div>
          </div>
        )}

        <div className="divider" />

        {/* ══════════════════════════════════════════════════
            STEP 2 — TRANSCRIPT INPUT
        ══════════════════════════════════════════════════ */}
        <div className="section-eyebrow">Step 2 — Capture meeting transcript</div>

        <div className="transcript-tabs">
          {[
            { id: 'record', icon: <Icon.Mic />,      label: 'Record Meeting' },
            { id: 'upload', icon: <Icon.Upload />,   label: 'Upload Audio' },
            { id: 'paste',  icon: <Icon.FileText />, label: 'Paste Text' },
          ].map(t => (
            <button
              key={t.id}
              className={`tab-btn ${transcriptTab === t.id ? 'active' : ''}`}
              onClick={() => setTranscriptTab(t.id)}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* Record */}
        {transcriptTab === 'record' && (
          <div className="record-panel">
            <button
              className={`record-btn ${recorder.recording ? 'recording' : ''}`}
              onClick={recorder.recording ? recorder.stop : recorder.start}
            >
              {recorder.recording ? <Icon.MicOff /> : <Icon.Mic />}
            </button>
            <div className="record-label">
              {recorder.recording
                ? 'Recording — click to stop'
                : recorder.audioBlob
                  ? 'Recording ready'
                  : 'Click to start recording'}
            </div>
            <div className="record-timer">{recorder.fmt(recorder.seconds)}</div>
            <div className="record-hint">Records audio from your microphone and converts to text</div>
            {recorder.audioBlob && !recorder.recording && (
              <div style={{ marginTop: 18, display: 'flex', gap: 12, justifyContent: 'center' }}>
                <button className="btn btn-danger btn-sm" onClick={recorder.reset}>
                  <Icon.Trash2 /> Discard
                </button>
                <button className="btn btn-green" onClick={submitRecording}>
                  {loading && loading.includes('Transcribing')
                    ? <><div className="spinner" /> Transcribing…</>
                    : <><Icon.Zap /> Transcribe</>}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Upload */}
        {transcriptTab === 'upload' && (
          !uploadFile || uploadStatus.includes('Failed') ? (
            <div
              className="upload-zone"
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); handleFileUpload(e.dataTransfer.files[0]); }}
            >
              <input
                type="file"
                accept=".mp3,.wav,.mp4,.webm,.ogg,.m4a,.flac"
                onChange={e => handleFileUpload(e.target.files[0])}
              />
              <div className="upload-icon"><Icon.Upload /></div>
              <div className="upload-title">Drop audio or video file here</div>
              <div className="upload-sub">MP3 · WAV · MP4 · WEBM · OGG · M4A · FLAC · Max 50 MB</div>
            </div>
          ) : (
            <div className="upload-progress">
              <div className="progress-file">
                <Icon.FileText />
                <span className="progress-name">{uploadFile.name}</span>
                <span style={{ fontSize: 13, color: 'var(--text3)' }}>
                  {(uploadFile.size / 1024 / 1024).toFixed(1)} MB
                </span>
              </div>
              <div className="progress-bar-wrap">
                <div className="progress-bar" style={{ width: `${uploadProgress}%` }} />
              </div>
              <div className="progress-status">
                {uploadStatus}
                {uploadProgress > 0 && uploadProgress < 100 ? ` ${uploadProgress}%` : ''}
              </div>
              {uploadStatus === 'Transcription complete' && (
                <button
                  className="btn btn-sm"
                  style={{ marginTop: 12 }}
                  onClick={() => { setUploadFile(null); setUploadStatus(''); setUploadProgress(0); }}
                >
                  Upload another file
                </button>
              )}
            </div>
          )
        )}

        {/* Paste */}
        {transcriptTab === 'paste' && (
          <div className="paste-panel">
            <textarea
              className="textarea"
              placeholder="Paste your meeting transcript here…"
              value={transcript}
              onChange={e => { setTranscript(e.target.value); setTranscribed(''); }}
              rows={8}
            />
            <span className="char-count">{transcript.length} chars</span>
          </div>
        )}

        <div className="demo-row">
          <button className="demo-btn" onClick={loadDemo}>
            <Icon.Zap /> Try Demo Data
          </button>
        </div>

        {transcribed && (
          <div className="transcript-preview">
            <div className="preview-header">
              <span className="preview-label">Transcribed</span>
              <button className="btn btn-sm" onClick={() => setTranscribed('')}>
                <Icon.Trash2 /> Clear
              </button>
            </div>
            <div className="preview-text">
              {transcribed.substring(0, 600)}{transcribed.length > 600 ? '…' : ''}
            </div>
          </div>
        )}

        <button
          className="primary-btn"
          onClick={processTranscript}
          disabled={!!loading || !canProcess}
          style={{ marginTop: 22 }}
        >
          {loading && loading.includes('Processing') ? <div className="spinner" /> : <Icon.Zap />}
          {loading && loading.includes('Processing') ? loading : 'Process Meeting'}
        </button>

        {/* ══════════════════════════════════════════════════
            RESULTS
        ══════════════════════════════════════════════════ */}
        {postResult && (
          <>
            <div className="divider" />
            <div className="section-eyebrow">Meeting results</div>

            {/* Stats — reads tasks_created, emails_sent, decisions from postResult directly */}
            <div className="stats-row">
              <div className="stat">
                <div className="sn">{postResult.tasks_created ?? 0}</div>
                <div className="sl">Action Items</div>
              </div>
              <div className="stat">
                <div className="sn">{postResult.emails_sent ?? 0}</div>
                <div className="sl">Emails Sent</div>
              </div>
              <div className="stat">
                <div className="sn">{postResult.decisions?.length ?? 0}</div>
                <div className="sl">Decisions</div>
              </div>
            </div>

            {/* Summary — postResult.summary is a plain string, not JSON */}
            {postResult.summary && (
              <div style={{ position: 'relative', marginBottom: 18 }}>
                <div className="summary-block">{postResult.summary}</div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button
                    className={`btn-copy ${summaryCopy.copied ? 'copied' : ''}`}
                    onClick={() => summaryCopy.copy(postResult.summary)}
                  >
                    {summaryCopy.copied ? <Icon.Check /> : <Icon.Copy />}
                    {summaryCopy.copied ? 'Copied' : 'Copy Summary'}
                  </button>
                  <button className="btn-pdf" onClick={() => exportPDF(buildExportText(), 'Meeting Summary')}>
                    <Icon.Download /> Export PDF
                  </button>
                </div>
              </div>
            )}

            {/* Decisions */}
            {postResult.decisions?.length > 0 && (
              <div className="result-card">
                <div className="rh">
                  <div className="rh-left"><span className="rt">Key Decisions</span></div>
                </div>
                <div className="rb">
                  <ul className="decisions-list">
                    {postResult.decisions.map((d, i) => <li key={i} className="di">{d}</li>)}
                  </ul>
                </div>
              </div>
            )}

            {/* Action items — reads postResult.action_items (set from task_data.items in orchestrator) */}
            {postResult.action_items?.length > 0 && (
              <div className="result-card green-border">
                <div className="rh">
                  <div className="rh-left">
                    <span className="rt">Action Items</span>
                    <span className="rtag rtag-green">{postResult.action_items.length}</span>
                  </div>
                </div>
                <div className="rb">
                  {postResult.action_items.map((a, i) => (
                    <ActionItemRow key={i} item={a} />
                  ))}
                </div>
              </div>
            )}

            {/* ROI — only renders when roi_result is a non-null object with a score */}
            {postResult.roi_result && typeof postResult.roi_result.score === 'number' && (
              <div className="result-card">
                <div className="rh">
                  <div className="rh-left">
                    <span className="rt">Meeting ROI</span>
                    <span className={`rtag rtag-${
                      postResult.roi_result.verdict === 'high' ? 'green' :
                      postResult.roi_result.verdict === 'low'  ? 'red'   : 'blue'
                    }`}>
                      {postResult.roi_result.verdict || 'medium'}
                    </span>
                  </div>
                </div>
                <div className="rb">
                  <div className="roi-row">
                    <RoiRing
                      score={postResult.roi_result.score}
                      verdict={postResult.roi_result.verdict}
                    />
                    <div>
                      <div className="roi-rec">{postResult.roi_result.recommendation}</div>
                      <div className="roi-cost">
                        ₹{(postResult.roi_result.cost_inr || 0).toLocaleString('en-IN')} ·{' '}
                        {postResult.roi_result.person_hours}h ·{' '}
                        {postResult.roi_result.num_attendees} attendee{postResult.roi_result.num_attendees !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                  <div className="stats-row">
                    <div className="stat">
                      <div className="sn">{postResult.roi_result.action_items_produced ?? 0}</div>
                      <div className="sl">Actions out</div>
                    </div>
                    <div className="stat">
                      <div className="sn">{postResult.roi_result.decisions_made ?? 0}</div>
                      <div className="sl">Decisions</div>
                    </div>
                    <div className="stat">
                      <div className="sn">{postResult.roi_result.agenda_completion_pct ?? 0}%</div>
                      <div className="sl">Agenda done</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* D1 Conflicts */}
            {postResult.conflict_result?.conflicts_found > 0 && (
              <div className="result-card amber-border">
                <div className="rh">
                  <div className="rh-left">
                    <span className="rt">
                      {postResult.conflict_result.conflicts_found} Calendar Conflict
                      {postResult.conflict_result.conflicts_found !== 1 ? 's' : ''}
                    </span>
                    <span className="rtag rtag-amber">Needs Action</span>
                  </div>
                </div>
                <div className="rb">
                  {postResult.conflict_result.proposals?.map((p, i) => (
                    <div key={i} className="conflict-item">
                      <div className="conflict-meta">
                        <span className="conflict-type">{p.conflict?.type}</span>
                        <span className="conflict-title">{p.conflict?.event_title}</span>
                      </div>
                      {p.proposed_slot && (
                        <div className="conflict-slot">
                          Proposed: {(() => {
                            try { return new Date(p.proposed_slot).toLocaleString('en-IN', { weekday:'short', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }); }
                            catch { return p.proposed_slot.substring(0, 16); }
                          })()}
                        </div>
                      )}
                      <div className="conflict-note">{p.note}</div>
                      {p.proposed_slot && (
                        <button className="btn btn-green btn-sm" onClick={() => approveConflict(p.id || String(i))}>
                          <Icon.CheckCircle /> Approve Reschedule
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* D2 Debt — only renders when debt_result is a non-null object */}
            {postResult.debt_result && typeof postResult.debt_result.open === 'number' && (
              <div className="result-card">
                <div className="rh">
                  <div className="rh-left">
                    <span className="rt">Team Meeting Debt</span>
                    {postResult.debt_result.overdue > 0 && (
                      <span className="rtag rtag-red">{postResult.debt_result.overdue} overdue</span>
                    )}
                  </div>
                </div>
                <div className="rb">
                  <div className="stats-row">
                    <div className="stat">
                      <div className="sn">{postResult.debt_result.open}</div>
                      <div className="sl">Open</div>
                    </div>
                    <div className="stat">
                      <div className="sn" style={{ color: postResult.debt_result.overdue > 0 ? 'var(--red)' : 'var(--green)' }}>
                        {postResult.debt_result.overdue}
                      </div>
                      <div className="sl">Overdue</div>
                    </div>
                    <div className="stat">
                      <div className="sn">{postResult.debt_result.escalated ?? 0}</div>
                      <div className="sl">Escalated</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════════
            TOOLS & HISTORY
        ══════════════════════════════════════════════════ */}
        <div className="bottom-wrap">
          <div className="section-eyebrow">Tools & History</div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 22 }}>
            <button className="btn" onClick={loadDebt}>
              <Icon.List /> Debt Summary
            </button>
            <button className="btn" onClick={loadAllItems}>
              <Icon.ClipboardList /> All Action Items
            </button>
            <button className="btn" onClick={loadConflicts}>
              <Icon.AlertTriangle /> Conflict Proposals
            </button>
            {sessionId && (
              <button className="btn" onClick={finalizeAgenda}>
                <Icon.RefreshCw /> Finalize Agenda
              </button>
            )}
          </div>

          {agendaStatus && (
            <div className="loading-bar" style={{ marginBottom: 18 }}>{agendaStatus}</div>
          )}

          {/* Debt summary */}
          {debtError && <div className="error-bar"><Icon.AlertTriangle /><span>{debtError}</span></div>}
          {debtData && typeof debtData.open === 'number' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
                <div className="mini-card">
                  <div className="mc-num">{debtData.open}</div>
                  <div className="mc-label">Open Items</div>
                </div>
                <div className="mini-card">
                  <div className={`mc-num ${debtData.overdue > 0 ? 'red' : ''}`}>{debtData.overdue}</div>
                  <div className="mc-label">Overdue</div>
                </div>
              </div>
              {debtData.overdue_items?.length > 0 && (
                <>
                  <div className="slabel">Overdue Items</div>
                  {debtData.overdue_items.map((a, i) => (
                    <ActionItemRow key={i} item={a} onDone={markItemDone} />
                  ))}
                </>
              )}
              {debtData.overdue_items?.length === 0 && debtData.open === 0 && (
                <div className="info-msg">No open action items. Great work! 🎉</div>
              )}
            </>
          )}

          {/* All action items */}
          {aiError && <div className="error-bar"><Icon.AlertTriangle /><span>{aiError}</span></div>}
          {aiLoaded && actionItems.length > 0 && (
            <>
              <div className="slabel" style={{ marginTop: 18 }}>
                All Open Items ({actionItems.length})
              </div>
              {actionItems.map((a, i) => (
                <ActionItemRow key={i} item={a} onDone={markItemDone} />
              ))}
            </>
          )}
          {aiLoaded && actionItems.length === 0 && !aiError && (
            <div className="info-msg" style={{ marginTop: 12 }}>No open action items found.</div>
          )}

          {/* Conflicts */}
          {conflictsLoaded && conflicts.length > 0 && (
            <>
              <div className="slabel" style={{ marginTop: 18 }}>
                Pending Reschedule Proposals ({conflicts.length})
              </div>
              {conflicts.map((c, i) => (
                <div key={i} className="conflict-item">
                  <div className="conflict-meta">
                    <span className="conflict-type">{c.conflict?.type}</span>
                    <span className="conflict-title">{c.conflict?.event_title}</span>
                  </div>
                  {c.proposed_slot && (
                    <div className="conflict-slot">→ {c.proposed_slot?.substring(0, 16)}</div>
                  )}
                  <div className="conflict-note">{c.note}</div>
                  <button className="btn btn-green btn-sm" onClick={() => approveConflict(c.id)}>
                    <Icon.CheckCircle /> Approve
                  </button>
                </div>
              ))}
            </>
          )}
          {conflictsLoaded && conflicts.length === 0 && (
            <div className="info-msg" style={{ marginTop: 12 }}>No pending conflict proposals.</div>
          )}
        </div>

      </div>
    </>
  );
}