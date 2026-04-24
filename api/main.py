from fastapi import FastAPI, HTTPException, UploadFile, File, Request, Response
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, RedirectResponse
from pydantic import BaseModel
from dotenv import load_dotenv
import uvicorn, os, uuid, json
import secrets
import hashlib
import base64

load_dotenv()

app = FastAPI(title='Meeting Assistant', version='3.2.0')

# ── OAuth config ──────────────────────────────────────────────────────────────
SCOPES = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.readonly',
    'openid',
    'https://www.googleapis.com/auth/userinfo.email',
]

# FIX: Match env var names used in cloudbuild.yaml
# cloudbuild sets: GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, OAUTH_REDIRECT_URI
# Fall back to the older names for local dev compatibility
CLIENT_ID     = (os.getenv('GOOGLE_OAUTH_CLIENT_ID') or os.getenv('GOOGLE_CLIENT_ID', ''))
CLIENT_SECRET = (os.getenv('GOOGLE_OAUTH_CLIENT_SECRET') or os.getenv('GOOGLE_CLIENT_SECRET', ''))
APP_URL       = os.getenv('APP_URL', 'http://localhost:8080')
# Use OAUTH_REDIRECT_URI directly if set (as cloudbuild does), else derive from APP_URL
REDIRECT_URI  = os.getenv('OAUTH_REDIRECT_URI') or f'{APP_URL}/api/auth/callback'

# ── Demo mode constants ───────────────────────────────────────────────────────
DEMO_USER_ID    = "demo_user"
DEMO_USER_EMAIL = "demo@meridian.app"


def _generate_pkce():
    code_verifier = secrets.token_urlsafe(64)
    code_challenge = base64.urlsafe_b64encode(
        hashlib.sha256(code_verifier.encode()).digest()
    ).rstrip(b'=').decode()
    return code_verifier, code_challenge

def _is_demo_user(user_id: str | None) -> bool:
    return not user_id or user_id == DEMO_USER_ID


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
    demo_mode: bool = False

class ProcessRequest(BaseModel):
    meeting_id: str | None = None
    transcript: str
    demo_mode: bool = False


def _new_id() -> str:
    return str(uuid.uuid4())[:8]


# ── Health ────────────────────────────────────────────────────────────────────
@app.get('/api/health')
def health():
    return {'status': 'ok', 'version': '3.2.0'}


# ══════════════════════════════════════════════════════════════════════════════
# AUTH ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@app.get('/api/auth/status')
def auth_status(request: Request):
    """Returns whether the current user is authenticated."""
    uid = _get_user_id(request)

    # Demo mode — always valid, no DB lookup needed
    if _is_demo_user(uid):
        return {
            'authenticated': False,
            'demo_mode': True,
            'user_id': DEMO_USER_ID,
            'email': DEMO_USER_EMAIL,
        }

    try:
        from db.firestore_client import get_db
        doc = get_db().collection('user_tokens').document(uid).get()
        if not doc.exists:
            return {'authenticated': False, 'demo_mode': True, 'user_id': uid, 'email': None}
        data = doc.to_dict()
        return {
            'authenticated': True,
            'demo_mode': False,
            'user_id': uid,
            'email': data.get('email'),
        }
    except Exception as e:
        # FIX: If Firestore is slow/cold-starting, don't invalidate a valid cookie.
        # Trust the cookie uid as authenticated so the user isn't kicked to landing.
        # The worst case is they reach the app and a subsequent API call fails gracefully.
        if uid:
            return {'authenticated': True, 'demo_mode': False, 'user_id': uid, 'email': None}
        return {'authenticated': False, 'demo_mode': True, 'user_id': None, 'email': None, 'error': str(e)}


