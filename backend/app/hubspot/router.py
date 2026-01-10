# ============================================================================
# FILE: backend/app/hubspot/router.py
# PURPOSE: HubSpot import with validation, filtering, and stored credentials
# VERSION: 2.1.0 - Fixed >100 contacts pagination and counting
# ============================================================================

from fastapi import APIRouter, HTTPException, Depends, Header, Query
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, Field
import logging
import httpx
import uuid

from app.services.import_service import (
    ImportService, ImportFilters, ImportSource,
    ImportValidationSummary, ContactValidator, ContactNormalizer
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/hubspot", tags=["HubSpot"])


# ============================================================================
# DEPENDENCIES
# ============================================================================

def get_supabase():
    """Get Supabase client."""
    from app.main import supabase
    return supabase


async def get_current_user_id(authorization: str = Header(...)) -> str:
    """Extract user ID from JWT."""
    import jwt
    try:
        parts = authorization.split(" ", 1)
        if len(parts) != 2 or parts[0].lower() != "bearer":
            raise HTTPException(status_code=401, detail="Invalid authorization format")
        
        token = parts[1]
        payload = jwt.decode(token, options={"verify_signature": False})
        user_id = payload.get("sub")
        
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        return str(user_id)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Auth error: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")


async def get_hubspot_api_key(
    user_id: str = Depends(get_current_user_id),
    supabase=Depends(get_supabase),
    api_key: Optional[str] = Header(None, alias="X-HubSpot-API-Key")
) -> str:
    """
    Get HubSpot API key - from header OR stored credentials.
    Header takes precedence for one-off operations.
    """
    # Try header first
    if api_key:
        return api_key
    
    # Try stored credentials
    try:
        result = supabase.table("user_integrations")\
            .select("api_key, status")\
            .eq("user_id", user_id)\
            .eq("provider", "hubspot")\
            .single()\
            .execute()
        
        if result.data and result.data.get("api_key"):
            if result.data.get("status") == "error":
                raise HTTPException(
                    status_code=401,
                    detail="HubSpot connection has errors - please reconnect"
                )
            return result.data["api_key"]
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"Could not fetch stored HubSpot key: {e}")
    
    raise HTTPException(
        status_code=401,
        detail="HubSpot not connected. Go to Settings → Integrations to connect."
    )


# ============================================================================
# MODELS
# ============================================================================

class HubSpotImportRequest(BaseModel):
    """Request model for HubSpot import."""
    filters: Optional[ImportFilters] = Field(default=None)
    list_id: Optional[str] = Field(None, description="Import from specific HubSpot list")
    search_query: Optional[str] = Field(None, description="HubSpot search query")
    properties: Optional[List[str]] = Field(
        default=None,
        description="Specific properties to fetch (defaults to all standard)"
    )


class HubSpotPreviewRequest(BaseModel):
    """Preview request for HubSpot import."""
    filters: Optional[ImportFilters] = None
    list_id: Optional[str] = None
    search_query: Optional[str] = None
    sample_size: int = Field(default=10, ge=1, le=100)


class HubSpotImportResponse(BaseModel):
    """Response from HubSpot import."""
    success: bool
    import_id: str
    total_fetched: int
    total_processed: int
    imported_count: int
    skipped_count: int
    failed_count: int
    rejection_reasons: Dict[str, int]
    duration_ms: int


class HubSpotPreviewResponse(BaseModel):
    """Preview response for HubSpot import."""
    total_available: int
    sample_contacts: List[Dict[str, Any]]
    valid_count: int
    invalid_count: int
    rejection_reasons: Dict[str, int]
    available_lists: List[Dict[str, str]] = []
    available_properties: List[str] = []


# ============================================================================
# HUBSPOT CLIENT
# ============================================================================

