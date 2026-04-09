from fastapi import FastAPI, HTTPException, UploadFile, File, Request, Response
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, RedirectResponse
from pydantic import BaseModel
from dotenv import load_dotenv
import uvicorn, os, uuid, json

load_dotenv()

app = FastAPI(title='Meeting Assistant', version='3.0.0')

# ── OAuth config ──────────────────────────────────────────────────────────────
SCOPES = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.readonly',
    'openid',
    'https://www.googleapis.com/auth/userinfo.email',
]

CLIENT_ID     = os.getenv('GOOGLE_CLIENT_ID', '')
CLIENT_SECRET = os.getenv('GOOGLE_CLIENT_SECRET', '')
# Set this to your deployed Cloud Run URL, e.g. https://meeting-assistant-xxx-uc.a.run.app
APP_URL = os.getenv('APP_URL', 'http://localhost:8080')
REDIRECT_URI  = f'{APP_URL}/api/auth/callback'


def _get_oauth_flow():
    from google_auth_oauthlib.flow import Flow
    flow = Flow.from_client_config(
        {
            'web': {
                'client_id': CLIENT_ID,
                'client_secret': CLIENT_SECRET,
                'auth_uri': 'https://accounts.google.com/o/oauth2/auth',
                'token_uri': 'https://oauth2.googleapis.com/token',
                'redirect_uris': [REDIRECT_URI],
            }
        },
        scopes=SCOPES,
        redirect_uri=REDIRECT_URI,
    )
    return flow


# ── Helper: get user_id from cookie ──────────────────────────────────────────
def _get_user_id(request: Request) -> str | None:
    return request.cookies.get('meridian_user_id')


def _require_user(request: Request) -> str:
    uid = _get_user_id(request)
    if not uid:
        raise HTTPException(status_code=401, detail='Not authenticated. Please login via /api/auth/login')
    return uid


# ── Helper: build per-user tool services ─────────────────────────────────────
def _calendar_service(user_id: str):
    from googleapiclient.discovery import build
    from tools.auth import get_user_credentials
    return build('calendar', 'v3', credentials=get_user_credentials(user_id))


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
    return {'status': 'ok', 'version': '3.0.0'}


# ══════════════════════════════════════════════════════════════════════════════
# AUTH ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@app.get('/api/auth/status')
def auth_status(request: Request):
    """Returns whether the current user is authenticated."""
    uid = _get_user_id(request)
    if not uid:
        return {'authenticated': False, 'user_id': None, 'email': None}

    try:
        from db.firestore_client import get_db
        doc = get_db().collection('user_tokens').document(uid).get()
        if not doc.exists:
            return {'authenticated': False, 'user_id': uid, 'email': None}
        data = doc.to_dict()
        return {
            'authenticated': True,
            'user_id': uid,
            'email': data.get('email'),
        }
    except Exception as e:
        return {'authenticated': False, 'user_id': None, 'email': None, 'error': str(e)}


@app.get('/api/auth/login')
def auth_login(request: Request):
    """
    Start the Google OAuth2 flow.
    Redirects the user to Google's consent screen.
    """
    if not CLIENT_ID or not CLIENT_SECRET:
        raise HTTPException(
            status_code=500,
            detail='OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET env vars.'
        )

    flow = _get_oauth_flow()
    auth_url, state = flow.authorization_url(
        access_type='offline',
        include_granted_scopes='true',
        prompt='consent',          # force consent so we always get refresh_token
    )

    # Store state in a short-lived cookie for CSRF protection
    response = RedirectResponse(url=auth_url)
    response.set_cookie('oauth_state', state, max_age=600, httponly=True, samesite='lax')
    return response


@app.get('/api/auth/callback')
def auth_callback(request: Request, code: str = None, state: str = None, error: str = None):
    """
    Google redirects here after user grants permission.
    Exchanges the code for tokens, stores them in Firestore, sets a session cookie.
    """
    if error:
        return RedirectResponse(url=f'/?auth_error={error}')

    if not code:
        raise HTTPException(status_code=400, detail='Missing authorization code')

    try:
        flow = _get_oauth_flow()
        flow.fetch_token(code=code)
        creds = flow.credentials

        # Get user email from Google
        from googleapiclient.discovery import build
        oauth2_service = build('oauth2', 'v2', credentials=creds)
        user_info = oauth2_service.userinfo().get().execute()
        email = user_info.get('email', '')

        # Use email-based user_id (stable across sessions)
        user_id = email.replace('@', '_at_').replace('.', '_dot_')

        # Save credentials to Firestore
        from tools.auth import save_user_credentials
        save_user_credentials(user_id, creds)

        # Also store the email alongside token data
        from db.firestore_client import get_db
        get_db().collection('user_tokens').document(user_id).update({'email': email})

        # Set session cookie and redirect to app
        response = RedirectResponse(url='/?auth=success')
        response.set_cookie(
            'meridian_user_id',
            user_id,
            max_age=60 * 60 * 24 * 30,   # 30 days
            httponly=True,
            samesite='lax',
        )
        # Clear the state cookie
        response.delete_cookie('oauth_state')
        return response

    except Exception as e:
        return RedirectResponse(url=f'/?auth_error={str(e)[:100]}')


@app.get('/api/auth/logout')
def auth_logout():
    response = RedirectResponse(url='/')
    response.delete_cookie('meridian_user_id')
    return response


