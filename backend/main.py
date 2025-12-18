from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import create_client
import os

app = FastAPI(title="LatticeIQ API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_KEY")
)

security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        user = supabase.auth.get_user(credentials.credentials)
        return user.user
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/api/contacts")
def get_contacts(user = Depends(get_current_user)):
    result = supabase.table("contacts").select("*").eq("user_id", user.id).execute()
    return {"contacts": result.data}

@app.get("/api/contacts/{contact_id}")
def get_contact(contact_id: int, user = Depends(get_current_user)):
    result = supabase.table("contacts").select("*").eq("id", contact_id).eq("user_id", user.id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Contact not found")
    return result.data[0]

@app.post("/api/contacts")
def create_contact(contact: dict, user = Depends(get_current_user)):
    contact["user_id"] = user.id
    result = supabase.table("contacts").insert(contact).execute()
    return result.data[0]

@app.delete("/api/contacts/{contact_id}")
def delete_contact(contact_id: int, user = Depends(get_current_user)):
    supabase.table("contacts").delete().eq("id", contact_id).eq("user_id", user.id).execute()
    return {"deleted": True}