@app.get('/api/auth/login')
def auth_login(request: Request):
    if not CLIENT_ID or not CLIENT_SECRET:
        raise HTTPException(status_code=500, detail='OAuth not configured.')

    code_verifier, code_challenge = _generate_pkce()
    flow = _get_oauth_flow()
    auth_url, state = flow.authorization_url(
        access_type='offline',
        include_granted_scopes='true',
        prompt='consent',
        code_challenge=code_challenge,
        code_challenge_method='S256',
    )

    is_https = (request.headers.get("x-forwarded-proto") == "https" or
                APP_URL.startswith("https"))

    samesite_val = 'none' if is_https else 'lax'
    secure_val = True if is_https else False

    response = RedirectResponse(url=auth_url)
    response.set_cookie('oauth_state', state, max_age=600, httponly=True,
                        samesite=samesite_val, secure=secure_val)
    response.set_cookie('pkce_verifier', code_verifier, max_age=600, httponly=True,
                        samesite=samesite_val, secure=secure_val)
    return response



@app.get('/api/auth/callback')
def auth_callback(request: Request, code: str = None, state: str = None, error: str = None):
    if error:
        return RedirectResponse(url=f'/?auth_error={error}')
    if not code:
        raise HTTPException(status_code=400, detail='Missing authorization code')

    try:
        code_verifier = request.cookies.get('pkce_verifier')
        if not code_verifier:
            raise ValueError("Missing code verifier cookie - possible session timeout or cookie block")

        flow = _get_oauth_flow()
        flow.fetch_token(code=code, code_verifier=code_verifier)
        creds = flow.credentials

        from googleapiclient.discovery import build
        oauth2_service = build('oauth2', 'v2', credentials=creds)
        user_info = oauth2_service.userinfo().get().execute()
        email = user_info.get('email', '')

        user_id = email.replace('@', '_at_').replace('.', '_dot_')

        from tools.auth import save_user_credentials
        save_user_credentials(user_id, creds, email=email)

        is_https = (request.headers.get("x-forwarded-proto") == "https" or
                    APP_URL.startswith("https"))
        samesite_val = 'none' if is_https else 'lax'
        secure_val = True if is_https else False

        response = RedirectResponse(url='/?auth=success')
        response.set_cookie('meridian_user_id', user_id,
                            max_age=60 * 60 * 24 * 30, httponly=True,
                            samesite=samesite_val, secure=secure_val)
        response.delete_cookie('oauth_state', samesite=samesite_val, secure=secure_val)
        response.delete_cookie('pkce_verifier', samesite=samesite_val, secure=secure_val)
        return response

    except Exception as e:
        err_msg = str(e)[:200].replace('&', ' ').replace('#', ' ')
        return RedirectResponse(url=f'/?auth_error={err_msg}')


@app.get('/api/auth/logout')
def auth_logout():
    response = RedirectResponse(url='/')
    response.delete_cookie('meridian_user_id')
    return response


