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

# ═══════════════════════════════════════════════════════════════
# DIFFERENTIATOR ADDITION
# ═══════════════════════════════════════════════════════════════
 
# ── D3: Agenda poll ─────────────────────────────────────────────
def send_agenda_poll(to: str, attendee_name: str,
                     meeting_title: str, meeting_time: str) -> dict:
    """
    Send a pre-meeting agenda poll email to one attendee.
    Asks for their top priority so the orchestrator can
    synthesize a shared agenda before the meeting.
    """
    subject = f'[Quick question] {meeting_title} agenda'
    body = (
        f'Hi {attendee_name},\n\n'
        f'We have "{meeting_title}" coming up on {meeting_time}.\n\n'
        f'To make sure the meeting covers what matters most to you, '
        f'please reply to this email with:\n\n'
        f'1. Your #1 priority topic for this meeting (1-2 sentences)\n'
        f'2. Any blockers or decisions you need from this meeting\n\n'
        f'Replies will be aggregated automatically to build a shared agenda.\n\n'
        f'Thank you!'
    )
    return send_email(to=to, subject=subject, body=body)

