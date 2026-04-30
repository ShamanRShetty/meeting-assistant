// components/ToolsPanel.js
import { ListIcon, ClipboardIcon, AlertIcon, RefreshIcon, CheckCircleIcon } from './Icons';
import ActionItems from './ActionItems';

export default function ToolsPanel({
  toolsUnlocked,
  sessionId,
  debtData, debtError,
  actionItems, aiLoaded, aiError,
  conflicts, conflictsLoaded,
  agendaStatus,
  onLoadDebt,
  onLoadItems,
  onLoadConflicts,
  onFinalizeAgenda,
  onMarkDone,
  onApproveConflict,
}) {
  return (
    <div>
      <div className="tools-bar">
        <button className="btn" onClick={onLoadDebt} disabled={!toolsUnlocked}>
          <ListIcon /> Debt Summary
        </button>
        <button className="btn" onClick={onLoadItems} disabled={!toolsUnlocked}>
          <ClipboardIcon /> All Action Items
        </button>
        <button className="btn" onClick={onLoadConflicts} disabled={!toolsUnlocked}>
          <AlertIcon /> Conflicts
        </button>
        {toolsUnlocked && (
          <button className="btn" onClick={onFinalizeAgenda}>
            <RefreshIcon /> Finalize Agenda
          </button>
        )}
      </div>

      {!toolsUnlocked && (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          Process a meeting above to unlock tools
        </div>
      )}

      {agendaStatus && (
        <div className="loading-bar">{agendaStatus}</div>
      )}

      {debtError && (
        <div className="error-bar"><AlertIcon /> {debtError}</div>
      )}

      {debtData && typeof debtData.open === 'number' && !debtData._no_session && (
        <div style={{ marginBottom: 'var(--sp-4)' }}>
          <div className="mini-stats">
            <div className="mini-stat">
              <div className="mini-stat-num">{debtData.open}</div>
              <div className="mini-stat-label">Open Items</div>
            </div>
            <div className="mini-stat">
              <div className={`mini-stat-num ${debtData.overdue > 0 ? 'danger' : ''}`}>
                {debtData.overdue}
              </div>
              <div className="mini-stat-label">Overdue</div>
            </div>
          </div>

          {debtData.open === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon"><CheckCircleIcon /></div>
              No open action items
            </div>
          )}

          {debtData.overdue_items?.length > 0 && (
            <ActionItems items={debtData.overdue_items} onDone={onMarkDone} />
          )}
        </div>
      )}

      {aiError && <div className="error-bar"><AlertIcon /> {aiError}</div>}

      {(aiLoaded) && actionItems.length > 0 && (
        <div style={{ marginBottom: 'var(--sp-4)' }}>
          <div className="section-label">All Open Items ({actionItems.length})</div>
          <ActionItems items={actionItems} onDone={onMarkDone} />
        </div>
      )}

      {aiLoaded && actionItems.length === 0 && !aiError && (
        <div className="empty-state">
          <div className="empty-state-icon"><CheckCircleIcon /></div>
          No open action items found
        </div>
      )}

      {conflictsLoaded && conflicts.length > 0 && (
        <div>
          <div className="section-label">Pending Reschedule Proposals ({conflicts.length})</div>
          {conflicts.map((c, i) => (
            <div key={i} className="conflict-card">
              <div className="conflict-header">
                <span className="badge badge-amber">{c.conflict?.type}</span>
                <span className="conflict-title">{c.conflict?.event_title}</span>
              </div>
              {c.proposed_slot && (
                <div className="conflict-slot">→ {c.proposed_slot?.substring(0, 16)}</div>
              )}
              <div className="conflict-note">{c.note}</div>
              <button className="btn" style={{ color: 'var(--green)', borderColor: 'rgba(34,197,94,0.25)' }} onClick={() => onApproveConflict(c.id)}>
                <CheckCircleIcon /> Approve
              </button>
            </div>
          ))}
        </div>
      )}

      {conflictsLoaded && conflicts.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon"><CheckCircleIcon /></div>
          No pending conflict proposals
        </div>
      )}
    </div>
  );
}