from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="LatticeIQ Backend", version="1.0.0")

# CORS - allow frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health():
    return {"status": "ok", "service": "latticeiq-backend"}

@app.get("/api/v2/contacts")
async def get_contacts(limit: int = 20):
    # TODO: Connect to PostgreSQL
    return {"contacts": []}

@app.get("/api/v2/contacts/{contact_id}")
async def get_contact(contact_id: str):
    # TODO: Fetch from DB
    return {"contact": None}

@app.post("/api/contacts/{contact_id}/enrich")
async def enrich_contact(contact_id: str):
    # TODO: Trigger enrichment
    return {"status": "enriching"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 10000))
    uvicorn.run(app, host="0.0.0.0", port=port)
