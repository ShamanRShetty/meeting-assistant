// components/LogsPanel.js
import { useState, useRef, useEffect } from 'react';
import { CpuIcon, ChevronDownIcon } from './Icons';

export default function LogsPanel({ logs }) {
  const [open, setOpen] = useState(false);
  const entriesRef = useRef(null);

  useEffect(() => {
    if (open && entriesRef.current) {
      entriesRef.current.scrollTop = entriesRef.current.scrollHeight;
    }
  }, [logs, open]);

  if (!logs.length) return null;

  return (
    <div style={{ margin: 'var(--sp-3) 0' }}>
      <button
        className="logs-toggle"
        onClick={() => setOpen(o => !o)}
        style={{ borderRadius: open ? 'var(--r-md) var(--r-md) 0 0' : 'var(--r-md)', borderBottom: open ? 'none' : undefined }}
      >
        <div className="logs-active-dot" />
        <CpuIcon />
        <span>Agent Activity ({logs.length} events)</span>
        <span className={`logs-chevron ${open ? 'open' : ''}`}><ChevronDownIcon /></span>
      </button>

      {open && (
        <div className="logs-panel">
          <div className="logs-entries" ref={entriesRef}>
            {logs.map((l, i) => (
              <div key={i} className="log-row">
                <span className="log-agent">[{l.agent}]</span>
                <span className="log-time">{(l.timestamp || '').substring(11, 19)}</span>
                <span className="log-msg">{l.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}