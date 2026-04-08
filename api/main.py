from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from dotenv import load_dotenv
import uvicorn, os, uuid, tempfile

load_dotenv()

app = FastAPI(title='Meeting Assistant', version='2.0.0')


# ── Request models ────────────────────────────────────────────────────────────
class PrepareRequest(BaseModel):
    event_id: str | None = None

class ProcessRequest(BaseModel):
    meeting_id: str | None = None
    transcript: str


def _new_id() -> str:
    return str(uuid.uuid4())[:8]


# ── Health ────────────────────────────────────────────────────────────────────
@app.get('/api/health')
def health():
    return {'status': 'ok', 'version': '2.0.0'}


# ── Calendar events for dropdown ──────────────────────────────────────────────
@app.get('/api/events')
def get_upcoming_events():
    """
    Returns up to 10 upcoming calendar events for the dropdown.
    Falls back gracefully if Calendar API is unavailable — frontend
    switches to Quick Session mode on error response.
    """
    try:
        from tools.calendar_mcp import _get_service
        from datetime import datetime, timedelta, timezone
        service = _get_service()
        now = datetime.now(timezone.utc)

        result = service.events().list(
            calendarId='primary',
            timeMin=now.isoformat(),
            timeMax=(now + timedelta(days=7)).isoformat(),
            singleEvents=True,       # expands recurring events into instances
            orderBy='startTime',
            maxResults=10,
        ).execute()

        events = result.get('items', [])

        # Return only what the UI needs — event_id is internal, never shown as text
        formatted = []
        for ev in events:
            start_raw = ev.get('start', {}).get('dateTime') or ev.get('start', {}).get('date', '')
            # Format display label — browsers truncate <option> text at ~ 60 chars on some OSes
            # Keep it clean: "Title · Day, DD Mon, HH:MM"
            try:
                from datetime import datetime as dt
                if 'T' in start_raw:
                    parsed = dt.fromisoformat(start_raw.replace('Z', '+00:00'))
                    # Convert to IST (UTC+5:30)
                    from datetime import timedelta as td
                    ist = parsed + td(hours=5, minutes=30)
                    time_label = ist.strftime('%a, %d %b %H:%M')
                else:
                    time_label = start_raw  # all-day event
            except Exception:
                time_label = start_raw

            title = ev.get('summary') or 'Untitled Meeting'
            # Truncate title so option label stays readable
            if len(title) > 40:
                title = title[:38] + '…'

            formatted.append({
                'id':        ev.get('id', ''),
                'title':     title,
                'start':     start_raw,
                'label':     f"{title}  ·  {time_label}",   # what the <option> shows
                'attendees': [a.get('email', '') for a in ev.get('attendees', [])],
            })

        return formatted

    except Exception as e:
        # Graceful fallback — frontend will see error key and switch to Quick Session
        return {'error': str(e), 'fallback': True}


# ── Transcription ─────────────────────────────────────────────────────────────
@app.post('/api/transcribe')
async def transcribe_audio(file: UploadFile = File(...)):
    """
    Accepts audio/video file, returns plain text transcript.
    Falls back with a clear error message if Speech API unavailable.
    """
    allowed = {'.mp3', '.wav', '.mp4', '.webm', '.ogg', '.m4a', '.flac'}
    ext = os.path.splitext(file.filename or '')[1].lower()
    if ext not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f'Unsupported file type "{ext}". Allowed: {", ".join(sorted(allowed))}'
        )

    audio_bytes = await file.read()
    if len(audio_bytes) > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail='File too large. Maximum 50 MB.')
    if len(audio_bytes) < 100:
        raise HTTPException(status_code=400, detail='File appears to be empty.')

    try:
        transcript = _transcribe_with_speech_api(audio_bytes, ext)
        if not transcript.strip():
            raise ValueError('Speech API returned empty transcript — audio may be silent or unclear.')
        return {'transcript': transcript, 'source': 'google_speech'}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f'Transcription failed: {str(e)}. Please paste the transcript manually.'
        )


