from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import os
from datetime import datetime
import asyncpg

app = FastAPI(title="LatticeIQ API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATABASE_URL = os.getenv("DATABASE_URL", "")
db_pool = None

@app.on_event("startup")
async def startup():
    global db_pool
    if DATABASE_URL:
        db_pool = await asyncpg.create_pool(DATABASE_URL, min_size=1, max_size=10)

@app.on_event("shutdown")
async def shutdown():
    if db_pool:
        await db_pool.close()

class Contact(BaseModel):
    id: Optional[int] = None
    name: str
    email: Optional[str] = None
    company: Optional[str] = None
    title: Optional[str] = None
    enrichment_status: Optional[str] = "pending"
    created_at: Optional[datetime] = None

class ContactCreate(BaseModel):
    name: str
    email: Optional[str] = None
    company: Optional[str] = None
    title: Optional[str] = None

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "LatticeIQ"}

@app.get("/api/v2/contacts")
async def list_contacts(limit: int = 20, offset: int = 0):
    if not db_pool:
        raise HTTPException(status_code=503, detail="Database not connected")
    
    async with db_pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM contacts ORDER BY created_at DESC LIMIT $1 OFFSET $2",
            limit, offset
        )
        contacts = [dict(row) for row in rows]
        return {"contacts": contacts, "total": len(contacts)}

@app.get("/api/v2/contacts/{contact_id}")
async def get_contact(contact_id: int):
    if not db_pool:
        raise HTTPException(status_code=503, detail="Database not connected")
    
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM contacts WHERE id = $1", contact_id)
        if not row:
            raise HTTPException(status_code=404, detail="Contact not found")
        return {"contact": dict(row)}

@app.post("/api/v2/contacts")
async def create_contact(contact: ContactCreate):
    if not db_pool:
        raise HTTPException(status_code=503, detail="Database not connected")
    
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO contacts (name, email, company, title, enrichment_status, created_at)
            VALUES ($1, $2, $3, $4, 'pending', NOW())
            RETURNING *
            """,
            contact.name, contact.email, contact.company, contact.title
        )
        return {"contact": dict(row)}
