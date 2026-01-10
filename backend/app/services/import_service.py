# ============================================================================
# FILE: backend/app/services/import_service.py
# PURPOSE: Unified import validation, filtering, and contact processing
# ============================================================================

from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime, timezone
from pydantic import BaseModel, Field
from enum import Enum
import logging
import re

logger = logging.getLogger(__name__)


# ============================================================================
# ENUMS & MODELS
# ============================================================================

class ImportSource(str, Enum):
    CSV = "csv"
    HUBSPOT = "hubspot"
    SALESFORCE = "salesforce"
    PIPEDRIVE = "pipedrive"
    GOOGLE_CONTACTS = "google_contacts"
    MICROSOFT_CONTACTS = "microsoft_contacts"


class ImportFilters(BaseModel):
    """Filters applied during import"""
    # Date filters
    created_after: Optional[datetime] = Field(None, description="Only contacts created after this date")
    created_before: Optional[datetime] = Field(None, description="Only contacts created before this date")
    modified_after: Optional[datetime] = Field(None, description="Only contacts modified after this date")
    modified_before: Optional[datetime] = Field(None, description="Only contacts modified before this date")
    
    # Required fields (user can customize)
    require_email: bool = Field(default=False, description="Contact must have email")
    require_phone: bool = Field(default=False, description="Contact must have phone")
    require_company: bool = Field(default=False, description="Contact must have company")
    require_linkedin: bool = Field(default=False, description="Contact must have LinkedIn URL")
    
    # Company filters
    min_company_size: Optional[int] = Field(None, ge=1, description="Minimum employee count")
    max_company_size: Optional[int] = Field(None, ge=1, description="Maximum employee count")
    industries: Optional[List[str]] = Field(None, description="Filter by industries")
    
    # CRM-specific filters
    lead_statuses: Optional[List[str]] = Field(None, description="Filter by lead status")
    lifecycle_stages: Optional[List[str]] = Field(None, description="Filter by lifecycle stage")
    owners: Optional[List[str]] = Field(None, description="Filter by owner/rep IDs")
    tags: Optional[List[str]] = Field(None, description="Filter by tags/lists")
    
    # Import limits
    limit: int = Field(default=500, ge=1, le=10000, description="Max contacts to import")
    skip_duplicates: bool = Field(default=True, description="Skip contacts that already exist")


class ContactValidationResult(BaseModel):
    """Result of validating a single contact"""
    is_valid: bool
    contact_data: Optional[Dict[str, Any]] = None
    rejection_reason: Optional[str] = None
    fields_populated: int = 0


class ImportValidationSummary(BaseModel):
    """Summary of import validation"""
    total_processed: int = 0
    valid_contacts: int = 0
    rejected_contacts: int = 0
    rejection_reasons: Dict[str, int] = {}  # reason -> count


# ============================================================================
# MINIMUM REQUIREMENTS VALIDATOR
# ============================================================================

