"""
Phase 2B API Router - ICP, Campaigns, and Template Endpoints
"""

from fastapi import APIRouter, HTTPException, Header, Query, Depends
from typing import Optional, List
from uuid import UUID, uuid4
from datetime import datetime
import logging
import time
import os

from supabase import create_client, Client

from app.schemas.phase2 import (
    ICPCreateRequest, ICPUpdateRequest, ICPResponse, ICPListResponse,
    BulkMatchRequest, BulkMatchResponse, ContactMatchResult,
    MatchingContactsRequest, MatchingContactsResponse,
    CampaignCreateRequest, CampaignResponse, CampaignListResponse,
    CampaignPreviewResponse, CampaignPreviewContact, CampaignActivateResponse,
    TemplatePreviewRequest, TemplatePreviewResponse, AvailableVariablesResponse,
    FieldValueRequest, FieldValueResponse,
    SuccessResponse, ErrorResponse, HealthResponse,
    CampaignStatus, ICPTier
)

from app.fields.field_accessor import FieldAccessor
from app.icp.icp_matcher import ICPMatcher
from app.templates.variable_substitutor import VariableSubstitutor
from app.campaigns.campaign_builder import CampaignBuilder

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v3", tags=["Phase 2B - ICP & Campaigns"])

_supabase_client: Optional[Client] = None

def get_supabase() -> Client:
    global _supabase_client
    if _supabase_client is None:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_ANON_KEY") or os.getenv("SUPABASE_SERVICE_KEY")
        if not url or not key:
            raise HTTPException(status_code=500, detail="Supabase not configured")
        _supabase_client = create_client(url, key)
    return _supabase_client

def get_supabase_client() -> Client:
    return get_supabase()

def get_workspace_id(authorization: str = Header(None)) -> UUID:
    return UUID("11111111-1111-1111-1111-111111111111")

def get_field_accessor(supabase: Client = Depends(get_supabase_client)) -> FieldAccessor:
    return FieldAccessor(supabase)

def get_icp_matcher(supabase: Client = Depends(get_supabase_client), field_accessor: FieldAccessor = Depends(get_field_accessor)) -> ICPMatcher:
    return ICPMatcher(supabase, field_accessor)

def get_variable_substitutor(field_accessor: FieldAccessor = Depends(get_field_accessor)) -> VariableSubstitutor:
    return VariableSubstitutor(field_accessor)

def get_campaign_builder(supabase: Client = Depends(get_supabase_client), field_accessor: FieldAccessor = Depends(get_field_accessor), icp_matcher: ICPMatcher = Depends(get_icp_matcher), substitutor: VariableSubstitutor = Depends(get_variable_substitutor)) -> CampaignBuilder:
    return CampaignBuilder(supabase, field_accessor, icp_matcher, substitutor)

@router.get("/phase2/health", response_model=HealthResponse)
async def phase2_health_check():
    return HealthResponse(status="ok", phase2b_services={"field_accessor": "operational", "icp_matcher": "operational", "variable_substitutor": "operational", "campaign_builder": "operational"}, timestamp=datetime.utcnow())

@router.post("/icps", response_model=ICPResponse, status_code=201)
async def create_icp(request: ICPCreateRequest, workspace_id: UUID = Depends(get_workspace_id), supabase: Client = Depends(get_supabase_client)):
    try:
        icp_id = uuid4()
        now = datetime.utcnow().isoformat()
        scoring_weights_dict = request.scoring_weights.dict() if request.scoring_weights else {"industry_weight": 30, "persona_weight": 40, "company_size_weight": 30}
        response = supabase.table("ideal_client_profiles").insert({"id": str(icp_id), "workspace_id": str(workspace_id), "name": request.name, "description": request.description, "criteria": request.criteria.dict(), "scoring_weights": scoring_weights_dict, "is_active": request.is_active, "created_at": now, "updated_at": now}).execute()
        if not response.data:
            raise HTTPException(status_code=500, detail="Failed to create ICP")
        return ICPResponse(id=icp_id, workspace_id=workspace_id, name=request.name, description=request.description, criteria=request.criteria.dict(), scoring_weights=scoring_weights_dict, is_active=request.is_active, created_at=datetime.fromisoformat(now), updated_at=datetime.fromisoformat(now))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/icps", response_model=ICPListResponse)
