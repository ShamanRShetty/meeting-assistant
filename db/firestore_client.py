from google.cloud import firestore
from datetime import datetime, timezone
import os
 
db = firestore.Client(project=os.getenv('PROJECT_ID'))
 
# ── Sessions ────────────────────────────────────────────────
def create_session(meeting_id: str, meeting_data: dict) -> str:
    doc_ref = db.collection('sessions').document(meeting_id)
    doc_ref.set({
        'meeting_id': meeting_id,
        'status': 'pending',
        'created_at': datetime.now(timezone.utc),
        'meeting_data': meeting_data,
        'brief': None,
        'agent_logs': [],
        'action_items': [],
    })
    return meeting_id
 
def update_session(meeting_id: str, updates: dict):
    db.collection('sessions').document(meeting_id).update(updates)
 
def get_session(meeting_id: str) -> dict | None:
    doc = db.collection('sessions').document(meeting_id).get()
    return doc.to_dict() if doc.exists else None
 
def append_log(meeting_id: str, agent: str, message: str):
    db.collection('sessions').document(meeting_id).update({
        'agent_logs': firestore.ArrayUnion([{
            'agent': agent,
            'message': message,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }])
    })
 
# ── Action Items ────────────────────────────────────────────
def save_action_items(meeting_id: str, items: list[dict]):
    batch = db.batch()
    for item in items:
        ref = db.collection('action_items').document()
        batch.set(ref, {
            **item,
            'meeting_id': meeting_id,
            'status': 'open',
            'created_at': datetime.now(timezone.utc),
        })
    batch.commit()
 
def get_open_action_items(meeting_id: str = None) -> list[dict]:
    q = db.collection('action_items').where('status', '==', 'open')
    if meeting_id:
        q = q.where('meeting_id', '==', meeting_id)
    return [d.to_dict() | {'id': d.id} for d in q.stream()]
