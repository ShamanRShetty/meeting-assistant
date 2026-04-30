// components/RoiPanel.js

function RoiRing({ score, verdict }) {
  const r = 34;
  const circ = 2 * Math.PI * r;
  const s = typeof score === 'number' ? score : 0;
  const offset = circ - (s / 100) * circ;
  const color = verdict === 'high' ? 'var(--green)' : verdict === 'low' ? 'var(--red)' : 'var(--accent)';

  return (
    <div className="roi-ring">
      <svg width="80" height="80" viewBox="0 0 80 80">
        <circle className="roi-ring-bg" cx="40" cy="40" r={r} />
        <circle
          className="roi-ring-fill"
          cx="40" cy="40" r={r}
          stroke={color}
          strokeDasharray={circ}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="roi-ring-num">{s}</div>
    </div>
  );
}

export default function RoiPanel({ roi }) {
  if (!roi || typeof roi.score !== 'number') return null;

  const verdictBadge = roi.verdict === 'high' ? 'badge-green' : roi.verdict === 'low' ? 'badge-red' : 'badge-blue';

  return (
    <div className="card">
      <div className="card-head">
        <div className="card-head-left">
          <span className="card-title">Meeting ROI</span>
          <span className={`badge ${verdictBadge}`}>{roi.verdict || 'medium'}</span>
        </div>
      </div>
      <div className="card-body">
        <div className="roi-layout">
          <RoiRing score={roi.score} verdict={roi.verdict} />
          <div className="roi-info">
            <div className="roi-recommendation">{roi.recommendation}</div>
            <div className="roi-cost">
              ₹{(roi.cost_inr || 0).toLocaleString('en-IN')} · {roi.person_hours}h · {roi.num_attendees} attendees
            </div>
          </div>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-number">{roi.action_items_produced ?? 0}</div>
            <div className="stat-label">Actions</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{roi.decisions_made ?? 0}</div>
            <div className="stat-label">Decisions</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{roi.agenda_completion_pct ?? 0}%</div>
            <div className="stat-label">Agenda</div>
          </div>
        </div>
      </div>
    </div>
  );
}