# ── Calendar events for dropdown ──────────────────────────────────────────────
@app.get('/api/events')
def get_upcoming_events(request: Request):
    """
    Returns up to 10 upcoming calendar events for the signed-in user.
    Returns {auth_required: true} if not authenticated.
    """
    uid = _get_user_id(request)
    if not uid:
        return {'auth_required': True, 'fallback': True}

    try:
        from datetime import datetime, timedelta, timezone
        service = _calendar_service(uid)
        now = datetime.now(timezone.utc)

        result = service.events().list(
            calendarId='primary',
            timeMin=now.isoformat(),
            timeMax=(now + timedelta(days=7)).isoformat(),
            singleEvents=True,
            orderBy='startTime',
            maxResults=10,
        ).execute()

        events = result.get('items', [])
        formatted = []
        for ev in events:
            start_raw = ev.get('start', {}).get('dateTime') or ev.get('start', {}).get('date', '')
            try:
                from datetime import datetime as dt, timedelta as td
                if 'T' in start_raw:
                    parsed = dt.fromisoformat(start_raw.replace('Z', '+00:00'))
                    ist = parsed + td(hours=5, minutes=30)
                    time_label = ist.strftime('%a, %d %b %H:%M')
                else:
                    time_label = start_raw
            except Exception:
                time_label = start_raw

            title = ev.get('summary') or 'Untitled Meeting'
            if len(title) > 40:
                title = title[:38] + '…'

            formatted.append({
                'id':        ev.get('id', ''),
                'title':     title,
                'start':     start_raw,
                'label':     f"{title}  ·  {time_label}",
                'attendees': [a.get('email', '') for a in ev.get('attendees', [])],
            })

        return formatted

    except ValueError:
        # Credentials missing/expired — ask user to re-authenticate
        return {'auth_required': True, 'fallback': True}
    except Exception as e:
        return {'error': str(e), 'fallback': True}


# ── Transcription ─────────────────────────────────────────────────────────────
@app.post('/api/transcribe')
async def transcribe_audio(file: UploadFile = File(...)):
    allowed = {'.mp3', '.wav', '.mp4', '.webm', '.ogg', '.m4a', '.flac'}
    ext = os.path.splitext(file.filename or '')[1].lower()
    if ext not in allowed:
        raise HTTPException(status_code=400, detail=f'Unsupported file type "{ext}".')

    audio_bytes = await file.read()
    if len(audio_bytes) > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail='File too large. Maximum 50 MB.')
    if len(audio_bytes) < 100:
        raise HTTPException(status_code=400, detail='File appears to be empty.')

    try:
        transcript = _transcribe_with_speech_api(audio_bytes, ext)
        if not transcript.strip():
            raise ValueError('Speech API returned empty transcript.')
        return {'transcript': transcript, 'source': 'google_speech'}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Transcription failed: {str(e)}')


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
async def prepare(req: PrepareRequest, request: Request):
    uid = _get_user_id(request)
    try:
        from db.firestore_client import create_session

        if not req.event_id:
            meeting_id = _new_id()
            create_session(meeting_id, {'event_id': None, 'source': 'manual', 'user_id': uid})
            return {
                'meeting_id': meeting_id,
                'brief': None,
                'meeting_data': {},
                'conflict_result': {'conflicts_found': 0, 'proposals': []},
                'agenda_result': {},
                'message': 'Session created. Paste or record your transcript to process.',
            }

        # Inject user credentials into the agents via env override
        # Agents use tools/auth.py — we pass user_id via a context var
        _set_request_user(uid)
        from agents.orchestrator import prepare_meeting
        result = prepare_meeting(req.event_id)
        _clear_request_user()
        return result

    except Exception as e:
        _clear_request_user()
        raise HTTPException(status_code=500, detail=str(e))


# ── Process transcript ────────────────────────────────────────────────────────
@app.post('/api/process')
async def process(req: ProcessRequest, request: Request):
    uid = _get_user_id(request)
    try:
        from agents.orchestrator import process_meeting
        from db.firestore_client import create_session, get_session

        meeting_id = req.meeting_id or _new_id()
        if not get_session(meeting_id):
            create_session(meeting_id, {'event_id': None, 'source': 'transcript_only', 'user_id': uid})

        _set_request_user(uid)
        result = process_meeting(meeting_id, req.transcript)
        _clear_request_user()
        return result

    except Exception as e:
        _clear_request_user()
        raise HTTPException(status_code=500, detail=str(e))


# ── Per-request user context (simple thread-local alternative) ────────────────
import threading
_user_ctx = threading.local()

def _set_request_user(user_id: str | None):
    _user_ctx.user_id = user_id

def _clear_request_user():
    _user_ctx.user_id = None

def get_request_user() -> str | None:
    return getattr(_user_ctx, 'user_id', None)


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
    from db.firestore_client import get_db
    try:
        q = get_db().collection('action_items').where('status', '==', 'open')
        if meeting_id:
            q = q.where('meeting_id', '==', meeting_id)
        docs = list(q.stream())
        return [d.to_dict() | {'id': d.id} for d in docs]
    except Exception as e:
        if 'index' in str(e).lower() or 'failed-precondition' in str(e).lower():
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
    except Exception:
        return []


@app.post('/api/conflicts/{proposal_id}/approve')
def approve_conflict(proposal_id: str, request: Request):
    uid = _get_user_id(request)
    from db.firestore_client import get_db
    doc = get_db().collection('conflict_proposals').document(proposal_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail='Proposal not found')
    proposal = doc.to_dict()
    proposed_slot = proposal.get('proposed_slot')
    event_id = proposal.get('conflict', {}).get('event_id')
    if not proposed_slot or not event_id:
        raise HTTPException(status_code=400, detail='Missing slot or event_id')
    try:
        from datetime import datetime, timedelta
        service = _calendar_service(uid) if uid else None
        if not service:
            raise ValueError('Not authenticated')
        start_dt = datetime.fromisoformat(proposed_slot)
        end_dt   = start_dt + timedelta(hours=1)
        service.events().patch(
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