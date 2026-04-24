"""
tools/auth.py

Supports two modes:
  1. Per-user credentials: built from the OAuth tokens stored in Firestore
     after the user completes the /api/auth/login flow.
  2. Fallback to the legacy service-account / token.json for local dev.
"""
import os
import pickle
import tempfile
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request

# ── Legacy single-user path (local dev only) ─────────────────────────────────
_cached_creds = None

def get_credentials() -> Credentials:
    """
    Legacy path — still used by local dev where token.json exists.
    In production each request should call get_user_credentials(user_id).
    """
    global _cached_creds

    token_file = os.getenv('TOKEN_FILE', 'token.json')

    if os.path.exists(token_file):
        with open(token_file, 'rb') as f:
            creds = pickle.load(f)
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        _cached_creds = creds
        return _cached_creds

    # Cloud Run fallback: load from Secret Manager (owner's token)
    from google.cloud import secretmanager
    client = secretmanager.SecretManagerServiceClient()
    project_id = os.getenv('PROJECT_ID')
    secret_name = os.getenv('TOKEN_SECRET', 'meeting-assistant-token')
    name = f"projects/{project_id}/secrets/{secret_name}/versions/latest"
    response = client.access_secret_version(request={"name": name})
    secret_bytes = response.payload.data

    with tempfile.NamedTemporaryFile(delete=False, suffix='.pkl') as tmp:
        tmp.write(secret_bytes)
        tmp_path = tmp.name

    with open(tmp_path, 'rb') as f:
        _cached_creds = pickle.load(f)
    os.unlink(tmp_path)
    return _cached_creds


# ── Per-user credentials (production multi-user path) ────────────────────────

def get_user_credentials(user_id: str) -> Credentials:
    """
    Load OAuth2 credentials for a specific user from Firestore.
    Raises ValueError if the user has not authenticated yet.
    """
    from db.firestore_client import get_db

    doc = get_db().collection('user_tokens').document(user_id).get()
    if not doc.exists:
        raise ValueError(f'No credentials found for user {user_id}. Please re-authenticate.')

    data = doc.to_dict()

    creds = Credentials(
        token=data.get('token'),
        refresh_token=data.get('refresh_token'),
        token_uri=data.get('token_uri', 'https://oauth2.googleapis.com/token'),
        client_id=data.get('client_id') or os.getenv('GOOGLE_OAUTH_CLIENT_ID') or os.getenv('GOOGLE_CLIENT_ID'),
        client_secret=data.get('client_secret') or os.getenv('GOOGLE_OAUTH_CLIENT_SECRET') or os.getenv('GOOGLE_CLIENT_SECRET'),
        scopes=data.get('scopes'),
    )

    # Auto-refresh if expired
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        save_user_credentials(user_id, creds)

    return creds


def save_user_credentials(user_id: str, creds: Credentials, email: str = None):
    from db.firestore_client import get_db
    from datetime import datetime, timezone

    data = {
        'user_id': user_id,
        'token': creds.token,
        'refresh_token': creds.refresh_token,
        'token_uri': creds.token_uri,
        'client_id': creds.client_id,
        'client_secret': creds.client_secret,
        'scopes': list(creds.scopes) if creds.scopes else [],
        'updated_at': datetime.now(timezone.utc).isoformat(),
    }
    if email:
        data['email'] = email

    get_db().collection('user_tokens').document(user_id).set(data)