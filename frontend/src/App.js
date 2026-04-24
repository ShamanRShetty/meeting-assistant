import { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';

const API = process.env.REACT_APP_API_URL || '/api';

// ── Hardcoded demo events — shown when API is unreachable or returns empty ──
// These mirror demo_data.py exactly so judges always have events to test with.
function buildDemoEvents() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const istLabel = (d) => {
    const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${days[ist.getUTCDay()]}, ${pad(ist.getUTCDate())} ${months[ist.getUTCMonth()]} ${pad(ist.getUTCHours())}:${pad(ist.getUTCMinutes())}`;
  };
  const iso = d => d.toISOString().replace('Z', '+05:30');
  const h = (hrs) => new Date(now.getTime() + hrs * 3600000);
  return [
    { id: 'demo_event_001', title: 'Q2 Product Roadmap Review',     start: iso(h(2)),    label: `Q2 Product Roadmap Review  ·  ${istLabel(h(2))} IST`,    attendees: ['priya@acmecorp.com','rahul@acmecorp.com','demo@meridian.app'] },
    { id: 'demo_event_002', title: 'Client Call — TechVentures',    start: iso(h(25)),   label: `Client Call — TechVentures  ·  ${istLabel(h(25))} IST`,   attendees: ['ananya@techventures.io','demo@meridian.app'] },
    { id: 'demo_event_003', title: 'Engineering Team Standup',      start: iso(h(27)),   label: `Engineering Team Standup  ·  ${istLabel(h(27))} IST`,     attendees: ['bob@acmecorp.com','carol@acmecorp.com','dave@acmecorp.com','demo@meridian.app'] },
    { id: 'demo_event_004', title: 'Design Review — Dashboard v2',  start: iso(h(48.5)), label: `Design Review — Dashboard v2  ·  ${istLabel(h(48.5))} IST`, attendees: ['meena@acmecorp.com','demo@meridian.app'] },
    { id: 'demo_event_005', title: 'Sprint Planning — Sprint 24',   start: iso(h(74)),   label: `Sprint Planning — Sprint 24  ·  ${istLabel(h(74))} IST`,  attendees: ['bob@acmecorp.com','carol@acmecorp.com','rahul@acmecorp.com','demo@meridian.app'] },
  ];
}

const DEMO_TRANSCRIPT = `Alice: Alright, let's get started. Main item — the login bug in production. Users on mobile can't sign in with Google OAuth.

Bob: I reproduced it this morning. It only happens on iOS Safari, specifically iOS 17 and above. The issue is how Safari handles third-party cookies in OAuth redirects.

Alice: That's a critical blocker. Bob, can you have a fix ready by Monday?

Bob: Yes, I'll patch the redirect handling and have a PR up by Monday morning.

Alice: Carol, can you do a code review Monday evening so we can ship Tuesday?

Carol: Absolutely. I'll block out Monday 4-6 PM for it.

Alice: Perfect. Next — the Q3 board report. David, where are we?

David: I'm still waiting on the sales data from Priya in finance. She said she'd send it by EOD today. I'll follow up in 30 minutes and make sure we have everything by Wednesday.

Alice: The board presentation is Friday. We cannot miss that deadline, David.

David: Understood. I'll also prepare the executive summary section by Thursday and send it to you for review.

Alice: Good. Carol, you mentioned the API docs were out of date?

Carol: Yes, the docs haven't been updated since the v2.3 release. I'll update the authentication and webhook sections this week — done by Wednesday.

Alice: Great. Let's also track the dashboard performance issues Rahul flagged last week. Rahul, any update?

Rahul: I've identified the root cause — it's N+1 queries on the analytics page. I'll fix the query optimization by Thursday EOD.

Alice: Excellent. Let's sync again Thursday at 3 PM to check progress. Carol, can you send a calendar invite?

Carol: Done, sending it right now.

Alice: One last thing — we should move Sprint 24 planning to next Monday given these blockers. Everyone okay with that?

Bob: Works for me.
David: Same.
Carol: Monday works.
Rahul: Fine by me.

Alice: Great. Monday it is. Thanks everyone.`;

/* ── SVG Icons ────────────────────────────────────────────────────────────── */
const Icon = {
  Calendar: () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>),
  Zap: () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>),
  Mic: () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>),
  MicOff: () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>),
  Upload: () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>),
  FileText: () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>),
  Copy: () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>),
  Check: () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>),
  Download: () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>),
  CheckCircle: () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>),
  AlertTriangle: () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>),
  TrendingUp: () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>),
  RefreshCw: () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>),
  List: () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>),
  ClipboardList: () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="15" y2="16"/></svg>),
  Cpu: () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></svg>),
  Trash2: () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>),
  Google: () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>),
  Play: () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>),
  Info: () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="8"/><line x1="12" y1="12" x2="12" y2="16"/></svg>),
  LogOut: () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>),
};

/* ── Global CSS ──────────────────────────────────────────────────────────── */
const css = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#07090f;--s1:#0c0f1a;--s2:#111521;--s3:#181e2e;
  --border:#1e2538;--border2:#28304a;
  --text:#dce4f2;--text2:#8494b8;--text3:#3a4a6a;
  --accent:#4f7cff;--accent2:#6b95ff;--accent-glow:rgba(79,124,255,0.12);
  --green:#27c96e;--green-dim:rgba(39,201,110,0.1);
  --amber:#e8a020;--amber-dim:rgba(232,160,32,0.1);
  --red:#e84040;--red-dim:rgba(232,64,64,0.1);
  --purple:#9b6dff;--purple-dim:rgba(155,109,255,0.1);
  --teal:#22d3c8;--teal-dim:rgba(34,211,200,0.1);
  --r:10px;--font:'Inter',system-ui,sans-serif;--mono:'JetBrains Mono',ui-monospace,monospace;
}
body{background:var(--bg);color:var(--text);font-family:var(--font);font-size:16px;line-height:1.65;min-height:100vh;-webkit-font-smoothing:antialiased}
.app{max-width:1020px;margin:0 auto;padding:52px 28px 120px}

/* ── Landing / Auth screen ── */
.landing{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 24px;text-align:center;background:var(--bg);position:relative;overflow:hidden}
.landing::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 80% 60% at 50% 0%,rgba(79,124,255,0.07),transparent);pointer-events:none}
.landing-logo{font-family:var(--mono);font-size:13px;letter-spacing:0.2em;text-transform:uppercase;color:var(--accent);margin-bottom:32px;display:flex;align-items:center;gap:10px}
.landing-logo::before,.landing-logo::after{content:'';display:block;flex:1;max-width:40px;height:1px;background:var(--accent);opacity:0.5}
.landing-title{font-size:clamp(42px,8vw,72px);font-weight:700;letter-spacing:-0.04em;line-height:1.05;color:#fff;margin-bottom:10px}
.landing-title span{color:var(--accent)}
.landing-tagline{font-size:18px;color:var(--text2);margin-bottom:48px;max-width:480px;line-height:1.6}
.landing-cards{display:grid;grid-template-columns:1fr 1fr;gap:16px;width:100%;max-width:520px;margin-bottom:24px}
@media(max-width:520px){.landing-cards{grid-template-columns:1fr}}

.auth-card{border-radius:14px;padding:26px 22px;cursor:pointer;transition:all 0.2s;text-align:left;border:none;width:100%;font-family:var(--font)}
.auth-card.demo{background:var(--accent);color:#fff;box-shadow:0 8px 32px rgba(79,124,255,0.35)}
.auth-card.demo:hover{background:var(--accent2);transform:translateY(-2px);box-shadow:0 12px 40px rgba(79,124,255,0.45)}
.auth-card.google{background:var(--s1);border:1px solid var(--border2);color:var(--text)}
.auth-card.google:hover{border-color:var(--accent);background:var(--s2);transform:translateY(-1px)}
.auth-card-icon{margin-bottom:14px;display:flex;align-items:center;gap:10px}
.auth-card-title{font-size:17px;font-weight:700;margin-bottom:6px;color:inherit}
.auth-card.google .auth-card-title{color:var(--text)}
.auth-card-desc{font-size:13px;line-height:1.5;opacity:0.85}
.auth-card.google .auth-card-desc{color:var(--text2);opacity:1}
.auth-badge{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-family:var(--mono);font-weight:600;text-transform:uppercase;letter-spacing:0.08em;padding:3px 9px;border-radius:99px;margin-bottom:10px}
.auth-badge.demo{background:rgba(255,255,255,0.2);color:#fff}
.auth-badge.google{background:var(--s3);color:var(--text3);border:1px solid var(--border)}
.auth-notice{font-size:13px;color:var(--amber);max-width:480px;line-height:1.6;padding:14px 18px;background:var(--amber-dim);border:1px solid rgba(232,160,32,0.3);border-radius:10px;text-align:center;margin-top:8px;}
.auth-notice strong{color:#fff}
.auth-notice strong{color:var(--amber)}

/* ── Demo mode banner ── */
.demo-banner{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 18px;background:linear-gradient(90deg,rgba(79,124,255,0.12),rgba(79,124,255,0.06));border:1px solid rgba(79,124,255,0.25);border-radius:9px;margin-bottom:28px;flex-wrap:wrap}
.demo-banner-left{display:flex;align-items:center;gap:10px}
.demo-badge{font-family:var(--mono);font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:#fff;background:var(--accent);padding:3px 10px;border-radius:99px}
.demo-banner-text{font-size:13px;color:var(--text2)}
.demo-banner-link{font-size:12px;color:var(--accent);text-decoration:none;white-space:nowrap;display:flex;align-items:center;gap:5px;cursor:pointer;background:none;border:none;font-family:var(--font)}
.demo-banner-link:hover{text-decoration:underline}

/* ── Header ── */
.header{margin-bottom:48px}
.header-eyebrow{font-family:var(--mono);font-size:11px;color:var(--accent);letter-spacing:0.18em;text-transform:uppercase;margin-bottom:14px;display:flex;align-items:center;gap:10px}
.header-eyebrow::before{content:'';display:block;width:22px;height:1px;background:var(--accent)}
.header-title{font-size:38px;font-weight:700;color:#fff;letter-spacing:-0.04em;line-height:1.1;margin-bottom:8px}
.header-title span{color:var(--accent)}
.header-sub{font-size:15px;color:var(--text2)}
.section-eyebrow{font-family:var(--mono);font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:var(--text3);margin-bottom:22px;display:flex;align-items:center;gap:12px}
.section-eyebrow::after{content:'';flex:1;height:1px;background:var(--border)}

/* ── Meeting mode grid ── */
.meeting-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px}
.meeting-option{background:var(--s1);border:1px solid var(--border);border-radius:var(--r);padding:22px 20px;cursor:pointer;transition:all 0.18s}
.meeting-option:hover{border-color:var(--border2)}
.meeting-option.selected{border-color:var(--accent);background:var(--s2)}
.mo-icon{margin-bottom:12px;color:var(--accent);display:block}
.mo-title{font-size:15px;font-weight:600;color:var(--text);margin-bottom:4px}
.mo-desc{font-size:14px;color:var(--text2);line-height:1.5}

/* ── Calendar select ── */
.cal-select-wrap{margin-top:14px}
.cal-select{width:100%;background:var(--s2);border:1px solid var(--border);border-radius:8px;padding:13px 44px 13px 16px;color:var(--text);font-family:var(--font);font-size:15px;outline:none;cursor:pointer;transition:border-color 0.18s;-webkit-appearance:none;appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%238494b8' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 16px center}
.cal-select:focus{border-color:var(--accent)}
.cal-select option{background:#111521;color:#dce4f2;padding:8px}
.demo-events-note{font-size:12px;color:var(--teal);font-family:var(--mono);margin-top:6px;display:flex;align-items:center;gap:5px}

/* ── Session pill ── */
.session-pill{display:inline-flex;align-items:center;gap:8px;font-family:var(--mono);font-size:12px;color:var(--accent);background:var(--accent-glow);border:1px solid rgba(79,124,255,0.2);padding:6px 14px;border-radius:99px;margin-top:14px}
.session-dot{width:6px;height:6px;background:var(--green);border-radius:50%;animation:pulse 1.5s ease-in-out infinite}

/* ── Transcript tabs ── */
.transcript-tabs{display:flex;gap:4px;margin-bottom:18px;background:var(--s1);border:1px solid var(--border);border-radius:10px;padding:4px}
.tab-btn{flex:1;padding:10px 14px;border:none;border-radius:8px;cursor:pointer;font-family:var(--font);font-size:14px;font-weight:500;color:var(--text2);background:transparent;transition:all 0.18s;display:flex;align-items:center;justify-content:center;gap:7px;white-space:nowrap}
.tab-btn:hover{color:var(--text)}
.tab-btn.active{background:var(--s3);color:var(--text);border:1px solid var(--border2)}

/* ── Record ── */
.record-panel{background:var(--s1);border:1px solid var(--border);border-radius:var(--r);padding:36px 28px;text-align:center}
.record-btn{width:84px;height:84px;border-radius:50%;border:2px solid var(--border2);cursor:pointer;background:var(--s3);display:flex;align-items:center;justify-content:center;margin:0 auto 18px;transition:all 0.18s;color:var(--text2)}
.record-btn:hover{border-color:var(--red);color:var(--red);transform:scale(1.04)}
.record-btn.recording{background:var(--red-dim);border-color:var(--red);color:var(--red);animation:recpulse 1s ease-in-out infinite}
@keyframes recpulse{0%,100%{box-shadow:0 0 0 0 rgba(232,64,64,0.35)}50%{box-shadow:0 0 0 18px rgba(232,64,64,0)}}
.record-label{font-size:15px;color:var(--text2);margin-bottom:8px}
.record-timer{font-family:var(--mono);font-size:24px;color:var(--text);letter-spacing:0.06em}
.record-hint{font-size:13px;color:var(--text3);margin-top:10px}

/* ── Upload ── */
.upload-zone{background:var(--s1);border:2px dashed var(--border);border-radius:var(--r);padding:44px 28px;text-align:center;cursor:pointer;transition:all 0.18s;position:relative}
.upload-zone:hover,.upload-zone.drag{border-color:var(--accent);background:var(--s2)}
.upload-zone input{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%}
.upload-icon{margin-bottom:14px;color:var(--text3);display:flex;justify-content:center}
.upload-icon svg{width:34px;height:34px}
.upload-title{font-size:15px;font-weight:500;color:var(--text);margin-bottom:5px}
.upload-sub{font-size:13px;color:var(--text3)}
.upload-progress{background:var(--s2);border:1px solid var(--border);border-radius:var(--r);padding:22px}
.progress-file{display:flex;align-items:center;gap:14px;margin-bottom:14px}
.progress-name{font-size:14px;color:var(--text);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.progress-bar-wrap{height:4px;background:var(--s3);border-radius:2px;overflow:hidden}
.progress-bar{height:100%;background:var(--accent);border-radius:2px;transition:width 0.3s}
.progress-status{font-family:var(--mono);font-size:12px;color:var(--text2);margin-top:10px}

/* ── Textarea ── */
.paste-panel{position:relative}
.textarea{width:100%;background:var(--s1);border:1px solid var(--border);border-radius:var(--r);padding:16px;color:var(--text);font-family:var(--mono);font-size:14px;line-height:1.7;resize:vertical;outline:none;transition:border-color 0.18s;min-height:170px}
.textarea:focus{border-color:var(--accent)}
.textarea::placeholder{color:var(--text3)}
.char-count{position:absolute;bottom:13px;right:16px;font-family:var(--mono);font-size:12px;color:var(--text3)}
.demo-row{margin-top:12px;display:flex;justify-content:flex-end;gap:8px}
.demo-btn{font-family:var(--mono);font-size:12px;color:var(--purple);background:var(--purple-dim);border:1px solid rgba(155,109,255,0.2);padding:7px 16px;border-radius:99px;cursor:pointer;transition:all 0.18s;display:flex;align-items:center;gap:6px}
.demo-btn:hover{background:rgba(155,109,255,0.2)}
.demo-btn.teal{color:var(--teal);background:var(--teal-dim);border-color:rgba(34,211,200,0.2)}
.demo-btn.teal:hover{background:rgba(34,211,200,0.2)}

/* ── Transcript preview ── */
.transcript-preview{background:var(--s1);border:1px solid var(--green);border-radius:var(--r);padding:18px;margin-top:14px}
.preview-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
.preview-label{font-family:var(--mono);font-size:11px;color:var(--green);letter-spacing:0.12em;text-transform:uppercase}
.preview-text{font-family:var(--mono);font-size:13px;color:var(--text2);line-height:1.65;max-height:130px;overflow-y:auto}
.preview-text::-webkit-scrollbar{width:3px}
.preview-text::-webkit-scrollbar-thumb{background:var(--border2);border-radius:2px}

/* ── Buttons ── */
.primary-btn{width:100%;padding:15px 26px;background:var(--accent);color:#fff;border:none;border-radius:var(--r);font-family:var(--font);font-size:16px;font-weight:600;cursor:pointer;transition:all 0.18s;display:flex;align-items:center;justify-content:center;gap:9px;margin-top:22px}
.primary-btn:hover{background:var(--accent2);box-shadow:0 8px 28px rgba(79,124,255,0.28)}
.primary-btn:active{transform:scale(0.99)}
.primary-btn:disabled{background:var(--s3);color:var(--text3);cursor:not-allowed;box-shadow:none}
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

/* ── Loading / Error ── */
.loading-bar{display:flex;align-items:center;gap:13px;padding:14px 18px;background:var(--accent-glow);border:1px solid rgba(79,124,255,0.2);border-radius:var(--r);color:var(--accent);font-size:15px;margin:18px 0}
.spinner{width:15px;height:15px;border:2px solid rgba(79,124,255,0.2);border-top-color:var(--accent);border-radius:50%;animation:spin 0.7s linear infinite;flex-shrink:0}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
.error-bar{display:flex;align-items:flex-start;gap:13px;padding:14px 18px;background:var(--red-dim);border:1px solid rgba(232,64,64,0.3);border-radius:var(--r);color:var(--red);font-size:14px;margin:18px 0;line-height:1.5}

/* ── Agent logs ── */
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

/* ── Result cards ── */
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
.rtag-teal{background:var(--teal-dim);color:var(--teal);border:1px solid rgba(34,211,200,0.2)}
.rb{padding:22px}

/* ── Stats ── */
.stats-row{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:18px}
.stat{background:var(--s2);border:1px solid var(--border);border-radius:9px;padding:16px;text-align:center}
.sn{font-family:var(--mono);font-size:28px;font-weight:500;color:#fff;letter-spacing:-0.02em}
.sl{font-family:var(--mono);font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:0.1em;margin-top:3px}
.summary-block{font-size:15px;color:var(--text2);line-height:1.7;padding:16px 18px;background:var(--s2);border-radius:9px;border-left:3px solid var(--accent);margin-bottom:18px}
.slabel{font-family:var(--mono);font-size:11px;letter-spacing:0.13em;text-transform:uppercase;color:var(--text3);margin-bottom:12px}
.decisions-list{list-style:none;margin-bottom:18px}
.di{display:flex;align-items:flex-start;gap:12px;padding:10px 0;border-bottom:1px solid var(--border);font-size:15px;color:var(--text2)}
.di:last-child{border-bottom:none}
.di::before{content:'—';color:var(--text3);flex-shrink:0;margin-top:1px}

/* ── Action items ── */
.ai-row{display:flex;align-items:center;gap:12px;padding:12px 16px;background:var(--s2);border:1px solid var(--border);border-radius:9px;margin-bottom:9px;transition:border-color 0.15s}
.ai-row:hover{border-color:var(--border2)}
.ai-owner{font-family:var(--mono);font-size:13px;color:var(--accent);min-width:86px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ai-task{flex:1;font-size:15px;color:var(--text2)}
.ai-due{font-family:var(--mono);font-size:12px;color:var(--text3);flex-shrink:0}
.pbadge{font-family:var(--mono);font-size:11px;font-weight:500;padding:3px 9px;border-radius:99px;text-transform:uppercase;letter-spacing:0.06em;flex-shrink:0}
.ph{background:var(--red-dim);color:var(--red);border:1px solid rgba(232,64,64,0.2)}
.pm{background:var(--amber-dim);color:var(--amber);border:1px solid rgba(232,160,32,0.2)}
.pl{background:var(--green-dim);color:var(--green);border:1px solid rgba(39,201,110,0.2)}

/* ── Markdown ── */
.md h1,.md h2,.md h3{font-size:15px;font-weight:600;color:var(--text);margin:16px 0 7px}
.md p{font-size:15px;color:var(--text2);margin-bottom:10px;line-height:1.7}
.md ul,.md ol{padding-left:20px;margin-bottom:10px}
.md li{font-size:15px;color:var(--text2);margin-bottom:5px}
.md strong{color:var(--text);font-weight:500}
.md code{font-family:var(--mono);font-size:13px;background:var(--s3);padding:2px 6px;border-radius:4px;color:var(--accent)}
.md a{color:var(--accent);text-decoration:none}

/* ── Bottom ── */
.bottom-wrap{margin-top:44px;padding-top:36px;border-top:1px solid var(--border)}
.mini-card{background:var(--s1);border:1px solid var(--border);border-radius:var(--r);padding:22px;text-align:center}
.mc-num{font-family:var(--mono);font-size:30px;color:#fff}
.mc-num.red{color:var(--red)}
.mc-label{font-family:var(--mono);font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:0.1em;margin-top:3px}
.roi-row{display:flex;align-items:center;gap:22px;margin-bottom:18px}
.roi-ring{position:relative;width:84px;height:84px;flex-shrink:0}
.roi-ring svg{transform:rotate(-90deg)}
.roi-ring-bg{fill:none;stroke:var(--s3);stroke-width:6}
.roi-ring-fill{fill:none;stroke-width:6;stroke-linecap:round;transition:stroke-dashoffset 1s ease}
.roi-ring-num{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:var(--mono);font-size:19px;font-weight:500;color:#fff}
.roi-rec{font-size:15px;color:var(--text2);line-height:1.55}
.roi-cost{font-family:var(--mono);font-size:13px;color:var(--text3);margin-top:5px}
.conflict-item{background:var(--s2);border:1px solid rgba(232,160,32,0.2);border-radius:9px;padding:16px;margin-bottom:12px}
.conflict-meta{display:flex;gap:11px;align-items:center;margin-bottom:10px;flex-wrap:wrap}
.conflict-type{font-family:var(--mono);font-size:11px;color:var(--amber);background:var(--amber-dim);padding:3px 9px;border-radius:99px;text-transform:uppercase}
.conflict-title{font-size:15px;color:var(--text)}
.conflict-slot{font-family:var(--mono);font-size:13px;color:var(--text2);margin-bottom:6px}
.conflict-note{font-size:14px;color:var(--text3);margin:7px 0 11px;font-style:italic}
.divider{height:1px;background:var(--border);margin:36px 0}
.info-msg{font-size:14px;color:var(--text3);padding:16px;background:var(--s2);border-radius:8px;border:1px solid var(--border);text-align:center}

@media(max-width:640px){
  .meeting-grid{grid-template-columns:1fr}
  .stats-row{grid-template-columns:1fr 1fr}
  .transcript-tabs{flex-wrap:wrap}
  .tab-btn{flex:none;width:calc(50% - 2px)}
}
`;

/* ── Sub-components ─────────────────────────────────────────────────────── */
function PriorityBadge({ priority }) {
  const p = (priority || 'medium').toLowerCase();
  return <span className={`pbadge ${p === 'high' ? 'ph' : p === 'low' ? 'pl' : 'pm'}`}>{p}</span>;
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
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [logs]);
  if (!logs.length) return null;
  return (
    <div className="log-box">
      <div className="log-header"><div className="log-dot" /><Icon.Cpu /> Agent Activity</div>
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
  const s = typeof score === 'number' ? score : 0;
  const offset = circ - (s / 100) * circ;
  const color = verdict === 'high' ? '#27c96e' : verdict === 'low' ? '#e84040' : '#4f7cff';
  return (
    <div className="roi-ring">
      <svg width="84" height="84" viewBox="0 0 84 84">
        <circle className="roi-ring-bg" cx="42" cy="42" r={r} />
        <circle className="roi-ring-fill" cx="42" cy="42" r={r} stroke={color} strokeDasharray={circ} strokeDashoffset={offset} />
      </svg>
      <div className="roi-ring-num">{s}</div>
    </div>
  );
}

function useCopy() {
  const [copied, setCopied] = useState(false);
  const copy = useCallback((text) => {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }, []);
  return { copied, copy };
}

function exportPDF(content, title = 'Meeting Summary') {
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${title}</title>
<style>body{font-family:system-ui,sans-serif;font-size:15px;line-height:1.65;color:#1a1a2e;max-width:740px;margin:40px auto;padding:0 24px}
h1{font-size:24px;font-weight:700}h2{font-size:17px;font-weight:600;margin:22px 0 8px;border-bottom:1px solid #e0e0e0;padding-bottom:6px}
p{margin-bottom:10px}ul{padding-left:20px}li{margin-bottom:5px}</style></head><body>
<h1>${title}</h1><p style="color:#666;font-size:13px">Exported · ${new Date().toLocaleString()}</p>
<div>${content.replace(/\n\n/g,'</p><p>').replace(/\n/g,'<br/>').replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/#{1,3} (.+)/g,'<h2>$1</h2>')}</div>
<script>window.onload=()=>window.print();<\/script></body></html>`);
  win.document.close();
}

function useRecorder() {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const mediaRef = useRef(null);
  const timerRef = useRef(null);
  const chunksRef = useRef([]);
  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => { setAudioBlob(new Blob(chunksRef.current, { type: 'audio/webm' })); stream.getTracks().forEach(t => t.stop()); };
      mr.start(250);
      mediaRef.current = mr;
      setRecording(true); setSeconds(0); setAudioBlob(null);
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } catch { alert('Microphone access denied.'); }
  }, []);
  const stop = useCallback(() => {
    if (mediaRef.current && mediaRef.current.state !== 'inactive') mediaRef.current.stop();
    clearInterval(timerRef.current); setRecording(false);
  }, []);
  const reset = useCallback(() => { setAudioBlob(null); setSeconds(0); }, []);
  const fmt = s => `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;
  return { recording, seconds, audioBlob, start, stop, reset, fmt };
}

/* ═══════════════════════════════════════════════════════════
   LANDING PAGE
═══════════════════════════════════════════════════════════ */
function LandingPage({ onDemo, onGoogleLogin, authError }) {
  return (
    <div className="landing">
      <div className="landing-logo">Meeting Intelligence</div>
      <h1 className="landing-title">Meri<span>dian</span></h1>
      <p className="landing-tagline">AI-powered meeting briefs, transcription, action items, and ROI scoring — all in one place.</p>

      <div className="landing-cards">
        <button className="auth-card demo" onClick={onDemo}>
          <div className="auth-badge demo">✦ No Login Needed</div>
          <div className="auth-card-icon"><Icon.Zap /></div>
          <div className="auth-card-title">Try Demo Mode</div>
          <div className="auth-card-desc">Full access instantly. Demo calendar events, live AI processing, real Gemini output.</div>
        </button>

        <button className="auth-card google" onClick={onGoogleLogin}>
          <div className="auth-badge google">Google OAuth</div>
          <div className="auth-card-icon"><Icon.Google /></div>
          <div className="auth-card-title">Sign in with Google</div>
          <div className="auth-card-desc">Connect your Calendar, Drive & Gmail for personalised meeting intelligence.</div>
        </button>
      </div>

      {authError && (
        <div style={{
          marginBottom: 16, padding: '10px 16px',
          background: 'rgba(232,64,64,0.1)', border: '1px solid rgba(232,64,64,0.4)',
          borderRadius: 8, color: '#e84040', fontSize: 13, maxWidth: 460,
          textAlign: 'left', lineHeight: 1.5,
        }}>
          <strong>Sign-in failed:</strong> {authError}<br/>
          <span style={{opacity:0.75}}>Try Demo Mode, or check that your Google account is approved.</span>
        </div>
      )}
      <p className="auth-notice">
  ⚠ <strong>Google Verification Notice:</strong> This app has not yet completed Google's verification process. 
  When signing in, you may see a warning screen — click <strong>"Advanced" → "Go to Meridian (unsafe)"</strong> to proceed. 
  Your data is only used to power meeting features and is never stored beyond your session. 
  If you prefer not to grant permissions, <strong>Demo Mode</strong> gives full access instantly with no login required.
</p>
    </div>
  );
}

/* ── Demo Banner ── */
function DemoBanner({ isDemo, onSignIn }) {
  if (!isDemo) return null;
  return (
    <div className="demo-banner">
      <div className="demo-banner-left">
        <span className="demo-badge">Demo Mode</span>
        <span className="demo-banner-text">Using demo data · AI processing is live (Vertex AI / Gemini)</span>
      </div>
      <button className="demo-banner-link" onClick={onSignIn}>
        <Icon.Google /> Sign in with Google →
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN APP
═══════════════════════════════════════════════════════════ */
export default function App() {
  const [appMode, setAppMode] = useState('landing');
  const [authChecked, setAuthChecked] = useState(false);
  const [authErrorMsg, setAuthErrorMsg] = useState('');  // FIX: show OAuth errors

  const [meetingMode, setMeetingMode] = useState('calendar');
  const [calEvents, setCalEvents] = useState(null);
  const [calLoading, setCalLoading] = useState(false);  // FIX: separate calendar loading state
  const [selectedEventId, setSelectedEventId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [brief, setBrief] = useState('');
  const [transcriptTab, setTranscriptTab] = useState('paste');
  const [transcript, setTranscript] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('');
  const [transcribed, setTranscribed] = useState('');
  const [postResult, setPostResult] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState('');
  const [apiError, setApiError] = useState('');
  const [debtData, setDebtData] = useState(null);
  const [debtError, setDebtError] = useState('');
  const [conflicts, setConflicts] = useState([]);
  const [conflictsLoaded, setConflictsLoaded] = useState(false);
  const [agendaStatus, setAgendaStatus] = useState('');
  const [actionItems, setActionItems] = useState([]);
  const [aiLoaded, setAiLoaded] = useState(false);
  const [aiError, setAiError] = useState('');

  const recorder = useRecorder();
  const summaryCopy = useCopy();
  const briefCopy = useCopy();

  const isDemo = appMode === 'demo';

  // ── Check auth on mount ────────────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('auth') === 'success') {
      window.history.replaceState({}, '', '/');
      setAppMode('auth');
      setAuthChecked(true);
      return;
    }
    if (params.get('auth_error')) {
      const errMsg = decodeURIComponent(params.get('auth_error') || 'Sign-in failed. Please try again.');
      window.history.replaceState({}, '', '/');
      // FIX: show error message on landing instead of silently staying put
      setAuthErrorMsg(errMsg);
      setAppMode('landing');
      setAuthChecked(true);
      return;
    }

    axios.get(`${API}/auth/status`)
      .then(r => {
        setAppMode(r.data.authenticated ? 'auth' : 'landing');
        setAuthChecked(true);
      })
      .catch(() => {
        setAppMode('landing');
        setAuthChecked(true);
      });
  }, []);

  // ── Load calendar events when mode is set ─────────────────────────────
  useEffect(() => {
    if (appMode === 'landing' || !authChecked) return;
    loadCalendarEvents(appMode);
  }, [appMode, authChecked]);

  async function loadCalendarEvents(mode) {
    // mode is passed explicitly to avoid stale closure on appMode
    const demoMode = (mode || appMode) === 'demo';
    setCalLoading(true);
    setCalEvents(null);
    try {
      const r = await axios.get(`${API}/events`);
      const data = r.data;
      if (Array.isArray(data) && data.length > 0) {
        setCalEvents(data);
        setSelectedEventId(data[0].id);
      } else {
        // FIX: Empty array from API — use hardcoded demo events for demo mode
        if (demoMode) {
          const fallback = buildDemoEvents();
          setCalEvents(fallback);
          setSelectedEventId(fallback[0].id);
        } else {
          setCalEvents([]);
        }
      }
    } catch (err) {
      // FIX: On any network/API error in demo mode, silently use hardcoded events.
      if (demoMode) {
        const fallback = buildDemoEvents();
        setCalEvents(fallback);
        setSelectedEventId(fallback[0].id);
      } else {
        setCalEvents([]);
      }
    } finally {
      setCalLoading(false);
    }
  }

  const effectiveTranscript = transcribed || transcript;
  const canProcess = effectiveTranscript.trim().length > 20;

  // ── Auth handlers ──────────────────────────────────────────────────────
  function startDemo() {
    resetAllState();
    // FIX: set appMode AFTER reset so useEffect fires with appMode==='demo' already set,
    // ensuring loadCalendarEvents uses the demo fallback path correctly.
    setAppMode('demo');
  }

  function resetAllState() {
    setBrief('');
    setPostResult(null);
    setSessionId('');
    setLogs([]);
    setTranscript('');
    setTranscribed('');
    setDebtData(null);
    setDebtError('');
    setConflicts([]);
    setConflictsLoaded(false);
    setAgendaStatus('');
    setActionItems([]);
    setAiLoaded(false);
    setAiError('');
    setApiError('');
  }

  function goToGoogleLogin() { window.location.href = `${API}/auth/login`; }

  function signOut() {
    axios.get(`${API}/auth/logout`).finally(() => {
      setAppMode('landing');
      resetAllState();
      setCalEvents(null);
      setSelectedEventId('');
    });
  }

  // ── Prepare meeting ────────────────────────────────────────────────────
  async function prepareMeeting() {
    setLoading('Preparing your meeting brief…');
    // FIX: Clear previous results before starting a new preparation
    setApiError('');
    setBrief('');
    setLogs([]);
    setPostResult(null);
    setSessionId('');

    const eventId = (meetingMode === 'calendar' && selectedEventId) ? selectedEventId : null;
    try {
      const res = await axios.post(`${API}/prepare`, { event_id: eventId, demo_mode: isDemo });
      const data = res.data;
      setSessionId(data.meeting_id || '');
      setBrief(data.brief || '');
      if (data.meeting_id) await pollLogs(data.meeting_id);
    } catch (e) {
      setApiError('Prepare failed: ' + (e.response?.data?.detail || e.message));
    }
    setLoading('');
  }

  // ── Process transcript ─────────────────────────────────────────────────
  async function processTranscript() {
    const t = effectiveTranscript.trim();
    if (!t) { alert('No transcript found. Use demo data or paste a transcript.'); return; }
    setLoading('Processing transcript through agents…');
    // FIX: Always clear previous results before a new run to avoid stale data
    setApiError('');
    setPostResult(null);
    setDebtData(null);
    setActionItems([]);
    setAiLoaded(false);

    let sid = sessionId;
    if (!sid) {
      try {
        const res = await axios.post(`${API}/prepare`, { event_id: null, demo_mode: isDemo });
        sid = res.data.meeting_id;
        setSessionId(sid);
      } catch { /* non-fatal */ }
    }
    try {
      const res = await axios.post(`${API}/process`, {
        meeting_id: sid || undefined,
        transcript: t,
        demo_mode: isDemo,
      });
      const data = res.data;
      if (data.meeting_id) setSessionId(data.meeting_id);
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

  // ── Recording ──────────────────────────────────────────────────────────
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
      alert('Transcription failed: ' + (e.response?.data?.detail || e.message));
    }
    setUploadProgress(0); setLoading('');
  }

  async function handleFileUpload(file) {
    if (!file) return;
    setUploadFile(file); setUploadStatus('Uploading and transcribing…'); setUploadProgress(0);
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
    setTranscript(DEMO_TRANSCRIPT); setTranscribed(''); setTranscriptTab('paste');
  }

  async function runFullDemo() {
    setTranscript(DEMO_TRANSCRIPT); setTranscribed(''); setTranscriptTab('paste');
    setTimeout(() => { processTranscriptWithText(DEMO_TRANSCRIPT); }, 100);
  }

  async function processTranscriptWithText(t) {
    setLoading('Processing demo transcript through agents…');
    // FIX: Clear previous results
    setApiError('');
    setPostResult(null);
    setDebtData(null);
    setActionItems([]);
    setAiLoaded(false);

    let sid = sessionId;
    if (!sid) {
      try {
        const res = await axios.post(`${API}/prepare`, { event_id: null, demo_mode: isDemo });
        sid = res.data.meeting_id; setSessionId(sid);
      } catch { /* non-fatal */ }
    }
    try {
      const res = await axios.post(`${API}/process`, { meeting_id: sid || undefined, transcript: t, demo_mode: isDemo });
      const data = res.data;
      if (data.meeting_id) setSessionId(data.meeting_id);
      setPostResult(data);
      await pollLogs(data.meeting_id || sid);
    } catch (e) {
      setApiError('Process failed: ' + (e.response?.data?.detail || e.message));
    }
    setLoading('');
  }

  // ── Tool panel handlers — scoped to current session ───────────────────
  async function loadDebt() {
    setDebtError('');
    setDebtData(null);
    // FIX: don't query Firestore at all if no session has been processed yet —
    // a brand-new device with no session would otherwise show other users' old data
    // (before the user_id fix was deployed) or just confusing empty/stale results.
    if (!sessionId) {
      setDebtData({ open: 0, overdue: 0, overdue_items: [], open_items: [], _no_session: true });
      return;
    }
    try {
      const r = await axios.get(`${API}/debt`);
      setDebtData(r.data);
    } catch (e) {
      setDebtError('Failed to load: ' + (e.response?.data?.detail || e.message));
    }
  }

  async function loadConflicts() {
    setConflicts([]);
    setConflictsLoaded(false);
    try {
      // FIX: backend now scopes by user_id from cookie automatically
      const r = await axios.get(`${API}/conflicts`);
      setConflicts(Array.isArray(r.data) ? r.data : []);
      setConflictsLoaded(true);
    } catch {
      setConflicts([]);
      setConflictsLoaded(true);
    }
  }

  async function approveConflict(id) {
    try {
      const r = await axios.post(`${API}/conflicts/${id}/approve`);
      alert(r.data.demo_mode
        ? 'Demo: reschedule approved (no real calendar change)'
        : `Rescheduled to: ${(r.data.new_time || '').substring(0, 16)}`);
      loadConflicts();
    } catch (e) { alert('Error: ' + (e.response?.data?.detail || e.message)); }
  }

  async function markItemDone(id) {
    try {
      await axios.post(`${API}/action-items/${id}/done`);
      // FIX: Refresh both debt and action items after marking done
      loadDebt();
      loadAllItems();
    } catch { /* non-fatal */ }
  }

  async function finalizeAgenda() {
    if (!sessionId) { alert('Prepare a meeting first.'); return; }
    setAgendaStatus('Synthesizing agenda…');
    try {
      const r = await axios.post(`${API}/agenda/finalize/${sessionId}`);
      setAgendaStatus(r.data.demo_mode
        ? 'Demo agenda generated. (In production, replies from attendees would be used.)'
        : `Done — ${r.data.replies_found} replies used. Calendar updated: ${r.data.calendar_patched}`);
    } catch (e) { setAgendaStatus('Error: ' + (e.response?.data?.detail || e.message)); }
  }

  async function loadAllItems() {
    setAiError('');
    setActionItems([]);
    setAiLoaded(false);
    // FIX: require an active session — a brand-new device with no session
    // would otherwise hit Firestore and potentially show stale cross-user data
    if (!sessionId) {
      setAiLoaded(true);
      return;
    }
    try {
      // Always scope by current meeting_id + user_id from cookie (backend enforces)
      const r = await axios.get(`${API}/action-items?meeting_id=${sessionId}`);
      setActionItems(Array.isArray(r.data) ? r.data : []);
      setAiLoaded(true);
    } catch (e) {
      setAiError('Failed: ' + (e.response?.data?.detail || e.message));
      setAiLoaded(true);
    }
  }

  function buildExportText() {
    if (!postResult) return '';
    const lines = [];
    if (postResult.summary) lines.push('# Summary\n\n' + postResult.summary);
    if (postResult.decisions?.length) lines.push('\n## Key Decisions\n\n' + postResult.decisions.map(d => '- ' + d).join('\n'));
    if (postResult.action_items?.length) lines.push('\n## Action Items\n\n' + postResult.action_items.map(a => `- [${a.owner}] ${a.task}  (${a.due_date || 'TBD'}, ${a.priority || 'medium'})`).join('\n'));
    return lines.join('\n');
  }

  // ── Render: loading ────────────────────────────────────────────────────
  if (!authChecked) {
    return (
      <>
        <style>{css}</style>
        <div className="landing">
          <div style={{ color: 'var(--text3)', fontFamily: 'var(--mono)', fontSize: 13 }}>Loading…</div>
        </div>
      </>
    );
  }

  if (appMode === 'landing') {
    return (
      <>
        <style>{css}</style>
        <LandingPage onDemo={startDemo} onGoogleLogin={goToGoogleLogin} authError={authErrorMsg} />
      </>
    );
  }

  // ── Render: main app ───────────────────────────────────────────────────
  return (
    <>
      <style>{css}</style>
      <div className="app">

        <DemoBanner isDemo={isDemo} onSignIn={goToGoogleLogin} />

        <header className="header">
          <div className="header-eyebrow" style={{ justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ display: 'block', width: 22, height: 1, background: 'var(--accent)' }} />
              Meeting Intelligence
            </span>
            {!isDemo && (
              <button className="btn btn-sm" onClick={signOut} style={{ fontSize: 12 }}>
                <Icon.LogOut /> Sign out
              </button>
            )}
          </div>
          <h1 className="header-title">Meri<span>dian</span></h1>
          <p className="header-sub">
            {isDemo
              ? 'Demo Mode — AI features fully live · Google integrations use demo data'
              : 'Capture · Analyse · Act on every meeting'}
          </p>
        </header>

        {/* ── STEP 1 ── */}
        <div className="section-eyebrow">Step 1 — Select your meeting</div>
        <div className="meeting-grid">
          <div className={`meeting-option ${meetingMode === 'calendar' ? 'selected' : ''}`} onClick={() => setMeetingMode('calendar')}>
            <span className="mo-icon"><Icon.Calendar /></span>
            <div className="mo-title">Select from Calendar</div>
            <div className="mo-desc">{isDemo ? 'Choose from demo events below' : 'Pick from your Google Calendar'}</div>
          </div>
          <div className={`meeting-option ${meetingMode === 'auto' ? 'selected' : ''}`} onClick={() => { setMeetingMode('auto'); setSelectedEventId(''); }}>
            <span className="mo-icon"><Icon.Zap /></span>
            <div className="mo-title">Quick Session</div>
            <div className="mo-desc">Skip calendar — jump straight to transcript processing</div>
          </div>
        </div>

        {meetingMode === 'calendar' && (
          <div className="cal-select-wrap">
            {/* FIX: Show loading spinner while fetching, not a scary error */}
            {calLoading && <div className="info-msg">Loading events…</div>}
            {!calLoading && Array.isArray(calEvents) && calEvents.length > 0 && (
              <>
                <select className="cal-select" value={selectedEventId} onChange={e => setSelectedEventId(e.target.value)}>
                  {calEvents.map(ev => (
                    <option key={ev.id} value={ev.id}>{ev.label || `${ev.title}  ·  ${ev.start || ''}`}</option>
                  ))}
                </select>
                {isDemo && (
                  <div className="demo-events-note">
                    <Icon.Info /> Demo events — showing 5 representative meetings
                  </div>
                )}
              </>
            )}
            {/* FIX: If no events loaded (empty array), show helpful guidance instead of error */}
            {!calLoading && Array.isArray(calEvents) && calEvents.length === 0 && (
              <div className="info-msg" style={{ marginTop: 10 }}>
                No upcoming events found. Use <strong>Quick Session</strong> above to proceed without a calendar event.
              </div>
            )}
          </div>
        )}

        {meetingMode === 'calendar' && (
          <button
            className="primary-btn"
            style={{ marginTop: 18 }}
            onClick={prepareMeeting}
            disabled={!!loading || calLoading || (meetingMode === 'calendar' && (!Array.isArray(calEvents) || calEvents.length === 0))}
          >
            {loading && loading.includes('brief') ? <><div className="spinner" />{loading}</> : <><Icon.FileText /> Generate Pre-Meeting Brief</>}
          </button>
        )}

        {sessionId && (
          <div className="session-pill"><div className="session-dot" />Session active · {sessionId}</div>
        )}

        {apiError && <div className="error-bar"><Icon.AlertTriangle /><span>{apiError}</span></div>}
        {loading && !loading.includes('brief') && !loading.includes('Transcribing') && (
          <div className="loading-bar"><div className="spinner" />{loading}</div>
        )}

        <AgentLogs logs={logs} />

        {brief && (
          <div className="result-card blue-border">
            <div className="rh">
              <div className="rh-left">
                <span className="rt">Pre-Meeting Brief</span>
                <span className={`rtag ${isDemo ? 'rtag-teal' : 'rtag-blue'}`}>{isDemo ? 'Demo' : 'Generated'}</span>
              </div>
              <div className="rh-actions">
                <button className={`btn-copy ${briefCopy.copied ? 'copied' : ''}`} onClick={() => briefCopy.copy(brief)}>
                  {briefCopy.copied ? <Icon.Check /> : <Icon.Copy />}{briefCopy.copied ? 'Copied' : 'Copy'}
                </button>
                <button className="btn-pdf" onClick={() => exportPDF(brief, 'Pre-Meeting Brief')}><Icon.Download /> PDF</button>
              </div>
            </div>
            <div className="rb"><div className="md"><ReactMarkdown>{brief}</ReactMarkdown></div></div>
          </div>
        )}

        <div className="divider" />

        {/* ── STEP 2 ── */}
        <div className="section-eyebrow">Step 2 — Capture meeting transcript</div>

        <div className="transcript-tabs">
          {[
            { id: 'record', icon: <Icon.Mic />, label: 'Record Meeting' },
            { id: 'upload', icon: <Icon.Upload />, label: 'Upload Audio' },
            { id: 'paste', icon: <Icon.FileText />, label: 'Paste Text' },
          ].map(t => (
            <button key={t.id} className={`tab-btn ${transcriptTab === t.id ? 'active' : ''}`} onClick={() => setTranscriptTab(t.id)}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {transcriptTab === 'record' && (
          <div className="record-panel">
            <button className={`record-btn ${recorder.recording ? 'recording' : ''}`} onClick={recorder.recording ? recorder.stop : recorder.start}>
              {recorder.recording ? <Icon.MicOff /> : <Icon.Mic />}
            </button>
            <div className="record-label">
              {recorder.recording ? 'Recording — click to stop' : recorder.audioBlob ? 'Recording ready' : 'Click to start recording'}
            </div>
            <div className="record-timer">{recorder.fmt(recorder.seconds)}</div>
            <div className="record-hint">Records audio from your microphone and transcribes via Google Speech API</div>
            {recorder.audioBlob && !recorder.recording && (
              <div style={{ marginTop: 18, display: 'flex', gap: 12, justifyContent: 'center' }}>
                <button className="btn btn-danger btn-sm" onClick={recorder.reset}><Icon.Trash2 /> Discard</button>
                <button className="btn btn-green" onClick={submitRecording}>
                  {loading && loading.includes('Transcribing') ? <><div className="spinner" /> Transcribing…</> : <><Icon.Zap /> Transcribe</>}
                </button>
              </div>
            )}
          </div>
        )}

        {transcriptTab === 'upload' && (
          !uploadFile || uploadStatus.includes('Failed') ? (
            <div className="upload-zone" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); handleFileUpload(e.dataTransfer.files[0]); }}>
              <input type="file" accept=".mp3,.wav,.mp4,.webm,.ogg,.m4a,.flac" onChange={e => handleFileUpload(e.target.files[0])} />
              <div className="upload-icon"><Icon.Upload /></div>
              <div className="upload-title">Drop audio or video file here</div>
              <div className="upload-sub">MP3 · WAV · MP4 · WEBM · OGG · M4A · FLAC · Max 50 MB</div>
            </div>
          ) : (
            <div className="upload-progress">
              <div className="progress-file">
                <Icon.FileText />
                <span className="progress-name">{uploadFile.name}</span>
                <span style={{ fontSize: 13, color: 'var(--text3)' }}>{(uploadFile.size / 1024 / 1024).toFixed(1)} MB</span>
              </div>
              <div className="progress-bar-wrap"><div className="progress-bar" style={{ width: `${uploadProgress}%` }} /></div>
              <div className="progress-status">{uploadStatus}{uploadProgress > 0 && uploadProgress < 100 ? ` ${uploadProgress}%` : ''}</div>
              {uploadStatus === 'Transcription complete' && (
                <button className="btn btn-sm" style={{ marginTop: 12 }} onClick={() => { setUploadFile(null); setUploadStatus(''); setUploadProgress(0); }}>Upload another file</button>
              )}
            </div>
          )
        )}

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
          {isDemo && (
            <button className="demo-btn teal" onClick={runFullDemo}>
              <Icon.Play /> Run full demo (auto-process)
            </button>
          )}
          <button className="demo-btn" onClick={loadDemo}>
            <Icon.Zap /> Load demo transcript
          </button>
        </div>

        {transcribed && (
          <div className="transcript-preview">
            <div className="preview-header">
              <span className="preview-label">Transcribed</span>
              <button className="btn btn-sm" onClick={() => setTranscribed('')}><Icon.Trash2 /> Clear</button>
            </div>
            <div className="preview-text">{transcribed.substring(0, 600)}{transcribed.length > 600 ? '…' : ''}</div>
          </div>
        )}

        <button className="primary-btn" onClick={processTranscript} disabled={!!loading || !canProcess} style={{ marginTop: 22 }}>
          {loading && loading.includes('Processing') ? <><div className="spinner" />{loading}</> : <><Icon.Zap /> Process Meeting</>}
        </button>

        {/* ── RESULTS ── */}
        {postResult && (
          <>
            <div className="divider" />
            <div className="section-eyebrow">Meeting results {postResult.demo_mode && <span style={{ color: 'var(--teal)', marginLeft: 8 }}>· Demo</span>}</div>

            {/* FIX: Stats now read directly from this specific run's postResult — no stale data */}
            <div className="stats-row">
              <div className="stat"><div className="sn">{postResult.action_items?.length ?? 0}</div><div className="sl">Action Items</div></div>
              <div className="stat"><div className="sn">{postResult.emails_sent ?? 0}</div><div className="sl">Emails Sent</div></div>
              <div className="stat"><div className="sn">{postResult.decisions?.length ?? 0}</div><div className="sl">Decisions</div></div>
            </div>

            {postResult.summary && (
              <div style={{ position: 'relative', marginBottom: 18 }}>
                <div className="summary-block">{postResult.summary}</div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button className={`btn-copy ${summaryCopy.copied ? 'copied' : ''}`} onClick={() => summaryCopy.copy(postResult.summary)}>
                    {summaryCopy.copied ? <Icon.Check /> : <Icon.Copy />}{summaryCopy.copied ? 'Copied' : 'Copy Summary'}
                  </button>
                  <button className="btn-pdf" onClick={() => exportPDF(buildExportText(), 'Meeting Summary')}><Icon.Download /> Export PDF</button>
                </div>
              </div>
            )}

            {postResult.decisions?.length > 0 && (
              <div className="result-card">
                <div className="rh"><div className="rh-left"><span className="rt">Key Decisions</span></div></div>
                <div className="rb">
                  <ul className="decisions-list">{postResult.decisions.map((d, i) => <li key={i} className="di">{d}</li>)}</ul>
                </div>
              </div>
            )}

            {postResult.action_items?.length > 0 && (
              <div className="result-card green-border">
                <div className="rh">
                  <div className="rh-left">
                    <span className="rt">Action Items</span>
                    <span className="rtag rtag-green">{postResult.action_items.length}</span>
                  </div>
                </div>
                <div className="rb">
                  {postResult.action_items.map((a, i) => <ActionItemRow key={i} item={a} />)}
                </div>
              </div>
            )}

            {postResult.roi_result && typeof postResult.roi_result.score === 'number' && (
              <div className="result-card">
                <div className="rh">
                  <div className="rh-left">
                    <span className="rt">Meeting ROI</span>
                    <span className={`rtag rtag-${postResult.roi_result.verdict === 'high' ? 'green' : postResult.roi_result.verdict === 'low' ? 'red' : 'blue'}`}>
                      {postResult.roi_result.verdict || 'medium'}
                    </span>
                  </div>
                </div>
                <div className="rb">
                  <div className="roi-row">
                    <RoiRing score={postResult.roi_result.score} verdict={postResult.roi_result.verdict} />
                    <div>
                      <div className="roi-rec">{postResult.roi_result.recommendation}</div>
                      <div className="roi-cost">₹{(postResult.roi_result.cost_inr || 0).toLocaleString('en-IN')} · {postResult.roi_result.person_hours}h · {postResult.roi_result.num_attendees} attendees</div>
                    </div>
                  </div>
                  <div className="stats-row">
                    <div className="stat"><div className="sn">{postResult.roi_result.action_items_produced ?? 0}</div><div className="sl">Actions out</div></div>
                    <div className="stat"><div className="sn">{postResult.roi_result.decisions_made ?? 0}</div><div className="sl">Decisions</div></div>
                    <div className="stat"><div className="sn">{postResult.roi_result.agenda_completion_pct ?? 0}%</div><div className="sl">Agenda done</div></div>
                  </div>
                </div>
              </div>
            )}

            {postResult.conflict_result?.conflicts_found > 0 && (
              <div className="result-card amber-border">
                <div className="rh">
                  <div className="rh-left">
                    <span className="rt">{postResult.conflict_result.conflicts_found} Calendar Conflict{postResult.conflict_result.conflicts_found !== 1 ? 's' : ''}</span>
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
                      {p.proposed_slot && <div className="conflict-slot">Proposed: {p.proposed_slot.substring(0, 16)}</div>}
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

            {postResult.debt_result && typeof postResult.debt_result.open === 'number' && (
              <div className="result-card">
                <div className="rh">
                  <div className="rh-left">
                    <span className="rt">Team Meeting Debt</span>
                    {postResult.debt_result.overdue > 0 && <span className="rtag rtag-red">{postResult.debt_result.overdue} overdue</span>}
                  </div>
                </div>
                <div className="rb">
                  <div className="stats-row">
                    <div className="stat"><div className="sn">{postResult.debt_result.open}</div><div className="sl">Open</div></div>
                    <div className="stat"><div className="sn" style={{ color: postResult.debt_result.overdue > 0 ? 'var(--red)' : 'var(--green)' }}>{postResult.debt_result.overdue}</div><div className="sl">Overdue</div></div>
                    <div className="stat"><div className="sn">{postResult.debt_result.escalated ?? 0}</div><div className="sl">Escalated</div></div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── TOOLS ── */}
        <div className="bottom-wrap">
          <div className="section-eyebrow">Tools & History</div>
          {/* FIX: Only show tool buttons when a session exists.
              A brand-new device sees a prompt to process a meeting first,
              preventing them from accidentally querying stale cross-user data. */}
          {!sessionId && (
            <div className="info-msg" style={{ marginBottom: 18 }}>
              Process a meeting above to unlock Debt Summary, Action Items, and Conflict tools.
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 22 }}>
            <button className="btn" onClick={loadDebt} disabled={!sessionId}><Icon.List /> Debt Summary</button>
            <button className="btn" onClick={loadAllItems} disabled={!sessionId}><Icon.ClipboardList /> All Action Items</button>
            <button className="btn" onClick={loadConflicts} disabled={!sessionId}><Icon.AlertTriangle /> Conflict Proposals</button>
            {sessionId && <button className="btn" onClick={finalizeAgenda}><Icon.RefreshCw /> Finalize Agenda</button>}
          </div>

          {agendaStatus && <div className="loading-bar" style={{ marginBottom: 18 }}>{agendaStatus}</div>}
          {debtError && <div className="error-bar"><Icon.AlertTriangle /><span>{debtError}</span></div>}

          {debtData && typeof debtData.open === 'number' && !debtData._no_session && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
                <div className="mini-card"><div className="mc-num">{debtData.open}</div><div className="mc-label">Open Items</div></div>
                <div className="mini-card"><div className={`mc-num ${debtData.overdue > 0 ? 'red' : ''}`}>{debtData.overdue}</div><div className="mc-label">Overdue</div></div>
              </div>
              {debtData.overdue_items?.length > 0 && (
                <>{debtData.overdue_items.map((a, i) => <ActionItemRow key={i} item={a} onDone={markItemDone} />)}</>
              )}
              {debtData.overdue_items?.length === 0 && debtData.open === 0 && (
                <div className="info-msg">No open action items. Great work! 🎉</div>
              )}
            </>
          )}

          {aiError && <div className="error-bar"><Icon.AlertTriangle /><span>{aiError}</span></div>}
          {aiLoaded && actionItems.length > 0 && (
            <>
              <div className="slabel" style={{ marginTop: 18 }}>All Open Items ({actionItems.length})</div>
              {actionItems.map((a, i) => <ActionItemRow key={i} item={a} onDone={markItemDone} />)}
            </>
          )}
          {aiLoaded && actionItems.length === 0 && !aiError && (
            <div className="info-msg" style={{ marginTop: 12 }}>No open action items found.</div>
          )}

          {conflictsLoaded && conflicts.length > 0 && (
            <>
              <div className="slabel" style={{ marginTop: 18 }}>Pending Reschedule Proposals ({conflicts.length})</div>
              {conflicts.map((c, i) => (
                <div key={i} className="conflict-item">
                  <div className="conflict-meta">
                    <span className="conflict-type">{c.conflict?.type}</span>
                    <span className="conflict-title">{c.conflict?.event_title}</span>
                  </div>
                  {c.proposed_slot && <div className="conflict-slot">→ {c.proposed_slot?.substring(0, 16)}</div>}
                  <div className="conflict-note">{c.note}</div>
                  <button className="btn btn-green btn-sm" onClick={() => approveConflict(c.id)}><Icon.CheckCircle /> Approve</button>
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