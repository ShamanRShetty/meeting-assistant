import vertexai
from vertexai.generative_models import GenerativeModel
from tools.drive_mcp import search_docs, get_doc_content
from db.firestore_client import append_log
import os
 
vertexai.init(project=os.getenv('PROJECT_ID'), location=os.getenv('LOCATION'))
model = GenerativeModel('gemini-2.5-flash')
 
def run(meeting_id: str, meeting_title: str, attendees: list[str]) -> dict:
    append_log(meeting_id, 'research_agent', 'Starting research...')
 
    # Search Drive for relevant docs
    docs = search_docs(meeting_title, max_results=5)
    doc_summaries = []
    for doc in docs:
        content = get_doc_content(doc['id'])
        if content:
            doc_summaries.append(f"- {doc['name']}: {content[:500]}")
 
    docs_text = '\n'.join(doc_summaries) if doc_summaries else 'No relevant docs found.'
    attendees_text = ', '.join(attendees)
 
    prompt = f"""
You are a research assistant preparing context for a business meeting.
Meeting title: {meeting_title}
Attendees: {attendees_text}
 
Relevant Drive documents found:
{docs_text}
 
Produce a concise research brief (max 300 words) covering:
1. Key topics likely to be discussed based on the meeting title
2. Relevant context from the Drive docs
3. Suggested background questions the attendee should be aware of
 
Format as plain text. Be specific, not generic."""
 
    response = model.generate_content(prompt)
    research_brief = response.text
 
    append_log(meeting_id, 'research_agent',
               f'Research complete. Found {len(docs)} docs.')
    return {
        'research_brief': research_brief,
        'docs_found': [{'name': d['name'], 'link': d.get('webViewLink','')} for d in docs]
    }
