"""
LatticeIQ FastAPI Application
Core API entry point with auth, CRUD, and enrichment wiring
"""

from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
import logging
import os
from uuid import UUID
from typing import List, Optional
from datetime import datetime

# Import models
from models import (
    ContactResponse, ContactCreateRequest, ContactUpdateRequest, ContactListResponse,
    EnrichRequest, EnrichmentStatusResponse, ErrorDetail, ErrorCode,
    BatchEnrichRequest, BatchEnrichResponse
)

# Import auth
from auth import get_current_user

# Import services
from services.contact_service import ContactService
from services.enrichment_service import EnrichmentService

# Import enrichment router
from enrichment_v3.api_routes import router as enrichment_router

# ============================================================================
# LOGGING
# ============================================================================

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ============================================================================
# FASTAPI APP INITIALIZATION
# ============================================================================

app = FastAPI(
    title="LatticeIQ API",
    version="1.0.0",
    description="Sales Intelligence Platform"
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# EXCEPTION HANDLERS
# ============================================================================

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle Pydantic validation errors"""
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "type": "https://example.com/errors/validation-error",
            "title": "Validation Error",
            "status": 422,
            "detail": "Request validation failed",
            "error_code": ErrorCode.VALIDATION_ERROR,
            "errors": exc.errors()
        }
    )


# ============================================================================
# HEALTH CHECK
# ============================================================================

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0"
    }


# ============================================================================
# CONTACT CRUD ENDPOINTS
# ============================================================================

@app.get("/api/contacts", response_model=ContactListResponse)
async def list_contacts(
    limit: int = 50,
    offset: int = 0,
    search: Optional[str] = None,
    enrichment_status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    List contacts for current user
    
    Query Parameters:
    - limit: Max results (default 50)
    - offset: Pagination offset (default 0)
    - search: Filter by name, email, company
    - enrichment_status: Filter by pending/processing/completed/failed
    """
    try:
        user_id = UUID(current_user["uid"])
        service = ContactService()
        
        contacts, total = await service.list_contacts(
            user_id=user_id,
            limit=limit,
            offset=offset,
            search=search,
            enrichment_status=enrichment_status
        )
        
        return ContactListResponse(
            success=True,
            contacts=contacts,
            total=total,
            limit=limit,
            offset=offset
        )
    except Exception as e:
        logger.error(f"Error listing contacts: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to list contacts")


@app.get("/api/contacts/{contact_id}", response_model=ContactResponse)
async def get_contact(
    contact_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """Get single contact by ID"""
    try:
        user_id = UUID(current_user["uid"])
        service = ContactService()
        
        contact = await service.get_contact(
            contact_id=contact_id,
            user_id=user_id
        )
        
        if not contact:
            raise HTTPException(
                status_code=404,
                detail=ErrorDetail(
                    type="https://example.com/errors/not-found",
                    title="Contact Not Found",
                    status=404,
                    detail=f"Contact {contact_id} not found",
                    error_code=ErrorCode.NOT_FOUND,
                    instance=f"/api/contacts/{contact_id}"
                ).dict()
            )
        
        return contact
    except Exception as e:
        logger.error(f"Error fetching contact: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch contact")


@app.post("/api/contacts", response_model=ContactResponse, status_code=201)
async def create_contact(
    request: ContactCreateRequest,
    current_user: dict = Depends(get_current_user)
):
    """Create a new contact"""
    try:
        user_id = UUID(current_user["uid"])
        service = ContactService()
        
        contact = await service.create_contact(
            user_id=user_id,
            **request.dict()
        )
        
        return contact
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating contact: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create contact")


@app.put("/api/contacts/{contact_id}", response_model=ContactResponse)
async def update_contact(
    contact_id: UUID,
    request: ContactUpdateRequest,
    current_user: dict = Depends(get_current_user)
):
    """Update contact fields"""
    try:
        user_id = UUID(current_user["uid"])
        service = ContactService()
        
        contact = await service.update_contact(
            contact_id=contact_id,
            user_id=user_id,
            **request.dict(exclude_unset=True)
        )
        
        if not contact:
            raise HTTPException(status_code=404, detail="Contact not found")
        
        return contact
    except Exception as e:
        logger.error(f"Error updating contact: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update contact")


@app.delete("/api/contacts/{contact_id}", status_code=204)
async def delete_contact(
    contact_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """Delete a contact"""
    try:
        user_id = UUID(current_user["uid"])
        service = ContactService()
        
        success = await service.delete_contact(
            contact_id=contact_id,
            user_id=user_id
        )
        
        if not success:
            raise HTTPException(status_code=404, detail="Contact not found")
        
        return None
    except Exception as e:
        logger.error(f"Error deleting contact: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete contact")


# ============================================================================
# ENRICHMENT ROUTER INCLUSION
# ============================================================================

from enrichment_v3.api_routes import set_auth_dependency
set_auth_dependency(get_current_user)

app.include_router(enrichment_router, prefix="/api/v3", tags=["enrichment"])


# ============================================================================
# IMPORT/SYNC ENDPOINTS (PLACEHOLDER)
# ============================================================================

@app.post("/api/import/csv")
async def import_csv(
    file_contents: str,
    current_user: dict = Depends(get_current_user)
):
    """Import contacts from CSV (file contents as string)"""
    try:
        user_id = UUID(current_user["uid"])
        return {"message": "CSV import not yet implemented"}
    except Exception as e:
        logger.error(f"Error importing CSV: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to import CSV")


@app.post("/api/import/hubspot")
async def import_hubspot(
    current_user: dict = Depends(get_current_user)
):
    """Sync contacts from HubSpot"""
    try:
        user_id = UUID(current_user["uid"])
        return {"message": "HubSpot sync not yet implemented"}
    except Exception as e:
        logger.error(f"Error importing from HubSpot: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to sync HubSpot")


# ============================================================================
# STARTUP / SHUTDOWN
# ============================================================================

@app.on_event("startup")
async def startup():
    logger.info("LatticeIQ API starting up...")


@app.on_event("shutdown")
async def shutdown():
    logger.info("LatticeIQ API shutting down...")


# ============================================================================
# ROOT ENDPOINT
# ============================================================================

@app.get("/")
async def root():
    return {
        "message": "LatticeIQ Sales Intelligence API",
        "version": "1.0.0",
        "docs": "/docs"
    }