async def list_icps(active_only: bool = Query(default=False), workspace_id: UUID = Depends(get_workspace_id), supabase: Client = Depends(get_supabase_client)):
    try:
        query = supabase.table("ideal_client_profiles").select("*").eq("workspace_id", str(workspace_id)).order("created_at", desc=True)
        if active_only:
            query = query.eq("is_active", True)
        response = query.execute()
        icps = [ICPResponse(id=UUID(row["id"]), workspace_id=UUID(row["workspace_id"]), name=row["name"], description=row.get("description"), criteria=row.get("criteria", {}), scoring_weights=row.get("scoring_weights", {}), is_active=row.get("is_active", True), created_at=datetime.fromisoformat(row["created_at"]) if row.get("created_at") else datetime.utcnow(), updated_at=datetime.fromisoformat(row["updated_at"]) if row.get("updated_at") else None) for row in response.data]
        return ICPListResponse(icps=icps, total=len(icps))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/icps/{icp_id}", response_model=ICPResponse)
async def get_icp(icp_id: UUID, workspace_id: UUID = Depends(get_workspace_id), supabase: Client = Depends(get_supabase_client)):
    try:
        response = supabase.table("ideal_client_profiles").select("*").eq("id", str(icp_id)).eq("workspace_id", str(workspace_id)).single().execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="ICP not found")
        row = response.data
        return ICPResponse(id=UUID(row["id"]), workspace_id=UUID(row["workspace_id"]), name=row["name"], description=row.get("description"), criteria=row.get("criteria", {}), scoring_weights=row.get("scoring_weights", {}), is_active=row.get("is_active", True), created_at=datetime.fromisoformat(row["created_at"]) if row.get("created_at") else datetime.utcnow(), updated_at=datetime.fromisoformat(row["updated_at"]) if row.get("updated_at") else None)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/icps/{icp_id}", response_model=ICPResponse)
async def update_icp(icp_id: UUID, request: ICPUpdateRequest, workspace_id: UUID = Depends(get_workspace_id), supabase: Client = Depends(get_supabase_client)):
    try:
        update_data = {"updated_at": datetime.utcnow().isoformat()}
        if request.name is not None:
            update_data["name"] = request.name
        if request.description is not None:
            update_data["description"] = request.description
        if request.criteria is not None:
            update_data["criteria"] = request.criteria.dict()
        if request.scoring_weights is not None:
            update_data["scoring_weights"] = request.scoring_weights.dict()
        if request.is_active is not None:
            update_data["is_active"] = request.is_active
        response = supabase.table("ideal_client_profiles").update(update_data).eq("id", str(icp_id)).eq("workspace_id", str(workspace_id)).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="ICP not found")
        return await get_icp(icp_id, workspace_id, supabase)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/icps/{icp_id}", response_model=SuccessResponse)
async def delete_icp(icp_id: UUID, workspace_id: UUID = Depends(get_workspace_id), supabase: Client = Depends(get_supabase_client)):
    try:
        supabase.table("contacts").update({"icp_id": None, "icp_match_score": None}).eq("icp_id", str(icp_id)).execute()
        supabase.table("ideal_client_profiles").delete().eq("id", str(icp_id)).eq("workspace_id", str(workspace_id)).execute()
        return SuccessResponse(success=True, message=f"ICP {icp_id} deleted")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/icps/{icp_id}/matches", response_model=MatchingContactsResponse)
async def get_icp_matches(icp_id: UUID, min_score: int = Query(default=60, ge=0, le=100), limit: int = Query(default=100, ge=1, le=1000), workspace_id: UUID = Depends(get_workspace_id), supabase: Client = Depends(get_supabase_client)):
    try:
        icp_response = supabase.table("ideal_client_profiles").select("name").eq("id", str(icp_id)).single().execute()
        if not icp_response.data:
            raise HTTPException(status_code=404, detail="ICP not found")
        contacts_response = supabase.table("contacts").select("id, first_name, last_name, email, company, job_title, icp_match_score, kernel_who_persona, enrichment_company_industry").eq("workspace_id", str(workspace_id)).eq("icp_id", str(icp_id)).gte("icp_match_score", min_score).order("icp_match_score", desc=True).limit(limit).execute()
        contacts = [{"id": row["id"], "name": f"{row.get('first_name', '')} {row.get('last_name', '')}".strip(), "email": row.get("email"), "company": row.get("company"), "job_title": row.get("job_title"), "icp_match_score": row.get("icp_match_score", 0)} for row in contacts_response.data]
        return MatchingContactsResponse(icp_id=icp_id, icp_name=icp_response.data["name"], min_score=min_score, contacts=contacts, total_matches=len(contacts))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/icps/{icp_id}/match", response_model=BulkMatchResponse)
