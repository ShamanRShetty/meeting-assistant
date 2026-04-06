from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel
from agents.orchestrator import prepare_meeting, process_meeting
from db.firestore_client import get_session, get_open_action_items
from dotenv import load_dotenv
import uvicorn, os
 
load_dotenv()
app = FastAPI(title='Meeting Assistant API', version='1.0.0')
 
# ── Request/Response Models ──────────────────────────────────────────
class PrepareRequest(BaseModel):
    event_id: str
 
class ProcessRequest(BaseModel):
    meeting_id: str
    transcript: str
 
# ── Routes ──────────────────────────────────────────────────────────
@app.get('/health')
def health():
    return {'status': 'ok', 'version': '1.0.0'}
 
@app.post('/prepare')
async def prepare(req: PrepareRequest, bg: BackgroundTasks):
    """
    Trigger pre-meeting workflow.
    Returns immediately with meeting_id; use /session/{id} to poll status.
    """
    try:
        result = prepare_meeting(req.event_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
 
@app.post('/process')
async def process(req: ProcessRequest):
    """Submit a transcript for post-meeting processing."""
    try:
        result = process_meeting(req.meeting_id, req.transcript)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
 
@app.get('/session/{meeting_id}')
def get_session_status(meeting_id: str):
    session = get_session(meeting_id)
    if not session:
        raise HTTPException(status_code=404, detail='Session not found')
    return session
 
@app.get('/action-items')
def list_action_items(meeting_id: str = None):
    return get_open_action_items(meeting_id)
 
if __name__ == '__main__':
    uvicorn.run('api.main:app', host='0.0.0.0', port=8080, reload=True)