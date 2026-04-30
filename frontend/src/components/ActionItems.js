// components/ActionItems.js
import { CheckIcon } from './Icons';

function PriorityBadge({ priority }) {
  const p = (priority || 'medium').toLowerCase();
  const cls = p === 'high' ? 'priority-high' : p === 'low' ? 'priority-low' : 'priority-medium';
  return <span className={`priority-badge ${cls}`}>{p}</span>;
}

function TaskRow({ item, onDone }) {
  return (
    <div className="task-row">
      {onDone && item.id ? (
        <button
          className="task-checkbox"
          onClick={() => onDone(item.id)}
          title="Mark as done"
          aria-label={`Mark "${item.task}" as done`}
        >
          <CheckIcon />
        </button>
      ) : (
        <div className="task-checkbox" style={{ cursor: 'default' }} />
      )}

      <div className="task-main">
        <div className="task-text">{item.task || '—'}</div>
        <div className="task-meta">
          <span className="task-owner">{item.owner || 'Unknown'}</span>
          {item.due_date && item.due_date !== 'TBD' && (
            <span className="task-due">{item.due_date}</span>
          )}
          {(!item.due_date || item.due_date === 'TBD') && (
            <span className="task-due">No due date</span>
          )}
        </div>
      </div>

      <PriorityBadge priority={item.priority} />
    </div>
  );
}

export default function ActionItems({ items, onDone, title = 'Action Items', count }) {
  if (!items || items.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
            <rect x="8" y="2" width="8" height="4" rx="1"/>
          </svg>
        </div>
        No action items
      </div>
    );
  }

  return (
    <div className="task-list">
      {items.map((item, i) => (
        <TaskRow key={item.id || i} item={item} onDone={onDone} />
      ))}
    </div>
  );
}

export { TaskRow, PriorityBadge };