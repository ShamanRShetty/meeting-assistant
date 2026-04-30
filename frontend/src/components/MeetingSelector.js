// components/MeetingSelector.js
import { CalendarIcon, ZapIcon, InfoIcon } from './Icons';

export default function MeetingSelector({
  meetingMode, setMeetingMode,
  calEvents, calLoading,
  selectedEventId, setSelectedEventId,
  isDemo,
}) {
  return (
    <div>
      <div className="meeting-modes">
        <button
          className={`mode-card ${meetingMode === 'calendar' ? 'selected' : ''}`}
          onClick={() => setMeetingMode('calendar')}
        >
          <div className="mode-card-icon"><CalendarIcon /></div>
          <div className="mode-card-title">Select from Calendar</div>
          <div className="mode-card-desc">
            {isDemo ? 'Choose from demo events' : 'Pick from your Google Calendar'}
          </div>
        </button>

        <button
          className={`mode-card ${meetingMode === 'auto' ? 'selected' : ''}`}
          onClick={() => { setMeetingMode('auto'); setSelectedEventId(''); }}
        >
          <div className="mode-card-icon"><ZapIcon /></div>
          <div className="mode-card-title">Quick Session</div>
          <div className="mode-card-desc">Skip calendar — go straight to transcript</div>
        </button>
      </div>

      {meetingMode === 'calendar' && (
        <div className="cal-select-wrap">
          {calLoading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', color: 'var(--text-3)', fontSize: 13 }}>
              <div className="spinner" /> Loading events…
            </div>
          )}

          {!calLoading && Array.isArray(calEvents) && calEvents.length > 0 && (
            <>
              <select
                className="cal-select"
                value={selectedEventId}
                onChange={e => setSelectedEventId(e.target.value)}
              >
                {calEvents.map(ev => (
                  <option key={ev.id} value={ev.id}>
                    {ev.label || `${ev.title}  ·  ${ev.start || ''}`}
                  </option>
                ))}
              </select>
              {isDemo && (
                <div className="demo-events-hint">
                  <InfoIcon /> Demo events — 5 representative meetings
                </div>
              )}
            </>
          )}

          {!calLoading && Array.isArray(calEvents) && calEvents.length === 0 && (
            <div className="empty-state" style={{ padding: '12px 0', textAlign: 'left' }}>
              No upcoming events. Use <strong>Quick Session</strong> to proceed without a calendar event.
            </div>
          )}
        </div>
      )}
    </div>
  );
}