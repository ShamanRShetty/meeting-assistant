from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from agents.orchestrator import prepare_meeting, process_meeting
from db.firestore_client import get_session, get_open_action_items
from dotenv import load_dotenv
import uvicorn, os
 
load_dotenv()
 
app = FastAPI(title='Meeting Assistant', version='1.0.0')
 
# ── Request models ───────────────────────────────────────────────────
class PrepareRequest(BaseModel):
    event_id: str
 
class ProcessRequest(BaseModel):
    meeting_id: str
    transcript: str
 
# ── API routes (all under /api) ──────────────────────────────────────
@app.get('/api/health')
def health():
    return {'status': 'ok', 'version': '1.0.0'}
 
@app.post('/api/prepare')
async def prepare(req: PrepareRequest):
    try:
        return prepare_meeting(req.event_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
 
@app.post('/api/process')
async def process(req: ProcessRequest):
    try:
        return process_meeting(req.meeting_id, req.transcript)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
 
@app.get('/api/session/{meeting_id}')
def get_session_status(meeting_id: str):
    session = get_session(meeting_id)
    if not session:
        raise HTTPException(status_code=404, detail='Session not found')
    return session
 
@app.get('/api/action-items')
def list_action_items(meeting_id: str = None):
    return get_open_action_items(meeting_id)
 
# ── Serve React frontend ─────────────────────────────────────────────
# This block runs AFTER all /api routes are registered.
# It serves the React build for every non-API request.
FRONTEND_BUILD = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'build')
 
if os.path.exists(FRONTEND_BUILD):
    # Serve static assets (JS, CSS, images)
    app.mount('/static', StaticFiles(directory=os.path.join(FRONTEND_BUILD, 'static')), name='static')
 
    # Serve index.html for all other routes (React Router support)
    @app.get('/{full_path:path}')
    def serve_react(full_path: str):
        index = os.path.join(FRONTEND_BUILD, 'index.html')
        return FileResponse(index)
 
if __name__ == '__main__':
    uvicorn.run('api.main:app', host='0.0.0.0', port=8080, reload=False)
