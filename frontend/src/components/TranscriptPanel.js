// components/TranscriptPanel.js
import { useState } from 'react';
import { MicIcon, MicOffIcon, UploadIcon, FileTextIcon, ZapIcon, TrashIcon, PlayIcon } from './Icons';

export default function TranscriptPanel({
  transcriptTab, setTranscriptTab,
  transcript, setTranscript,
  transcribed, setTranscribed,
  recorder,
  uploadFile, uploadProgress, uploadStatus,
  onFileUpload,
  onSubmitRecording,
  onLoadDemo,
  onRunFullDemo,
  isDemo,
  loading,
}) {
  const [drag, setDrag] = useState(false);

  const tabs = [
    { id: 'record', icon: <MicIcon />, label: 'Record' },
    { id: 'upload', icon: <UploadIcon />, label: 'Upload' },
    { id: 'paste',  icon: <FileTextIcon />, label: 'Paste' },
  ];

  return (
    <div>
      <div className="tab-bar">
        {tabs.map(t => (
          <button
            key={t.id}
            className={`tab-btn ${transcriptTab === t.id ? 'active' : ''}`}
            onClick={() => setTranscriptTab(t.id)}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── Record ── */}
      {transcriptTab === 'record' && (
        <div className="record-panel">
          <button
            className={`record-btn ${recorder.recording ? 'recording' : ''}`}
            onClick={recorder.recording ? recorder.stop : recorder.start}
          >
            {recorder.recording ? <MicOffIcon /> : <MicIcon />}
          </button>
          <div className="record-label">
            {recorder.recording ? 'Recording — click to stop' : recorder.audioBlob ? 'Recording ready' : 'Click to start recording'}
          </div>
          <div className="record-timer">{recorder.fmt(recorder.seconds)}</div>
          <div className="record-hint">Transcribed via Google Speech API</div>

          {recorder.audioBlob && !recorder.recording && (
            <div className="record-actions">
              <button className="btn" onClick={recorder.reset}><TrashIcon /> Discard</button>
              <button className="btn" onClick={onSubmitRecording} disabled={!!loading}>
                {loading?.includes('Transcribing') ? <><span className="spinner" /> Transcribing…</> : <><ZapIcon /> Transcribe</>}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Upload ── */}
      {transcriptTab === 'upload' && (
        !uploadFile || uploadStatus?.includes('Failed') ? (
          <div
            className={`upload-zone ${drag ? 'drag-over' : ''}`}
            onDragOver={e => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={e => { e.preventDefault(); setDrag(false); onFileUpload(e.dataTransfer.files[0]); }}
          >
            <input
              type="file"
              accept=".mp3,.wav,.mp4,.webm,.ogg,.m4a,.flac"
              onChange={e => onFileUpload(e.target.files[0])}
            />
            <div className="upload-icon"><UploadIcon /></div>
            <div className="upload-title">Drop audio or video file here</div>
            <div className="upload-sub">MP3 · WAV · MP4 · WEBM · OGG · M4A · FLAC · Max 50 MB</div>
          </div>
        ) : (
          <div className="upload-progress">
            <div className="upload-file-row">
              <FileTextIcon />
              <span className="upload-file-name">{uploadFile.name}</span>
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{(uploadFile.size / 1024 / 1024).toFixed(1)} MB</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${uploadProgress}%` }} />
            </div>
            <div className="upload-status">
              {uploadStatus}{uploadProgress > 0 && uploadProgress < 100 ? ` ${uploadProgress}%` : ''}
            </div>
            {uploadStatus === 'Transcription complete' && (
              <button className="btn" style={{ marginTop: 'var(--sp-3)' }} onClick={() => onFileUpload(null)}>
                Upload another file
              </button>
            )}
          </div>
        )
      )}

      {/* ── Paste ── */}
      {transcriptTab === 'paste' && (
        <div className="paste-wrap">
          <textarea
            className="transcript-textarea"
            placeholder="Paste your meeting transcript here…"
            value={transcript}
            onChange={e => { setTranscript(e.target.value); setTranscribed(''); }}
            rows={8}
          />
          <span className="char-count">{transcript.length}</span>
        </div>
      )}

      {/* Actions row */}
      <div className="transcript-actions">
        {isDemo && (
          <button className="btn" onClick={onRunFullDemo} style={{ color: 'var(--teal)', borderColor: 'rgba(45,212,191,0.25)' }}>
            <PlayIcon /> Run full demo
          </button>
        )}
        <button className="btn" onClick={onLoadDemo}><ZapIcon /> Load demo transcript</button>
      </div>

      {/* Transcribed preview */}
      {transcribed && (
        <div className="transcript-preview">
          <div className="transcript-preview-header">
            <span className="transcript-preview-label">Transcribed</span>
            <button className="btn-ghost" onClick={() => setTranscribed('')}><TrashIcon /> Clear</button>
          </div>
          <div className="transcript-preview-text">
            {transcribed.substring(0, 600)}{transcribed.length > 600 ? '…' : ''}
          </div>
        </div>
      )}
    </div>
  );
}