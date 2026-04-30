// components/ResultsPanel.js
import { useCopy } from '../hooks';
import ActionItems from './ActionItems';
import RoiPanel from './RoiPanel';
import { CopyIcon, CheckIcon, DownloadIcon } from './Icons';
import { exportPDF } from '../utils/demoData';
import ReactMarkdown from 'react-markdown';

function CopyButton({ text, label = 'Copy' }) {
  const { copied, copy } = useCopy();
  return (
    <button className={`btn-copy ${copied ? 'copied' : ''}`} onClick={() => copy(text)}>
      {copied ? <CheckIcon /> : <CopyIcon />}
      {copied ? 'Copied' : label}
    </button>
  );
}

export default function ResultsPanel({ result, onMarkDone }) {
  if (!result) return null;

  const exportText = [
    result.summary && `# Summary\n\n${result.summary}`,
    result.decisions?.length && `\n## Key Decisions\n\n${result.decisions.map(d => `- ${d}`).join('\n')}`,
    result.action_items?.length && `\n## Action Items\n\n${result.action_items.map(a => `- [${a.owner}] ${a.task}  (${a.due_date || 'TBD'}, ${a.priority || 'medium'})`).join('\n')}`,
  ].filter(Boolean).join('\n');

  return (
    <div>
      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: 'var(--sp-4)' }}>
        <div className="stat-card">
          <div className="stat-number">{result.action_items?.length ?? 0}</div>
          <div className="stat-label">Action Items</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{result.emails_sent ?? 0}</div>
          <div className="stat-label">Emails Sent</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{result.decisions?.length ?? 0}</div>
          <div className="stat-label">Decisions</div>
        </div>
      </div>

      {/* Summary */}
      {result.summary && (
        <div style={{ marginBottom: 'var(--sp-3)' }}>
          <div className="summary-block md"><ReactMarkdown>{result.summary}</ReactMarkdown></div>
          <div style={{ display: 'flex', gap: 'var(--sp-2)', justifyContent: 'flex-end' }}>
            <CopyButton text={result.summary} label="Copy Summary" />
            <button className="btn-copy" onClick={() => exportPDF(exportText, 'Meeting Summary')}>
              <DownloadIcon /> Export PDF
            </button>
          </div>
        </div>
      )}

      {/* Decisions */}
      {result.decisions?.length > 0 && (
        <div className="card">
          <div className="card-head">
            <div className="card-head-left">
              <span className="card-title">Key Decisions</span>
              <span className="badge badge-muted">{result.decisions.length}</span>
            </div>
          </div>
          <div className="card-body-sm">
            <ul className="decisions-list">
              {result.decisions.map((d, i) => (
                <li key={i} className="decision-item">
                  <span className="decision-bullet">—</span>
                  {d}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Action Items */}
      {result.action_items?.length > 0 && (
        <div className="card" style={{ borderColor: 'rgba(34,197,94,0.15)' }}>
          <div className="card-head">
            <div className="card-head-left">
              <span className="card-title">Action Items</span>
              <span className="badge badge-green">{result.action_items.length}</span>
            </div>
          </div>
          <div className="card-body">
            <ActionItems items={result.action_items} onDone={onMarkDone} />
          </div>
        </div>
      )}

      {/* ROI */}
      <RoiPanel roi={result.roi_result} />

      {/* Debt */}
      {result.debt_result && typeof result.debt_result.open === 'number' && (
        <div className="card">
          <div className="card-head">
            <div className="card-head-left">
              <span className="card-title">Meeting Debt</span>
              {result.debt_result.overdue > 0 && (
                <span className="badge badge-red">{result.debt_result.overdue} overdue</span>
              )}
            </div>
          </div>
          <div className="card-body">
            <div className="mini-stats">
              <div className="mini-stat">
                <div className="mini-stat-num">{result.debt_result.open}</div>
                <div className="mini-stat-label">Open</div>
              </div>
              <div className="mini-stat">
                <div className={`mini-stat-num ${result.debt_result.overdue > 0 ? 'danger' : ''}`}>
                  {result.debt_result.overdue}
                </div>
                <div className="mini-stat-label">Overdue</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}