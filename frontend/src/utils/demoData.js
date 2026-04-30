// utils/demoData.js

export function buildDemoEvents() {
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

export const DEMO_TRANSCRIPT = `Alice: Alright, let's get started. Main item — the login bug in production. Users on mobile can't sign in with Google OAuth.

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

export function exportPDF(content, title = 'Meeting Summary') {
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