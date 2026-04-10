# ── Stage 1: Build React frontend ─────────────────────────────────────
FROM node:20-slim AS frontend-build
 
WORKDIR /frontend
 
# Copy package files first for better Docker layer caching
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install --silent
 
# Copy rest of frontend source
COPY frontend/ ./
 
# Build React app (outputs to /frontend/build)
RUN npm run build
 
 
# ── Stage 2: Python backend ────────────────────────────────────────────
FROM python:3.11-slim
 
WORKDIR /app
 
# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
 
# Copy backend source
COPY agents/ ./agents/
COPY tools/  ./tools/
COPY db/     ./db/
COPY api/    ./api/

# FIX: demo_data.py lives at the project root and is imported by api/main.py
# It was missing from the Docker image, causing "No module named 'demo_data'"
COPY demo_data.py ./demo_data.py
 
# Copy React build from Stage 1 into frontend/build/
# FastAPI looks for this at ../frontend/build relative to api/main.py
COPY --from=frontend-build /frontend/build ./frontend/build/
 
ENV PORT=8080
 
CMD ["python", "-m", "uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8080"]