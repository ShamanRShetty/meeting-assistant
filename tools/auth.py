import os
import pickle
import json
import tempfile
from google.oauth2.credentials import Credentials

_cached_creds = None

def get_credentials() -> Credentials:
    global _cached_creds
    if _cached_creds:
        return _cached_creds

    token_file = os.getenv('TOKEN_FILE', 'token.json')

    # Local dev: use token.json directly
    if os.path.exists(token_file):
        with open(token_file, 'rb') as f:
            _cached_creds = pickle.load(f)
        return _cached_creds

    # Cloud Run: load from Secret Manager
    from google.cloud import secretmanager
    client = secretmanager.SecretManagerServiceClient()
    project_id = os.getenv('PROJECT_ID')
    secret_name = os.getenv('TOKEN_SECRET', 'meeting-assistant-token')
    name = f"projects/{project_id}/secrets/{secret_name}/versions/latest"
    response = client.access_secret_version(request={"name": name})
    secret_bytes = response.payload.data

    # Write to a temp file and unpickle
    with tempfile.NamedTemporaryFile(delete=False, suffix='.json') as tmp:
        tmp.write(secret_bytes)
        tmp_path = tmp.name

    with open(tmp_path, 'rb') as f:
        _cached_creds = pickle.load(f)

    os.unlink(tmp_path)
    return _cached_creds