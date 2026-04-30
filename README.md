# Meridian Meeting Assistant

Meridian Meeting Assistant is an AI-powered smart application that integrates with your Google Calendar to prepare you for upcoming meetings, transcribe audio recordings, process action items, and manage conflicts. 

It leverages advanced Google Cloud services, including Vertex AI and Speech-to-Text, to help professionals save time and stay organized.

## The Problem It Solves

Modern professionals spend an enormous amount of time in meetings, leading to context switching, forgotten action items, and double-booked schedules. Meridian Meeting Assistant solves this by acting as an AI Chief of Staff. It automatically prepares you for meetings, distills transcripts into clear action items, keeps track of outstanding "debt" (unresolved tasks), and handles the busywork of identifying and resolving calendar conflicts. 

## Features

- **Calendar Integration**: Connects seamlessly with Google Calendar using OAuth to view upcoming events and securely manage schedules.
- **Smart Pre-Meeting Briefs**: Generates concise, AI-powered meeting briefs with contextual research to help you prepare before joining.
- **Audio Transcription**: Upload meeting audio recordings to get fast and accurate transcriptions using Google Cloud Speech-to-Text.
- **Automated Processing**: Leverages Google's Vertex AI (Gemini) to extract action items, finalize agendas, and assess meeting ROI based on transcripts.
- **Conflict Management**: Identifies schedule conflicts and automatically proposes and applies re-scheduling options.
- **Action Item Tracking ("Debt")**: Keeps track of unresolved action items and responsibilities across multiple sessions.
- **Demo Mode**: Built-in mock data for easy exploration and testing without full Google Cloud setup.

## Tech Stack

- **Frontend**: React, Axios, Framer Motion for animations, and React Markdown for rendering text.
- **Backend**: FastAPI (Python), Uvicorn for the server.
- **Cloud & AI**: Google Cloud Platform (Firestore, Speech-to-Text, Vertex AI, Secret Manager, Pub/Sub, BigQuery) and Google Workspace APIs (Calendar, OAuth).

## Setup Instructions

### Prerequisites
- Python 3.10+
- Node.js & npm
- A Google Cloud Project with the required APIs enabled (Calendar API, Speech-to-Text, Vertex AI, Firestore).

### Clone the Repository
```bash
git clone https://github.com/yourusername/meeting-assistant.git
cd meeting-assistant
```

### Backend Setup
1. Ensure you are in the root directory (`meeting-assistant`).
2. Create and activate a Python virtual environment:
   ```bash
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Configure your environment variables in a `.env` file (e.g., `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `APP_URL`, `PROJECT_ID`, `LOCATION`). You also need to have Google Cloud default credentials set up.
5. Run the FastAPI backend:
   ```bash
   python api/main.py
   # Or using uvicorn directly:
   uvicorn api.main:app --host 0.0.0.0 --port 8080 --reload
   ```

### Frontend Setup
1. Navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the React development server:
   ```bash
   npm start
   ```

### Docker Deployment
The project includes a `Dockerfile` and `cloudbuild.yaml` for streamlined, containerized deployment (e.g., to Google Cloud Run). 

## Architecture Highlights
- **Multi-Agent System**: Utilizes an orchestration pattern (`agents/orchestrator.py`) alongside specialized agents (research, agenda, debt) to modularize meeting tasks.
- **Secure Authentication**: Stateless, cookie-based authentication using the secure Google OAuth PKCE flow.
- **Scalable Database**: Relies on Google Cloud Firestore for flexible and fast data management for users, sessions, action items, and ROI scores.