class ContactValidator:
    """
    Validates contacts meet minimum requirements for enrichment.
    
    Requirements:
    - MUST have: first_name + last_name
    - PLUS at least ONE of: email, phone, company, linkedin_url
    """
    
    REQUIRED_NAME_FIELDS = ["first_name", "last_name"]
    ENRICHMENT_IDENTIFIER_FIELDS = ["email", "phone", "company", "linkedin_url"]
    
    @classmethod
    def validate_minimum_requirements(cls, contact: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """
        Check if contact meets minimum requirements for enrichment.
        
        Returns:
            Tuple of (is_valid, rejection_reason)
        """
        # Check required name fields
        first_name = cls._get_field(contact, ["first_name", "firstname", "first"])
        last_name = cls._get_field(contact, ["last_name", "lastname", "last", "surname"])
        
        if not first_name or not last_name:
            missing = []
            if not first_name:
                missing.append("first_name")
            if not last_name:
                missing.append("last_name")
            return False, f"Missing required name fields: {', '.join(missing)}"
        
        # Check at least one enrichment identifier
        email = cls._get_field(contact, ["email", "email_address", "e-mail"])
        phone = cls._get_field(contact, ["phone", "phone_number", "mobile", "telephone"])
        company = cls._get_field(contact, ["company", "company_name", "organization"])
        linkedin = cls._get_field(contact, ["linkedin_url", "linkedin", "linkedin_profile"])
        
        has_identifier = any([email, phone, company, linkedin])
        
        if not has_identifier:
            return False, "Missing enrichment identifier (need at least one of: email, phone, company, linkedin_url)"
        
        # Validate email format if present
        if email and not cls._is_valid_email(email):
            return False, f"Invalid email format: {email}"
        
        # Validate LinkedIn URL if present
        if linkedin and not cls._is_valid_linkedin(linkedin):
            # Try to fix it
            fixed_linkedin = cls._normalize_linkedin_url(linkedin)
            if fixed_linkedin:
                contact["linkedin_url"] = fixed_linkedin
            else:
                return False, f"Invalid LinkedIn URL: {linkedin}"
        
        return True, None
    
    @classmethod
    def validate_with_filters(
        cls, 
        contact: Dict[str, Any], 
        filters: ImportFilters
    ) -> Tuple[bool, Optional[str]]:
        """
        Validate contact against minimum requirements AND user-specified filters.
        """
        # First check minimum requirements
        is_valid, reason = cls.validate_minimum_requirements(contact)
        if not is_valid:
            return is_valid, reason
        
        # Check user-specified required fields
        if filters.require_email:
            email = cls._get_field(contact, ["email", "email_address"])
            if not email:
                return False, "Filter requires email but none provided"
        
        if filters.require_phone:
            phone = cls._get_field(contact, ["phone", "phone_number", "mobile"])
            if not phone:
                return False, "Filter requires phone but none provided"
        
        if filters.require_company:
            company = cls._get_field(contact, ["company", "company_name"])
            if not company:
                return False, "Filter requires company but none provided"
        
        if filters.require_linkedin:
            linkedin = cls._get_field(contact, ["linkedin_url", "linkedin"])
            if not linkedin:
                return False, "Filter requires LinkedIn URL but none provided"
        
        # Check company size filters
        if filters.min_company_size or filters.max_company_size:
            size = cls._get_numeric_field(contact, ["employee_count", "company_size", "numemployees"])
            if size is not None:
                if filters.min_company_size and size < filters.min_company_size:
                    return False, f"Company size {size} below minimum {filters.min_company_size}"
                if filters.max_company_size and size > filters.max_company_size:
                    return False, f"Company size {size} above maximum {filters.max_company_size}"
        
        # Check industry filter
        if filters.industries:
            industry = cls._get_field(contact, ["industry"])
            if industry:
                industry_lower = industry.lower()
                if not any(ind.lower() in industry_lower for ind in filters.industries):
                    return False, f"Industry '{industry}' not in allowed list"
        
        # Check lead status filter
        if filters.lead_statuses:
            status = cls._get_field(contact, ["lead_status", "hs_lead_status"])
            if status and status.lower() not in [s.lower() for s in filters.lead_statuses]:
                return False, f"Lead status '{status}' not in allowed list"
        
        # Check lifecycle stage filter
        if filters.lifecycle_stages:
            stage = cls._get_field(contact, ["lifecycle_stage", "lifecyclestage"])
            if stage and stage.lower() not in [s.lower() for s in filters.lifecycle_stages]:
                return False, f"Lifecycle stage '{stage}' not in allowed list"
        
        return True, None
    
    @classmethod
    def _get_field(cls, contact: Dict[str, Any], field_names: List[str]) -> Optional[str]:
        """Get field value from contact, checking multiple possible field names."""
        for name in field_names:
            value = contact.get(name)
            if value and str(value).strip():
                return str(value).strip()
        return None
    
    @classmethod
    def _get_numeric_field(cls, contact: Dict[str, Any], field_names: List[str]) -> Optional[int]:
        """Get numeric field value from contact."""
        for name in field_names:
            value = contact.get(name)
            if value:
                try:
                    return int(float(str(value).replace(",", "")))
                except (ValueError, TypeError):
                    continue
        return None
    
    @classmethod
    def _is_valid_email(cls, email: str) -> bool:
        """Basic email validation."""
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        return bool(re.match(pattern, email.strip()))
    
    @classmethod
    def _is_valid_linkedin(cls, url: str) -> bool:
        """Check if LinkedIn URL is valid."""
        url = url.strip().lower()
        return "linkedin.com" in url or len(url) < 100  # Allow handles
    
    @classmethod
    def _normalize_linkedin_url(cls, url: str) -> Optional[str]:
        """Normalize LinkedIn URL to full format."""
        url = url.strip()
        
        if not url:
            return None
        
        # Already a full URL
        if url.startswith("http"):
            return url.replace("http://", "https://")
        
        # Has linkedin.com but no protocol
        if "linkedin.com" in url.lower():
            return f"https://{url}"
        
        # Just a username/handle
        if "/" not in url and len(url) < 100:
            return f"https://www.linkedin.com/in/{url}"
        
        return None


# ============================================================================
# CONTACT NORMALIZER
# ============================================================================

class ContactNormalizer:
    """Normalizes contact data from various sources to unified schema."""
    
    # Standard field mapping
    FIELD_ALIASES = {
        "first_name": ["firstname", "first", "given_name", "givenname"],
        "last_name": ["lastname", "last", "surname", "family_name", "familyname"],
        "email": ["email_address", "e-mail", "mail", "emailaddress"],
        "phone": ["phone_number", "telephone", "mobile", "cell", "mobilephone"],
        "company": ["company_name", "organization", "org", "employer"],
        "title": ["job_title", "jobtitle", "position", "role"],
        "linkedin_url": ["linkedin", "linkedin_profile", "linkedinurl", "hs_linkedin_url"],
        "website": ["url", "company_website", "web"],
        "city": ["locality"],
        "state": ["region", "province"],
        "country": ["country_name"],
        "industry": ["company_industry"],
        "employee_count": ["company_size", "numemployees", "employees"],
    }
    
    @classmethod
    def normalize(cls, raw_contact: Dict[str, Any], source: ImportSource) -> Dict[str, Any]:
        """
        Normalize raw contact data to standard schema.
        """
        normalized = {}
        
        # Map all fields using aliases
        for standard_field, aliases in cls.FIELD_ALIASES.items():
            # Check standard field name first
            value = raw_contact.get(standard_field)
            
            # Then check aliases
            if not value:
                for alias in aliases:
                    value = raw_contact.get(alias)
                    if value:
                        break
            
            if value and str(value).strip():
                normalized[standard_field] = str(value).strip()
        
        # Add metadata
        now = datetime.now(timezone.utc).isoformat()
        normalized["source"] = source.value
        normalized["created_at"] = now
        normalized["updated_at"] = now
        normalized["enrichment_status"] = "pending"
        normalized["pipeline_stage"] = "new"
        
        # Normalize specific fields
        if "linkedin_url" in normalized:
            normalized["linkedin_url"] = ContactValidator._normalize_linkedin_url(
                normalized["linkedin_url"]
            ) or normalized["linkedin_url"]
        
        if "email" in normalized:
            normalized["email"] = normalized["email"].lower()
        
        return normalized
    
    @classmethod
    def count_populated_fields(cls, contact: Dict[str, Any]) -> int:
        """Count how many meaningful fields are populated."""
        exclude = {"id", "created_at", "updated_at", "source", "user_id", "workspace_id",
                   "hubspot_id", "salesforce_id", "pipedrive_id", "enrichment_status", "pipeline_stage"}
        return sum(
            1 for k, v in contact.items()
            if k not in exclude and v and str(v).strip()
        )


# ============================================================================
# IMPORT SERVICE
# ============================================================================

class ImportService:
    """
    Unified import service for all sources.
    Handles validation, filtering, normalization, and deduplication.
    """
    
    def __init__(self, supabase_client):
        self.supabase = supabase_client
        self.validator = ContactValidator()
        self.normalizer = ContactNormalizer()
    
    async def get_existing_emails(self, user_id: str) -> set:
        """Get set of existing email addresses for deduplication."""
        try:
            result = self.supabase.table("contacts")\
                .select("email")\
                .eq("user_id", user_id)\
                .execute()
            
            return {
                c["email"].lower() 
                for c in (result.data or []) 
                if c.get("email")
            }
        except Exception as e:
            logger.error(f"Failed to fetch existing emails: {e}")
            return set()
    
    def validate_contact(
        self, 
        raw_contact: Dict[str, Any],
        source: ImportSource,
        filters: Optional[ImportFilters] = None
    ) -> ContactValidationResult:
        """
        Validate and normalize a single contact.
        """
        # Normalize first
        normalized = self.normalizer.normalize(raw_contact, source)
        
        # Validate
        if filters:
            is_valid, reason = self.validator.validate_with_filters(normalized, filters)
        else:
            is_valid, reason = self.validator.validate_minimum_requirements(normalized)
        
        if not is_valid:
            return ContactValidationResult(
                is_valid=False,
                rejection_reason=reason
            )
        
        # Count fields
        fields_count = self.normalizer.count_populated_fields(normalized)
        
        return ContactValidationResult(
            is_valid=True,
            contact_data=normalized,
            fields_populated=fields_count
        )
    
    def process_batch(
        self,
        raw_contacts: List[Dict[str, Any]],
        source: ImportSource,
        filters: Optional[ImportFilters] = None,
        existing_emails: Optional[set] = None
    ) -> Tuple[List[Dict[str, Any]], ImportValidationSummary]:
        """
        Process a batch of contacts with validation and filtering.
        
        Returns:
            Tuple of (valid_contacts, summary)
        """
        filters = filters or ImportFilters()
        existing_emails = existing_emails or set()
        
        valid_contacts = []
        summary = ImportValidationSummary()
        
        for raw_contact in raw_contacts:
            summary.total_processed += 1
            
            # Check limit
            if len(valid_contacts) >= filters.limit:
                break
            
            # Validate
            result = self.validate_contact(raw_contact, source, filters)
            
            if not result.is_valid:
                summary.rejected_contacts += 1
                reason = result.rejection_reason or "Unknown"
                summary.rejection_reasons[reason] = summary.rejection_reasons.get(reason, 0) + 1
                continue
            
            # Check duplicate
            email = result.contact_data.get("email", "").lower()
            if email and filters.skip_duplicates and email in existing_emails:
                summary.rejected_contacts += 1
                summary.rejection_reasons["Duplicate email"] = \
                    summary.rejection_reasons.get("Duplicate email", 0) + 1
                continue
            
            # Add to valid list
            valid_contacts.append(result.contact_data)
            summary.valid_contacts += 1
            
            # Track email for in-batch deduplication
            if email:
                existing_emails.add(email)
        
        return valid_contacts, summary


# ============================================================================
# FILTER PRESETS
# ============================================================================

class FilterPresets:
    """Common filter presets for quick use."""
    
    @staticmethod
    def quality_leads() -> ImportFilters:
        """High-quality leads with full contact info."""
        return ImportFilters(
            require_email=True,
            require_company=True,
            skip_duplicates=True,
            limit=500
        )
    
    @staticmethod
    def linkedin_enrichable() -> ImportFilters:
        """Contacts that can be enriched via LinkedIn."""
        return ImportFilters(
            require_linkedin=True,
            skip_duplicates=True,
            limit=500
        )
    
    @staticmethod
    def enterprise_only() -> ImportFilters:
        """Large enterprise contacts only."""
        return ImportFilters(
            require_email=True,
            require_company=True,
            min_company_size=500,
            skip_duplicates=True,
            limit=500
        )
    
    @staticmethod
    def smb_only() -> ImportFilters:
        """Small-medium business contacts."""
        return ImportFilters(
            require_email=True,
            max_company_size=500,
            skip_duplicates=True,
            limit=500
        )
    
    @staticmethod
    def recent_activity(days: int = 30) -> ImportFilters:
        """Recently modified contacts."""
        from datetime import timedelta
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        return ImportFilters(
            modified_after=cutoff,
            skip_duplicates=True,
            limit=500
        )
