from google.cloud import firestore
from datetime import datetime, timezone
import os

_db = None

def get_db():
    global _db
    if _db is None:
        _db = firestore.Client(project=os.getenv('PROJECT_ID'))
    return _db

# ── Sessions ────────────────────────────────────────────────
def create_session(meeting_id: str, meeting_data: dict) -> str:
    doc_ref = get_db().collection('sessions').document(meeting_id)
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
    get_db().collection('sessions').document(meeting_id).update(updates)

def get_session(meeting_id: str) -> dict | None:
    doc = get_db().collection('sessions').document(meeting_id).get()
    return doc.to_dict() if doc.exists else None

def append_log(meeting_id: str, agent: str, message: str):
    get_db().collection('sessions').document(meeting_id).update({
        'agent_logs': firestore.ArrayUnion([{
            'agent': agent,
            'message': message,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }])
    })

# ── Action Items ────────────────────────────────────────────
def save_action_items(meeting_id: str, items: list[dict]):
    batch = get_db().batch()
    for item in items:
        ref = get_db().collection('action_items').document()
        batch.set(ref, {
            **item,
            'meeting_id': meeting_id,
            'status': 'open',
            'created_at': datetime.now(timezone.utc),
        })
    batch.commit()

def get_open_action_items(meeting_id: str = None) -> list[dict]:
    q = get_db().collection('action_items').where('status', '==', 'open')
    if meeting_id:
        q = q.where('meeting_id', '==', meeting_id)
    return [d.to_dict() | {'id': d.id} for d in q.stream()]

# ═══════════════════════════════════════════════════════════════
# DIFFERENTIATOR ADDITIONS — paste below existing functions
# ═══════════════════════════════════════════════════════════════
 
# ── D2: Meeting Debt ────────────────────────────────────────────
def mark_action_item_done(item_id: str):
    """Mark a single action item as complete."""
    get_db().collection('action_items').document(item_id).update({
        'status': 'done',
        'completed_at': datetime.now(timezone.utc)
    })
 
def get_debt_summary() -> dict:
    """
    Returns open/overdue counts for the debt dashboard.
    'overdue' = open items whose due_date is before today and not 'TBD'.
    """
    from datetime import date
    today_str = date.today().isoformat()  # e.g. '2025-04-07'
    all_open = get_open_action_items()
    overdue = []
    for item in all_open:
        dd = item.get('due_date', 'TBD')
        if dd != 'TBD' and dd < today_str:
            overdue.append(item)
    return {
        'open': len(all_open),
        'overdue': len(overdue),
        'overdue_items': overdue,
        'open_items': all_open,
    }
 
# ── D4: ROI Store ───────────────────────────────────────────────
def save_roi_score(meeting_id: str, roi_data: dict):
    """Persist ROI result so it can be queried for trends later."""
    get_db().collection('roi_scores').document(meeting_id).set({
        **roi_data,
        'meeting_id': meeting_id,
        'scored_at': datetime.now(timezone.utc),
    })
 
def get_roi_history(limit: int = 10) -> list[dict]:
    """Fetch last N ROI scores ordered by most recent first."""
    docs = (
        get_db().collection('roi_scores')
        .order_by('scored_at', direction='DESCENDING')
        .limit(limit)
        .stream()
    )
    return [d.to_dict() | {'id': d.id} for d in docs]