async def bulk_match_contacts(icp_id: UUID, request: BulkMatchRequest, workspace_id: UUID = Depends(get_workspace_id), supabase: Client = Depends(get_supabase_client), icp_matcher: ICPMatcher = Depends(get_icp_matcher)):
    try:
        start_time = time.time()
        if request.contact_ids:
            contact_ids = request.contact_ids[:request.limit]
        else:
            response = supabase.table("contacts").select("id").eq("workspace_id", str(workspace_id)).limit(request.limit).execute()
            contact_ids = [UUID(row["id"]) for row in response.data]
        results = []
        for contact_id in contact_ids:
            score = icp_matcher.match_contact_to_icp(contact_id, icp_id)
            tier = ICPTier.hot if score >= 70 else ICPTier.warm if score >= 40 else ICPTier.cold
            if score >= request.min_score:
                results.append(ContactMatchResult(contact_id=contact_id, icp_id=icp_id, score=score, tier=tier, matched_criteria={}))
        return BulkMatchResponse(icp_id=icp_id, total_processed=len(contact_ids), matches_found=len(results), results=results, processing_time_ms=int((time.time() - start_time) * 1000))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/campaigns", response_model=CampaignResponse, status_code=201)
async def create_campaign(request: CampaignCreateRequest, workspace_id: UUID = Depends(get_workspace_id), campaign_builder: CampaignBuilder = Depends(get_campaign_builder), supabase: Client = Depends(get_supabase_client)):
    try:
        campaign_id = campaign_builder.build_campaign(workspace_id=workspace_id, icp_id=request.icp_id, template_id=request.email_template_id, campaign_name=request.name, min_icp_score=request.min_icp_score, scheduled_at=request.scheduled_at)
        response = supabase.table("campaigns").select("*").eq("id", str(campaign_id)).single().execute()
        row = response.data
        return CampaignResponse(id=UUID(row["id"]), workspace_id=UUID(row["workspace_id"]), name=row["name"], icp_id=UUID(row["icp_id"]), email_template_id=UUID(row["email_template_id"]), status=CampaignStatus(row["status"]), target_count=row.get("target_count", 0), sent_count=row.get("sent_count", 0), opened_count=row.get("opened_count", 0), clicked_count=row.get("clicked_count", 0), replied_count=row.get("replied_count", 0), open_rate=0.0, click_rate=0.0, reply_rate=0.0, created_at=datetime.fromisoformat(row["created_at"]), scheduled_at=datetime.fromisoformat(row["scheduled_at"]) if row.get("scheduled_at") else None, sent_at=None, completed_at=None)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/campaigns", response_model=CampaignListResponse)
async def list_campaigns(status: Optional[CampaignStatus] = Query(default=None), workspace_id: UUID = Depends(get_workspace_id), supabase: Client = Depends(get_supabase_client)):
    try:
        query = supabase.table("campaigns").select("*").eq("workspace_id", str(workspace_id)).order("created_at", desc=True)
        if status:
            query = query.eq("status", status.value)
        response = query.execute()
        campaigns = []
        for row in response.data:
            sent = row.get("sent_count", 0)
            campaigns.append(CampaignResponse(id=UUID(row["id"]), workspace_id=UUID(row["workspace_id"]), name=row["name"], icp_id=UUID(row["icp_id"]), email_template_id=UUID(row["email_template_id"]), status=CampaignStatus(row["status"]), target_count=row.get("target_count", 0), sent_count=sent, opened_count=row.get("opened_count", 0), clicked_count=row.get("clicked_count", 0), replied_count=row.get("replied_count", 0), open_rate=(row.get("opened_count", 0) / sent * 100) if sent > 0 else 0.0, click_rate=(row.get("clicked_count", 0) / sent * 100) if sent > 0 else 0.0, reply_rate=(row.get("replied_count", 0) / sent * 100) if sent > 0 else 0.0, created_at=datetime.fromisoformat(row["created_at"]), scheduled_at=datetime.fromisoformat(row["scheduled_at"]) if row.get("scheduled_at") else None, sent_at=datetime.fromisoformat(row["sent_at"]) if row.get("sent_at") else None, completed_at=datetime.fromisoformat(row["completed_at"]) if row.get("completed_at") else None))
        return CampaignListResponse(campaigns=campaigns, total=len(campaigns))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/campaigns/{campaign_id}", response_model=CampaignPreviewResponse)
