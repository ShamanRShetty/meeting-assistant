// hooks/index.js — all custom hooks

import { useState, useCallback, useRef } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || '/api';

// ── useCopy ──────────────────────────────────────────────────────────────────
export function useCopy() {
  const [copied, setCopied] = useState(false);
  const copy = useCallback((text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);
  return { copied, copy };
}

// ── useRecorder ───────────────────────────────────────────────────────────────
export function useRecorder() {
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
      mr.onstop = () => {
        setAudioBlob(new Blob(chunksRef.current, { type: 'audio/webm' }));
        stream.getTracks().forEach(t => t.stop());
      };
      mr.start(250);
      mediaRef.current = mr;
      setRecording(true);
      setSeconds(0);
      setAudioBlob(null);
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } catch {
      alert('Microphone access denied.');
    }
  }, []);

  const stop = useCallback(() => {
    if (mediaRef.current && mediaRef.current.state !== 'inactive') mediaRef.current.stop();
    clearInterval(timerRef.current);
    setRecording(false);
  }, []);

  const reset = useCallback(() => {
    setAudioBlob(null);
    setSeconds(0);
  }, []);

  const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return { recording, seconds, audioBlob, start, stop, reset, fmt };
}

// ── useApi ────────────────────────────────────────────────────────────────────
export function useApi() {
  const [loading, setLoading] = useState('');
  const [error, setError] = useState('');

  const call = useCallback(async (fn, loadingMsg = 'Loading…') => {
    setLoading(loadingMsg);
    setError('');
    try {
      const result = await fn();
      return result;
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || 'Request failed';
      setError(msg);
      return null;
    } finally {
      setLoading('');
    }
  }, []);

  return { loading, error, call, setError };
}

// ── api helpers ───────────────────────────────────────────────────────────────
export const api = {
  authStatus: () => axios.get(`${API}/auth/status`).then(r => r.data),
  events:     () => axios.get(`${API}/events`).then(r => r.data),
  prepare:    (body) => axios.post(`${API}/prepare`, body).then(r => r.data),
  process:    (body) => axios.post(`${API}/process`, body).then(r => r.data),
  session:    (id) => axios.get(`${API}/session/${id}`).then(r => r.data),
  latestSession: () => axios.get(`${API}/sessions/latest`).then(r => r.data),
  transcribe: (form, onProgress) => axios.post(`${API}/transcribe`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: e => onProgress && onProgress(Math.round((e.loaded / e.total) * 100)),
  }).then(r => r.data),
  debt:       () => axios.get(`${API}/debt`).then(r => r.data),
  actionItems:(meetingId) => axios.get(`${API}/action-items${meetingId ? `?meeting_id=${meetingId}` : ''}`).then(r => r.data),
  markDone:   (id) => axios.post(`${API}/action-items/${id}/done`).then(r => r.data),
  conflicts:  () => axios.get(`${API}/conflicts`).then(r => r.data),
  approveConflict: (id) => axios.post(`${API}/conflicts/${id}/approve`).then(r => r.data),
  finalizeAgenda: (id) => axios.post(`${API}/agenda/finalize/${id}`).then(r => r.data),
  logout:     () => axios.get(`${API}/auth/logout`),
};