class HubSpotImportClient:
    """HubSpot API client for imports."""
    
    BASE_URL = "https://api.hubapi.com"
    
    # HubSpot API max per page
    MAX_PAGE_SIZE = 100
    
    # Max pages to fetch (safety limit: 100 pages * 100 = 10,000 contacts)
    MAX_PAGES = 100
    
    # Standard properties to fetch
    DEFAULT_PROPERTIES = [
        "firstname", "lastname", "email", "phone", "mobilephone",
        "company", "jobtitle", "website", "linkedin_url", "hs_linkedin_url",
        "city", "state", "country", "industry", "numemployees",
        "hs_lead_status", "lifecyclestage", "hubspot_owner_id",
        "createdate", "lastmodifieddate", "notes_last_updated"
    ]
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
    
    async def get_contacts(
        self,
        limit: int = 100,
        after: Optional[str] = None,
        properties: Optional[List[str]] = None,
        list_id: Optional[str] = None,
        search_query: Optional[str] = None,
        filters: Optional[ImportFilters] = None
    ) -> Dict[str, Any]:
        """
        Fetch contacts from HubSpot with optional filtering.
        Note: HubSpot API max is 100 per page, so limit here is per-page limit.
        """
        props = properties or self.DEFAULT_PROPERTIES
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            # If searching, use search endpoint
            if search_query:
                return await self._search_contacts(client, search_query, limit, after, props)
            
            # If list_id, use list membership endpoint
            if list_id:
                return await self._get_list_contacts(client, list_id, limit, after, props)
            
            # Default: get all contacts with server-side filtering
            return await self._get_all_contacts(client, limit, after, props, filters)
    
    async def _get_all_contacts(
        self,
        client: httpx.AsyncClient,
        limit: int,
        after: Optional[str],
        properties: List[str],
        filters: Optional[ImportFilters]
    ) -> Dict[str, Any]:
        """Get all contacts with optional date filtering."""
        # HubSpot API max is 100 per page
        page_limit = min(limit, self.MAX_PAGE_SIZE)
        
        params = {
            "limit": page_limit,
            "properties": ",".join(properties)
        }
        
        if after:
            params["after"] = after
        
        # Add date filters if specified (HubSpot supports these)
        filter_groups = []
        
        if filters:
            if filters.created_after:
                filter_groups.append({
                    "filters": [{
                        "propertyName": "createdate",
                        "operator": "GTE",
                        "value": int(filters.created_after.timestamp() * 1000)
                    }]
                })
            
            if filters.modified_after:
                filter_groups.append({
                    "filters": [{
                        "propertyName": "lastmodifieddate",
                        "operator": "GTE",
                        "value": int(filters.modified_after.timestamp() * 1000)
                    }]
                })
            
            if filters.lead_statuses:
                filter_groups.append({
                    "filters": [{
                        "propertyName": "hs_lead_status",
                        "operator": "IN",
                        "values": filters.lead_statuses
                    }]
                })
            
            if filters.lifecycle_stages:
                filter_groups.append({
                    "filters": [{
                        "propertyName": "lifecyclestage",
                        "operator": "IN",
                        "values": filters.lifecycle_stages
                    }]
                })
            
            if filters.owners:
                filter_groups.append({
                    "filters": [{
                        "propertyName": "hubspot_owner_id",
                        "operator": "IN",
                        "values": filters.owners
                    }]
                })
        
        # If we have filters, use search endpoint
        if filter_groups:
            body = {
                "filterGroups": filter_groups,
                "properties": properties,
                "limit": page_limit
            }
            if after:
                body["after"] = after
            
            resp = await client.post(
                f"{self.BASE_URL}/crm/v3/objects/contacts/search",
                headers=self.headers,
                json=body
            )
        else:
            # No filters, use simple list endpoint
            resp = await client.get(
                f"{self.BASE_URL}/crm/v3/objects/contacts",
                headers=self.headers,
                params=params
            )
        
        if resp.status_code != 200:
            logger.error(f"HubSpot API error: {resp.status_code} - {resp.text}")
            raise HTTPException(
                status_code=resp.status_code,
                detail=f"HubSpot API error: {resp.text}"
            )
        
        return resp.json()
    
    async def _search_contacts(
        self,
        client: httpx.AsyncClient,
        query: str,
        limit: int,
        after: Optional[str],
        properties: List[str]
    ) -> Dict[str, Any]:
        """Search contacts by query."""
        body = {
            "query": query,
            "properties": properties,
            "limit": min(limit, self.MAX_PAGE_SIZE)
        }
        if after:
            body["after"] = after
        
        resp = await client.post(
            f"{self.BASE_URL}/crm/v3/objects/contacts/search",
            headers=self.headers,
            json=body
        )
        
        if resp.status_code != 200:
            raise HTTPException(
                status_code=resp.status_code,
                detail=f"HubSpot search error: {resp.text}"
            )
        
        return resp.json()
    
    async def _get_list_contacts(
        self,
        client: httpx.AsyncClient,
        list_id: str,
        limit: int,
        after: Optional[str],
        properties: List[str]
    ) -> Dict[str, Any]:
        """Get contacts from a specific list."""
        # First get list memberships
        params = {"limit": min(limit, self.MAX_PAGE_SIZE)}
        if after:
            params["after"] = after
        
        resp = await client.get(
            f"{self.BASE_URL}/crm/v3/lists/{list_id}/memberships",
            headers=self.headers,
            params=params
        )
        
        if resp.status_code != 200:
            raise HTTPException(
                status_code=resp.status_code,
                detail=f"HubSpot list error: {resp.text}"
            )
        
        memberships = resp.json()
        contact_ids = [str(m.get("recordId")) for m in memberships.get("results", [])]
        
        if not contact_ids:
            return {"results": [], "total": 0}
        
        # Batch get contacts
        batch_resp = await client.post(
            f"{self.BASE_URL}/crm/v3/objects/contacts/batch/read",
            headers=self.headers,
            json={
                "inputs": [{"id": cid} for cid in contact_ids],
                "properties": properties
            }
        )
        
        if batch_resp.status_code != 200:
            raise HTTPException(
                status_code=batch_resp.status_code,
                detail=f"HubSpot batch read error: {batch_resp.text}"
            )
        
        batch_data = batch_resp.json()
        
        return {
            "results": batch_data.get("results", []),
            "total": memberships.get("total", len(contact_ids)),
            "paging": memberships.get("paging")
        }
    
    async def get_lists(self) -> List[Dict[str, str]]:
        """Get available HubSpot lists."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                resp = await client.get(
                    f"{self.BASE_URL}/crm/v3/lists",
                    headers=self.headers,
                    params={"limit": 100}
                )
                
                if resp.status_code != 200:
                    return []
                
                data = resp.json()
                return [
                    {
                        "id": str(lst.get("listId")),
                        "name": lst.get("name", "Unnamed"),
                        "size": lst.get("size", 0)
                    }
                    for lst in data.get("lists", [])
                ]
            except Exception as e:
                logger.warning(f"Could not fetch HubSpot lists: {e}")
                return []
    
    async def get_total_count(self, filters: Optional[ImportFilters] = None) -> int:
        """
        Get total contact count (with optional filters).
        This paginates through all contacts to get an accurate count.
        """
        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                total = 0
                after = None
                pages = 0
                
                while pages < self.MAX_PAGES:
                    if filters and (filters.created_after or filters.modified_after or 
                                   filters.lead_statuses or filters.lifecycle_stages):
                        # Use search to get filtered count
                        result = await self._get_all_contacts(
                            client, self.MAX_PAGE_SIZE, after, ["email"], filters
                        )
                    else:
                        # Simple list endpoint
                        params = {"limit": self.MAX_PAGE_SIZE, "properties": "email"}
                        if after:
                            params["after"] = after
                        
                        resp = await client.get(
                            f"{self.BASE_URL}/crm/v3/objects/contacts",
                            headers=self.headers,
                            params=params
                        )
                        if resp.status_code != 200:
                            break
                        result = resp.json()
                    
                    # Count this page
                    page_count = len(result.get("results", []))
                    total += page_count
                    pages += 1
                    
                    # Check for more pages
                    paging = result.get("paging", {})
                    after = paging.get("next", {}).get("after")
                    
                    if not after or page_count < self.MAX_PAGE_SIZE:
                        # No more pages
                        break
                    
                    logger.debug(f"Counting contacts: page {pages}, running total {total}")
                
                logger.info(f"Total HubSpot contacts found: {total} (in {pages} pages)")
                return total
                
            except Exception as e:
                logger.error(f"Error counting contacts: {e}")
                return 0
    
    @staticmethod
    def normalize_contact(hs_contact: Dict[str, Any]) -> Dict[str, Any]:
        """Convert HubSpot contact to standard format."""
        props = hs_contact.get("properties", {})
        
        # Map HubSpot fields to standard fields
        contact = {
            "hubspot_id": hs_contact.get("id"),
            "first_name": props.get("firstname"),
            "last_name": props.get("lastname"),
            "email": props.get("email"),
            "phone": props.get("phone") or props.get("mobilephone"),
            "company": props.get("company"),
            "title": props.get("jobtitle"),
            "website": props.get("website"),
            "linkedin_url": props.get("hs_linkedin_url") or props.get("linkedin_url"),
            "city": props.get("city"),
            "state": props.get("state"),
            "country": props.get("country"),
            "industry": props.get("industry"),
            "employee_count": props.get("numemployees"),
            "lead_status": props.get("hs_lead_status"),
            "lifecycle_stage": props.get("lifecyclestage"),
            "hubspot_owner_id": props.get("hubspot_owner_id"),
            "hs_created_at": props.get("createdate"),
            "hs_updated_at": props.get("lastmodifieddate"),
        }
        
        # Clean None values
        return {k: v for k, v in contact.items() if v is not None}


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.get("/health")
async def hubspot_health():
    """Health check for HubSpot integration."""
    return {
        "status": "operational",
        "service": "hubspot",
        "version": "2.1.0",
        "features": ["import", "preview", "filtering", "lists", "stored_credentials", "pagination"]
    }


@router.get("/preview", response_model=HubSpotPreviewResponse)
async def preview_hubspot_import(
    list_id: Optional[str] = Query(None, description="HubSpot list ID"),
    search_query: Optional[str] = Query(None, description="Search query"),
    sample_size: int = Query(10, ge=1, le=100),
    require_email: bool = Query(False),
    require_company: bool = Query(False),
    user_id: str = Depends(get_current_user_id),
    api_key: str = Depends(get_hubspot_api_key),
    supabase=Depends(get_supabase)
):
    """
    Preview HubSpot import - see what contacts would be imported.
    Shows sample contacts and total available count.
    """
    client = HubSpotImportClient(api_key)
    import_service = ImportService(supabase)
    
    # Build filters
    filters = ImportFilters(
        require_email=require_email,
        require_company=require_company,
        limit=sample_size
    )
    
    # Get sample contacts
    try:
        result = await client.get_contacts(
            limit=sample_size,
            list_id=list_id,
            search_query=search_query
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"HubSpot fetch error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch from HubSpot: {e}")
    
    # Normalize contacts
    raw_contacts = [
        client.normalize_contact(c) 
        for c in result.get("results", [])
    ]
    
    # Validate
    valid_contacts, summary = import_service.process_batch(
        raw_contacts=raw_contacts,
        source=ImportSource.HUBSPOT,
        filters=filters
    )
    
    # Get lists
    lists = await client.get_lists()
    
    # Get ACCURATE total count (paginate through all contacts)
    total = await client.get_total_count(filters)
    
    return HubSpotPreviewResponse(
        total_available=total,
        sample_contacts=valid_contacts[:sample_size],
        valid_count=summary.valid_contacts,
        invalid_count=summary.rejected_contacts,
        rejection_reasons=summary.rejection_reasons,
        available_lists=lists,
        available_properties=client.DEFAULT_PROPERTIES
    )


@router.post("/import", response_model=HubSpotImportResponse)
async def import_from_hubspot(
    request: HubSpotImportRequest,
    user_id: str = Depends(get_current_user_id),
    api_key: str = Depends(get_hubspot_api_key),
    supabase=Depends(get_supabase)
):
    """
    Import contacts from HubSpot with validation and filtering.
    
    Contacts must have:
    - first_name + last_name
    - At least one of: email, phone, company, linkedin_url
    
    Use filters to narrow down which contacts to import.
    Supports importing >100 contacts via automatic pagination.
    """
    start_time = datetime.now(timezone.utc)
    import_id = str(uuid.uuid4())
    
    client = HubSpotImportClient(api_key)
    import_service = ImportService(supabase)
    
    # Get filters (use defaults if not provided)
    filters = request.filters or ImportFilters()
    
    logger.info(f"Starting HubSpot import for user {user_id}, limit: {filters.limit}")
    
    # Get existing emails for deduplication
    existing_emails = await import_service.get_existing_emails(user_id)
    
    # Create import history record
    try:
        history_record = {
            "id": import_id,
            "user_id": user_id,
            "source": "hubspot",
            "total_processed": 0,
            "imported_count": 0,
            "skipped_count": 0,
            "failed_count": 0,
            "filters_applied": filters.model_dump(),
            "status": "in_progress",
            "started_at": start_time.isoformat()
        }
        supabase.table("import_history").insert(history_record).execute()
    except Exception as e:
        logger.warning(f"Could not create import history: {e}")
    
    # Fetch and process contacts in batches
    all_valid_contacts = []
    total_fetched = 0
    total_summary = ImportValidationSummary()
    after = None
    page_count = 0
    
    try:
        # Continue fetching until we have enough valid contacts OR run out of HubSpot contacts
        while len(all_valid_contacts) < filters.limit and page_count < client.MAX_PAGES:
            page_count += 1
            
            # Fetch batch (HubSpot max is 100 per page)
            result = await client.get_contacts(
                limit=client.MAX_PAGE_SIZE,  # Always fetch full pages
                after=after,
                list_id=request.list_id,
                search_query=request.search_query,
                filters=filters,
                properties=request.properties
            )
            
            contacts = result.get("results", [])
            if not contacts:
                logger.info(f"No more contacts to fetch after page {page_count}")
                break
            
            total_fetched += len(contacts)
            logger.info(f"Page {page_count}: fetched {len(contacts)} contacts, total so far: {total_fetched}")
            
            # Normalize
            raw_contacts = [client.normalize_contact(c) for c in contacts]
            
            # Validate and filter
            valid_contacts, batch_summary = import_service.process_batch(
                raw_contacts=raw_contacts,
                source=ImportSource.HUBSPOT,
                filters=filters,
                existing_emails=existing_emails
            )
            
            # Only add contacts up to the limit
            remaining_slots = filters.limit - len(all_valid_contacts)
            all_valid_contacts.extend(valid_contacts[:remaining_slots])
            
            # Aggregate summary
            total_summary.total_processed += batch_summary.total_processed
            total_summary.valid_contacts += batch_summary.valid_contacts
            total_summary.rejected_contacts += batch_summary.rejected_contacts
            for reason, count in batch_summary.rejection_reasons.items():
                total_summary.rejection_reasons[reason] = \
                    total_summary.rejection_reasons.get(reason, 0) + count
            
            # Check for more pages
            paging = result.get("paging", {})
            after = paging.get("next", {}).get("after")
            
            if not after:
                logger.info(f"No more pages available after page {page_count}")
                break
            
            # Safety check - if we got less than a full page, we're done
            if len(contacts) < client.MAX_PAGE_SIZE:
                logger.info(f"Partial page received ({len(contacts)}), ending pagination")
                break
        
        logger.info(f"Pagination complete: {page_count} pages, {total_fetched} fetched, {len(all_valid_contacts)} valid")
        
        # Insert valid contacts
        created_ids = []
        failed_count = 0
        
        for contact in all_valid_contacts:
            try:
                contact["user_id"] = user_id
                contact["id"] = str(uuid.uuid4())
                contact["source"] = "hubspot"
                contact["created_at"] = datetime.now(timezone.utc).isoformat()
                contact["updated_at"] = contact["created_at"]
                contact["enrichment_status"] = "pending"
                contact["pipeline_stage"] = "new"
                
                result = supabase.table("contacts").insert(contact).execute()
                
                if result.data:
                    created_ids.append(contact["id"])
            except Exception as e:
                logger.error(f"Failed to insert contact: {e}")
                failed_count += 1
        
        # Calculate duration
        end_time = datetime.now(timezone.utc)
        duration_ms = int((end_time - start_time).total_seconds() * 1000)
        
        # Update import history
        try:
            supabase.table("import_history").update({
                "total_processed": total_summary.total_processed,
                "imported_count": len(created_ids),
                "skipped_count": total_summary.rejected_contacts,
                "failed_count": failed_count,
                "rejection_reasons": total_summary.rejection_reasons,
                "status": "completed",
                "completed_at": end_time.isoformat(),
                "duration_ms": duration_ms
            }).eq("id", import_id).execute()
        except Exception as e:
            logger.warning(f"Could not update import history: {e}")
        
        # Update integration stats
        try:
            supabase.table("user_integrations").update({
                "last_sync_at": end_time.isoformat(),
                "last_sync_status": "success",
                "last_sync_count": len(created_ids),
                "total_imported": supabase.rpc(
                    "increment_total_imported",
                    {"p_user_id": user_id, "p_provider": "hubspot", "p_count": len(created_ids)}
                ) if False else len(created_ids)  # RPC not implemented, just set
            }).eq("user_id", user_id).eq("provider", "hubspot").execute()
        except Exception as e:
            logger.warning(f"Could not update integration stats: {e}")
        
        logger.info(f"HubSpot import complete: {len(created_ids)} imported, {failed_count} failed, {duration_ms}ms")
        
        return HubSpotImportResponse(
            success=True,
            import_id=import_id,
            total_fetched=total_fetched,
            total_processed=total_summary.total_processed,
            imported_count=len(created_ids),
            skipped_count=total_summary.rejected_contacts,
            failed_count=failed_count,
            rejection_reasons=total_summary.rejection_reasons,
            duration_ms=duration_ms
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"HubSpot import error: {e}")
        
        # Update history with failure
        try:
            supabase.table("import_history").update({
                "status": "failed",
                "error_message": str(e),
                "completed_at": datetime.now(timezone.utc).isoformat()
            }).eq("id", import_id).execute()
        except:
            pass
        
        raise HTTPException(status_code=500, detail=f"Import failed: {e}")


@router.get("/lists")
async def get_hubspot_lists(
    api_key: str = Depends(get_hubspot_api_key)
):
    """Get available HubSpot lists for filtering."""
    client = HubSpotImportClient(api_key)
    lists = await client.get_lists()
    return {"lists": lists}


@router.get("/properties")
async def get_hubspot_properties(
    api_key: str = Depends(get_hubspot_api_key)
):
    """Get available HubSpot contact properties."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(
            f"https://api.hubapi.com/crm/v3/properties/contacts",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }
        )
        
        if resp.status_code != 200:
            raise HTTPException(
                status_code=resp.status_code,
                detail="Failed to fetch HubSpot properties"
            )
        
        data = resp.json()
        properties = [
            {
                "name": p.get("name"),
                "label": p.get("label"),
                "type": p.get("type"),
                "group": p.get("groupName")
            }
            for p in data.get("results", [])
        ]
        
        return {"properties": properties}


@router.get("/owners")
async def get_hubspot_owners(
    api_key: str = Depends(get_hubspot_api_key)
):
    """Get HubSpot owners for filtering by rep."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(
            "https://api.hubapi.com/crm/v3/owners",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }
        )
        
        if resp.status_code != 200:
            raise HTTPException(
                status_code=resp.status_code,
                detail="Failed to fetch HubSpot owners"
            )
        
        data = resp.json()
        owners = [
            {
                "id": str(o.get("id")),
                "email": o.get("email"),
                "firstName": o.get("firstName"),
                "lastName": o.get("lastName")
            }
            for o in data.get("results", [])
        ]
        
        return {"owners": owners}
