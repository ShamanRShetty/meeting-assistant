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
    # FIX: hoist user_id to the top level of the session document so
    # orchestrator.process_meeting() can read session.get('user_id') directly.
    # The passed dict may contain user_id as a flat key (from api/main.py).
    doc_ref.set({
        'meeting_id': meeting_id,
        'status': 'pending',
        'created_at': datetime.now(timezone.utc),
        'meeting_data': meeting_data,
        'user_id': meeting_data.get('user_id'),   # hoist to top level
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
    """
    FIX: Persist action items with user_id and meeting_id for proper isolation.
    Reads user_id from the session document to avoid passing it through every call.
    Also deduplicates: removes previous items for this meeting_id before saving.
    """
    db = get_db()

    # Look up user_id from the session
    session_doc = db.collection('sessions').document(meeting_id).get()
    user_id = 'unknown'
    if session_doc.exists:
        session_data = session_doc.to_dict()
        # user_id may be nested inside meeting_data dict
        user_id = (
            session_data.get('user_id')
            or session_data.get('meeting_data', {}).get('user_id')
            or 'unknown'
        )

    # FIX: Delete any previously saved items for this meeting_id to avoid duplicates
    existing = db.collection('action_items').where('meeting_id', '==', meeting_id).stream()
    delete_batch = db.batch()
    deleted = 0
    for doc in existing:
        delete_batch.delete(doc.reference)
        deleted += 1
        if deleted >= 400:  # Firestore batch limit safety
            delete_batch.commit()
            delete_batch = db.batch()
            deleted = 0
    if deleted > 0:
        delete_batch.commit()

    # Save fresh items with user_id attached
    batch = db.batch()
    for item in items:
        ref = db.collection('action_items').document()
        batch.set(ref, {
            **item,
            'meeting_id': meeting_id,
            'user_id': user_id,        # FIX: tag with user for isolation
            'status': 'open',
            'created_at': datetime.now(timezone.utc),
        })
    if items:
        batch.commit()


def get_open_action_items(meeting_id: str = None, user_id: str = None) -> list[dict]:
    """
    FIX: Accept user_id parameter so queries are user-scoped.
    Always filters in Python to handle old docs that lack the user_id field,
    which would otherwise appear in compound-index Firestore queries unexpectedly.
    """
    db = get_db()
    try:
        # Always scan and filter in Python so old docs without user_id
        # are never accidentally included in another user's results.
        all_docs = list(db.collection('action_items').stream())
        items = [d.to_dict() | {'id': d.id} for d in all_docs]
        items = [i for i in items if i.get('status') == 'open']
        if user_id:
            # FIX: Only include items that EXPLICITLY match this user_id.
            # Items with no user_id field (created before the fix) are excluded.
            items = [i for i in items if i.get('user_id') == user_id]
        if meeting_id:
            items = [i for i in items if i.get('meeting_id') == meeting_id]
        return items
    except Exception:
        return []


# ═══════════════════════════════════════════════════════════════
# DIFFERENTIATOR ADDITIONS
# ═══════════════════════════════════════════════════════════════

# ── D2: Meeting Debt ────────────────────────────────────────────
def mark_action_item_done(item_id: str):
    """Mark a single action item as complete."""
    get_db().collection('action_items').document(item_id).update({
        'status': 'done',
        'completed_at': datetime.now(timezone.utc)
    })

def get_debt_summary(user_id: str = None) -> dict:
    """
    FIX: Returns open/overdue counts scoped to the given user_id.
    Without user_id, returns global summary (internal/admin use only).
    'overdue' = open items whose due_date is before today and not 'TBD'.
    """
    from datetime import date
    today_str = date.today().isoformat()  # e.g. '2025-04-07'
    all_open = get_open_action_items(user_id=user_id)
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