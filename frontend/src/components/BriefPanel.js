// components/BriefPanel.js
import ReactMarkdown from 'react-markdown';
import { useCopy } from '../hooks';
import { CopyIcon, CheckIcon, DownloadIcon } from './Icons';
import { exportPDF } from '../utils/demoData';

export default function BriefPanel({ brief, isDemo }) {
  const { copied, copy } = useCopy();
  if (!brief) return null;

  return (
    <div className="card" style={{ borderColor: 'rgba(79,124,255,0.2)', marginTop: 'var(--sp-4)' }}>
      <div className="card-head">
        <div className="card-head-left">
          <span className="card-title">Pre-Meeting Brief</span>
          <span className={`badge ${isDemo ? 'badge-teal' : 'badge-blue'}`}>
            {isDemo ? 'Demo' : 'Generated'}
          </span>
        </div>
        <div className="card-head-actions">
          <button className={`btn-copy ${copied ? 'copied' : ''}`} onClick={() => copy(brief)}>
            {copied ? <CheckIcon /> : <CopyIcon />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button className="btn-copy" onClick={() => exportPDF(brief, 'Pre-Meeting Brief')}>
            <DownloadIcon /> PDF
          </button>
        </div>
      </div>
      <div className="card-body">
        <div className="md"><ReactMarkdown>{brief}</ReactMarkdown></div>
      </div>
    </div>
  );
}