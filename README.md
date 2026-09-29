# Nexus SV

## Backend
    cd backend
    python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
    pip install -r requirements.txt
    # edit .env (GEMINI_API_KEY, DATABASE_URL)
    uvicorn app.main:app --reload --port 8000
    # check: http://localhost:8000/docs and /api/v1/db-test

## Frontend
    cd frontend
    npm install
    npm run dev     # http://localhost:3000