# ── Calendar events for dropdown ──────────────────────────────────────────────
@app.get('/api/events')
def get_upcoming_events(request: Request):
    """
    Returns upcoming calendar events.
    Demo users get hardcoded demo events — no Google API call.
    Authenticated users get their real calendar.
    """
    uid = _get_user_id(request)

    # ── DEMO MODE ────────────────────────────────────────────────────────────
    # FIX: Always return demo events for unauthenticated/demo users without
    # touching Firestore or any other service that could 500.
    if _is_demo_user(uid):
        from demo_data import get_demo_events
        return get_demo_events()

    # ── AUTHENTICATED MODE ────────────────────────────────────────────────────
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
        # Credentials missing/expired — fall back to demo events
        from demo_data import get_demo_events
        return get_demo_events()
    except Exception as e:
        # FIX: Return demo events instead of 500 on any calendar error
        from demo_data import get_demo_events
        return get_demo_events()


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
    is_demo = _is_demo_user(uid) or req.demo_mode

    # FIX: Use a stable per-device user_id for demo users derived from cookie,
    # so demo sessions are isolated per browser session.
    effective_user_id = uid if uid and not _is_demo_user(uid) else f"demo_{uid or 'anon'}"

    try:
        from db.firestore_client import create_session, update_session

        if not req.event_id:
            meeting_id = _new_id()
            create_session(meeting_id, {
                'event_id': None,
                'source': 'manual',
                'user_id': effective_user_id,
                'demo_mode': is_demo,
            })
            return {
                'meeting_id': meeting_id,
                'brief': None,
                'meeting_data': {},
                'conflict_result': {'conflicts_found': 0, 'proposals': []},
                'agenda_result': {},
                'demo_mode': is_demo,
                'message': 'Session created. Paste or record your transcript to process.',
            }

        # ── DEMO MODE: skip Google Calendar, use demo event ───────────────
        if is_demo:
            from demo_data import get_demo_event_by_id, get_demo_calendar_data
            meeting_id = _new_id()
            cal_data = get_demo_calendar_data()
            cal_data['event_id'] = req.event_id

            create_session(meeting_id, {
                'event_id': req.event_id,
                'source': 'demo',
                'user_id': effective_user_id,
                'demo_mode': True,
                'meeting_data': cal_data,
                'status': 'researching',
            })

            # Generate brief via research agent (Vertex AI — works without OAuth)
            from agents import research_agent
            research_data = research_agent.run_demo(
                meeting_id,
                cal_data.get('title', ''),
                cal_data.get('attendees', []),
            )

            import vertexai
            from vertexai.generative_models import GenerativeModel
            vertexai.init(project=os.getenv('PROJECT_ID'), location=os.getenv('LOCATION', 'us-central1'))
            model = GenerativeModel('gemini-2.5-flash')

            prompt = f"""
Assemble a concise pre-meeting brief for a busy professional.

MEETING DETAILS:
{json.dumps(cal_data, indent=2)}

RESEARCH CONTEXT:
{research_data.get('research_brief', 'N/A')}

Write a clean, scannable brief with sections:
## Meeting snapshot (title, time, attendees, type)
## What to know going in (2-4 bullet points)
## Agenda to cover
## Suggested questions to ask

Keep it under 400 words. Plain markdown only."""

            brief = model.generate_content(prompt).text
            update_session(meeting_id, {'brief': brief, 'status': 'ready'})

            return {
                'meeting_id': meeting_id,
                'brief': brief,
                'meeting_data': cal_data,
                'conflict_result': {'conflicts_found': 0, 'proposals': []},
                'agenda_result': {'status': 'demo_mode'},
                'demo_mode': True,
            }

        # ── AUTHENTICATED MODE ────────────────────────────────────────────
        _set_request_user(uid)
        from agents.orchestrator import prepare_meeting
        result = prepare_meeting(req.event_id)
        _clear_request_user()
        result['demo_mode'] = False
        return result

    except Exception as e:
        _clear_request_user()
        raise HTTPException(status_code=500, detail=str(e))


# ── Process transcript ────────────────────────────────────────────────────────
@app.post('/api/process')
async def process(req: ProcessRequest, request: Request):
    uid = _get_user_id(request)
    is_demo = _is_demo_user(uid) or req.demo_mode

    # FIX: Consistent effective user id — demo users get an isolated id
    effective_user_id = uid if uid and not _is_demo_user(uid) else f"demo_{uid or 'anon'}"

    try:
        from agents.orchestrator import process_meeting
        from db.firestore_client import create_session, get_session

        meeting_id = req.meeting_id or _new_id()
        if not get_session(meeting_id):
            create_session(meeting_id, {
                'event_id': None,
                'source': 'demo' if is_demo else 'transcript_only',
                'user_id': effective_user_id,
                'demo_mode': is_demo,
            })

        _set_request_user(effective_user_id)
        result = process_meeting(meeting_id, req.transcript)
        _clear_request_user()
        result['demo_mode'] = is_demo
        return result

    except Exception as e:
        _clear_request_user()
        raise HTTPException(status_code=500, detail=str(e))


# ── Demo transcript endpoint ──────────────────────────────────────────────────
@app.get('/api/demo/transcript')
def get_demo_transcript():
    """Returns the built-in demo transcript for quick testing."""
    from demo_data import DEMO_TRANSCRIPT
    return {'transcript': DEMO_TRANSCRIPT}