def _transcribe_with_speech_api(audio_bytes: bytes, ext: str) -> str:
    from google.cloud import speech

    client = speech.SpeechClient()

    encoding_map = {
        '.wav':  speech.RecognitionConfig.AudioEncoding.LINEAR16,
        '.flac': speech.RecognitionConfig.AudioEncoding.FLAC,
        '.mp3':  speech.RecognitionConfig.AudioEncoding.MP3,
        '.ogg':  speech.RecognitionConfig.AudioEncoding.OGG_OPUS,
        '.mp4':  speech.RecognitionConfig.AudioEncoding.LINEAR16,
        '.webm': speech.RecognitionConfig.AudioEncoding.WEBM_OPUS,
        '.m4a':  speech.RecognitionConfig.AudioEncoding.MP3,
    }
    encoding = encoding_map.get(ext, speech.RecognitionConfig.AudioEncoding.LINEAR16)

    config = speech.RecognitionConfig(
        encoding=encoding,
        sample_rate_hertz=16000,
        language_code='en-IN',
        alternative_language_codes=['en-US'],
        enable_automatic_punctuation=True,
        model='latest_long',
    )
    audio = speech.RecognitionAudio(content=audio_bytes)

    if len(audio_bytes) < 5 * 1024 * 1024:
        response = client.recognize(config=config, audio=audio)
        parts = [r.alternatives[0].transcript for r in response.results if r.alternatives]
    else:
        operation = client.long_running_recognize(config=config, audio=audio)
        response = operation.result(timeout=300)
        parts = [r.alternatives[0].transcript for r in response.results if r.alternatives]

    return ' '.join(parts)


# ── Prepare meeting ───────────────────────────────────────────────────────────
@app.post('/api/prepare')
async def prepare(req: PrepareRequest):
    """
    event_id provided  → full calendar + research + conflict + agenda flow
    event_id missing   → create a bare session with auto UUID, return immediately
    """
    try:
        from db.firestore_client import create_session

        if not req.event_id:
            meeting_id = _new_id()
            create_session(meeting_id, {'event_id': None, 'source': 'manual'})
            return {
                'meeting_id':    meeting_id,
                'brief':         None,
                'meeting_data':  {},
                'conflict_result': {'conflicts_found': 0, 'proposals': []},
                'agenda_result': {},
                'message':       'Session created. Paste or record your transcript to process.',
            }

        from agents.orchestrator import prepare_meeting
        return prepare_meeting(req.event_id)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Process transcript ────────────────────────────────────────────────────────
@app.post('/api/process')
async def process(req: ProcessRequest):
    """
    meeting_id missing → auto-generate one and create a bare session.
    transcript required.
    """
    try:
        from agents.orchestrator import process_meeting
        from db.firestore_client import create_session, get_session

        meeting_id = req.meeting_id or _new_id()

        # Ensure session exists — idempotent
        if not get_session(meeting_id):
            create_session(meeting_id, {'event_id': None, 'source': 'transcript_only'})

        return process_meeting(meeting_id, req.transcript)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Session ───────────────────────────────────────────────────────────────────
@app.get('/api/session/{meeting_id}')
def get_session_status(meeting_id: str):
    from db.firestore_client import get_session
    session = get_session(meeting_id)
    if not session:
        raise HTTPException(status_code=404, detail='Session not found')
    return session


# ── Action items ──────────────────────────────────────────────────────────────
@app.get('/api/action-items')
def list_action_items(meeting_id: str = None):
    """
    Returns open action items. Handles missing Firestore composite index
    gracefully by falling back to a client-side filter if needed.
    """
    from db.firestore_client import get_db
    try:
        # Try the indexed query first
        q = get_db().collection('action_items').where('status', '==', 'open')
        if meeting_id:
            q = q.where('meeting_id', '==', meeting_id)
        docs = list(q.stream())
        return [d.to_dict() | {'id': d.id} for d in docs]
    except Exception as e:
        if 'index' in str(e).lower() or 'failed-precondition' in str(e).lower():
            # Firestore composite index not yet built — fall back: fetch all, filter in Python
            try:
                all_docs = list(get_db().collection('action_items').stream())
                items = [d.to_dict() | {'id': d.id} for d in all_docs]
                items = [i for i in items if i.get('status') == 'open']
                if meeting_id:
                    items = [i for i in items if i.get('meeting_id') == meeting_id]
                return items
            except Exception as e2:
                raise HTTPException(status_code=500, detail=str(e2))
        raise HTTPException(status_code=500, detail=str(e))


