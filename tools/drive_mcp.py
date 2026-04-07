from googleapiclient.discovery import build
from tools.auth import get_credentials
import pickle, os
 
def _get_service():
    return build('drive', 'v3', credentials=get_credentials())
 
def search_docs(query: str, max_results: int = 5) -> list[dict]:
    """Search Drive for relevant documents."""
    service = _get_service()
    result = service.files().list(
        q=f"fullText contains '{query}' and trashed=false",
        pageSize=max_results,
        fields='files(id, name, mimeType, webViewLink, modifiedTime)'
    ).execute()
    return result.get('files', [])
 
def get_doc_content(file_id: str) -> str:
    """Export a Google Doc as plain text."""
    service = _get_service()
    try:
        content = service.files().export(
            fileId=file_id, mimeType='text/plain'
        ).execute()
        return content.decode('utf-8')[:4000]  # truncate for context window
    except Exception:
        return ''