@app.get('/api/demo/events')
def get_demo_events_endpoint():
    """Returns demo calendar events (same as /api/events for unauthenticated users)."""
    from demo_data import get_demo_events
    return get_demo_events()


# ── Per-request user context ──────────────────────────────────────────────────
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


# ── Action items — FIX: filter by meeting_id OR user_id to prevent cross-device leakage ──
@app.get('/api/action-items')
def list_action_items(request: Request, meeting_id: str = None):
    uid = _get_user_id(request)
    effective_user_id = uid if uid and not _is_demo_user(uid) else f"demo_{uid or 'anon'}"

    from db.firestore_client import get_db
    try:
        # FIX: Always scope by user_id so different devices/users don't see each other's items
        q = get_db().collection('action_items').where('user_id', '==', effective_user_id).where('status', '==', 'open')
        if meeting_id:
            q = q.where('meeting_id', '==', meeting_id)
        docs = list(q.stream())
        return [d.to_dict() | {'id': d.id} for d in docs]
    except Exception as e:
        # Fallback without compound index
        try:
            all_docs = list(get_db().collection('action_items').stream())
            items = [d.to_dict() | {'id': d.id} for d in all_docs]
            # FIX: Filter by user_id
            items = [i for i in items if i.get('user_id') == effective_user_id and i.get('status') == 'open']
            if meeting_id:
                items = [i for i in items if i.get('meeting_id') == meeting_id]
            return items
        except Exception as e2:
            raise HTTPException(status_code=500, detail=str(e2))


# ── D1: Conflicts ─────────────────────────────────────────────────────────────
@app.get('/api/conflicts')
def list_conflicts(request: Request):
    uid = _get_user_id(request)
    effective_user_id = uid if uid and not _is_demo_user(uid) else f"demo_{uid or 'anon'}"

    try:
        from db.firestore_client import get_db
        # FIX: Filter conflict proposals by user_id
        docs = list(get_db().collection('conflict_proposals').stream())
        result = []
        for d in docs:
            data = d.to_dict() | {'id': d.id}
            if data.get('status') == 'pending_approval' and data.get('user_id') == effective_user_id:
                result.append(data)
        return result
    except Exception:
        return []


@app.post('/api/conflicts/{proposal_id}/approve')
def approve_conflict(proposal_id: str, request: Request):
    uid = _get_user_id(request)

    if _is_demo_user(uid):
        # In demo mode, just mark as approved without touching Calendar API
        try:
            from db.firestore_client import get_db
            get_db().collection('conflict_proposals').document(proposal_id).update({'status': 'approved'})
        except Exception:
            pass
        return {'status': 'approved', 'demo_mode': True, 'message': 'Demo: reschedule approved (no real calendar change)'}

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
        service = _calendar_service(uid)
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


# ── D2: Debt — FIX: scoped by user_id ────────────────────────────────────────
@app.get('/api/debt')
def get_debt(request: Request):
    uid = _get_user_id(request)
    effective_user_id = uid if uid and not _is_demo_user(uid) else f"demo_{uid or 'anon'}"
    try:
        from db.firestore_client import get_debt_summary
        return get_debt_summary(user_id=effective_user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/api/debt/escalate')
def escalate_debt(request: Request):
    uid = _get_user_id(request)
    if _is_demo_user(uid):
        return {'message': 'Demo mode: escalation emails not sent', 'demo_mode': True, 'escalated': 0}
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
def finalize_agenda(meeting_id: str, request: Request):
    uid = _get_user_id(request)
    if _is_demo_user(uid):
        return {
            'final_agenda': (
                '09:00 - 09:10  Login bug status update\n'
                '09:10 - 09:25  Q3 board report review\n'
                '09:25 - 09:35  API documentation updates\n'
                '09:35 - 09:50  Dashboard performance fix\n'
                '09:50 - 09:55  Decisions & next steps\n\n'
                'Goal: Align on blockers and confirm ownership before Friday board meeting.'
            ),
            'calendar_patched': False,
            'replies_found': 0,
            'demo_mode': True,
        }
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