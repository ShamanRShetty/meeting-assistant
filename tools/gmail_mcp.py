from googleapiclient.discovery import build
from tools.auth import get_credentials
from email.mime.text import MIMEText
import base64, pickle, os
 
def _get_service():
    return build('gmail', 'v1', credentials=get_credentials())
 
def send_email(to: str, subject: str, body: str) -> dict:
    service = _get_service()
    msg = MIMEText(body)
    msg['to'] = to
    msg['subject'] = subject
    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
    return service.users().messages().send(
        userId='me', body={'raw': raw}
    ).execute()
 
def get_recent_thread(subject_keyword: str) -> list[dict]:
    """Search recent threads for a keyword in subject."""
    service = _get_service()
    results = service.users().messages().list(
        userId='me',
        q=f'subject:{subject_keyword} newer_than:7d'
    ).execute()
    return results.get('messages', [])[:5]