# ── D1: Conflicts ─────────────────────────────────────────────────────────────
@app.get('/api/conflicts')
def list_conflicts():
    try:
        from db.firestore_client import get_db
        docs = (
            get_db().collection('conflict_proposals')
            .where('status', '==', 'pending_approval')
            .stream()
        )
        return [d.to_dict() | {'id': d.id} for d in docs]
    except Exception as e:
        # Index not ready or empty — return empty list, not a 500
        return []


@app.post('/api/conflicts/{proposal_id}/approve')
def approve_conflict(proposal_id: str):
    from db.firestore_client import get_db
    from tools.calendar_mcp import _get_service
    doc = get_db().collection('conflict_proposals').document(proposal_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail='Proposal not found')
    proposal = doc.to_dict()
    proposed_slot = proposal.get('proposed_slot')
    event_id = proposal.get('conflict', {}).get('event_id')
    if not proposed_slot or not event_id:
        raise HTTPException(status_code=400, detail='Missing slot or event_id in proposal')
    try:
        from datetime import datetime, timedelta
        start_dt = datetime.fromisoformat(proposed_slot)
        end_dt   = start_dt + timedelta(hours=1)
        _get_service().events().patch(
            calendarId='primary', eventId=event_id,
            body={
                'start': {'dateTime': start_dt.isoformat(), 'timeZone': 'Asia/Kolkata'},
                'end':   {'dateTime': end_dt.isoformat(),   'timeZone': 'Asia/Kolkata'},
            }
        ).execute()
        get_db().collection('conflict_proposals').document(proposal_id).update({'status': 'approved'})
        return {'status': 'approved', 'new_time': proposed_slot}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── D2: Debt ──────────────────────────────────────────────────────────────────
@app.get('/api/debt')
def get_debt():
    try:
        from db.firestore_client import get_debt_summary
        return get_debt_summary()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/api/debt/escalate')
def escalate_debt():
    try:
        from agents.debt_agent import run as debt_run
        return debt_run('manual_trigger')
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/api/action-items/{item_id}/done')
def mark_done(item_id: str):
    try:
        from db.firestore_client import mark_action_item_done
        mark_action_item_done(item_id)
        return {'status': 'done', 'id': item_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── D3: Agenda ────────────────────────────────────────────────────────────────
@app.post('/api/agenda/finalize/{meeting_id}')
def finalize_agenda(meeting_id: str):
    try:
        from agents.agenda_agent import finalize
        return finalize(meeting_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/api/agenda/{meeting_id}')
def get_agenda(meeting_id: str):
    from db.firestore_client import get_db
    doc = get_db().collection('agendas').document(meeting_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail='Agenda not found')
    return doc.to_dict()


# ── D4: ROI ───────────────────────────────────────────────────────────────────
@app.get('/api/roi')
def get_roi_history():
    try:
        from db.firestore_client import get_roi_history
        return get_roi_history()
    except Exception as e:
        return []


@app.get('/api/roi/{meeting_id}')
def get_roi_for_meeting(meeting_id: str):
    from db.firestore_client import get_db
    doc = get_db().collection('roi_scores').document(meeting_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail='ROI score not found')
    return doc.to_dict()


# ── Serve React build ─────────────────────────────────────────────────────────
FRONTEND_BUILD = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'build')

if os.path.exists(FRONTEND_BUILD):
    app.mount(
        '/static',
        StaticFiles(directory=os.path.join(FRONTEND_BUILD, 'static')),
        name='static',
    )

    @app.get('/{full_path:path}')
    def serve_react(full_path: str):
        return FileResponse(os.path.join(FRONTEND_BUILD, 'index.html'))


if __name__ == '__main__':
    uvicorn.run('api.main:app', host='0.0.0.0', port=8080, reload=False)