async def get_campaign_preview(campaign_id: UUID, preview_limit: int = Query(default=5, ge=1, le=20), workspace_id: UUID = Depends(get_workspace_id), supabase: Client = Depends(get_supabase_client), campaign_builder: CampaignBuilder = Depends(get_campaign_builder)):
    try:
        campaign_response = supabase.table("campaigns").select("*").eq("id", str(campaign_id)).eq("workspace_id", str(workspace_id)).single().execute()
        if not campaign_response.data:
            raise HTTPException(status_code=404, detail="Campaign not found")
        previews = campaign_builder.get_campaign_preview(campaign_id, limit=preview_limit)
        preview_contacts = [CampaignPreviewContact(contact_id=UUID(p["contact_id"]), contact_name=p["contact_name"], email=p.get("email"), email_subject=p.get("email_subject", ""), email_body_preview=p.get("email_body_preview", ""), icp_match_score=p.get("icp_match_score", 0)) for p in previews]
        return CampaignPreviewResponse(campaign_id=campaign_id, campaign_name=campaign_response.data["name"], template_name="Template", total_targets=campaign_response.data.get("target_count", 0), previews=preview_contacts)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/campaigns/{campaign_id}/activate", response_model=CampaignActivateResponse)
async def activate_campaign(campaign_id: UUID, workspace_id: UUID = Depends(get_workspace_id), supabase: Client = Depends(get_supabase_client), campaign_builder: CampaignBuilder = Depends(get_campaign_builder)):
    try:
        campaign_response = supabase.table("campaigns").select("status, target_count").eq("id", str(campaign_id)).eq("workspace_id", str(workspace_id)).single().execute()
        if not campaign_response.data:
            raise HTTPException(status_code=404, detail="Campaign not found")
        if campaign_response.data["status"] != "draft":
            raise HTTPException(status_code=400, detail=f"Campaign is already {campaign_response.data['status']}")
        campaign_builder.activate_campaign(campaign_id)
        return CampaignActivateResponse(campaign_id=campaign_id, status=CampaignStatus.active, activated_at=datetime.utcnow(), target_count=campaign_response.data["target_count"], message="Campaign activated")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/templates/preview", response_model=TemplatePreviewResponse)
async def preview_template(request: TemplatePreviewRequest, supabase: Client = Depends(get_supabase_client), substitutor: VariableSubstitutor = Depends(get_variable_substitutor), field_accessor: FieldAccessor = Depends(get_field_accessor)):
    try:
        subject = None
        if request.template_id:
            preview = substitutor.preview_substitution(request.template_id, request.contact_id, supabase)
            if "error" in preview:
                raise HTTPException(status_code=404, detail=preview["error"])
            subject, body, variables_used, variables_missing = preview["subject"], preview["body"], preview["variables_used"], preview["variables_missing"]
        else:
            body = substitutor.substitute(request.template_text, request.contact_id, request.extra_values)
            validation = substitutor.validate_template(request.template_text, request.contact_id)
            variables_used = [v for v, exists in validation.items() if exists]
            variables_missing = [v for v, exists in validation.items() if not exists]
        contact_fields = field_accessor.get_multiple_fields(request.contact_id, ["first_name", "last_name"])
        contact_name = f"{contact_fields.get('first_name', '')} {contact_fields.get('last_name', '')}".strip() or "Unknown"
        return TemplatePreviewResponse(subject=subject, body=body, variables_used=variables_used, variables_missing=variables_missing, contact_name=contact_name)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/templates/variables/{contact_id}", response_model=AvailableVariablesResponse)
async def get_available_variables(contact_id: UUID, field_accessor: FieldAccessor = Depends(get_field_accessor)):
    try:
        all_fields = field_accessor.get_all_available_fields(contact_id)
        contact_name = f"{all_fields.get('first_name', '')} {all_fields.get('last_name', '')}".strip() or "Unknown"
        return AvailableVariablesResponse(contact_id=contact_id, contact_name=contact_name, available_variables=list(all_fields.keys()), variable_values=all_fields)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/fields/values", response_model=FieldValueResponse)
async def get_field_values(request: FieldValueRequest, field_accessor: FieldAccessor = Depends(get_field_accessor)):
    try:
        fields = field_accessor.get_multiple_fields(request.contact_id, request.field_names)
        return FieldValueResponse(contact_id=request.contact_id, fields=fields)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
