"""
FieldAccessor - Unified field value retrieval for LatticeIQ contacts.

This class provides a single interface to get any contact field value,
checking denormalized columns first (fast) and falling back to JSONB (flexible).

Usage:
    from app.fields.field_accessor import FieldAccessor
    
    accessor = FieldAccessor(supabase_client)
    company = accessor.get_field(contact_id, "company_name")
    fields = accessor.get_multiple_fields(contact_id, ["company_name", "persona", "urgency"])
"""

from typing import Optional, Dict, List, Any
from uuid import UUID
import logging

logger = logging.getLogger(__name__)


class FieldAccessor:
    """
    Unified API for retrieving contact field values.
    
    Architecture:
    1. Check denormalized column (FAST: ~5ms)
    2. Fallback to enrichment_data JSONB (SLOWER: ~50ms)
    3. Fallback to hubspot_metadata JSONB (SLOWEST: ~100ms)
    
    Caches contact data in-memory to avoid repeated queries for same contact.
    """
    
    # Field name → denormalized column mapping
    FIELD_MAP = {
        # Core contact fields
        "first_name": "first_name",
        "last_name": "last_name",
        "email": "email",
        "company": "company",
        "phone": "phone",
        "job_title": "job_title",
        
        # Enrichment fields (denormalized)
        "company_name": "enrichment_company_name",
        "company_industry": "enrichment_company_industry",
        "company_revenue": "enrichment_company_revenue",
        "company_employees": "enrichment_company_employees",
        "person_title": "enrichment_person_title",
        "person_background": "enrichment_person_background",
        "company_growth": "enrichment_company_growth_yoy",
        "data_quality_score": "enrichment_data_quality_score",
        
        # Kernel analysis fields (denormalized)
        "persona": "kernel_who_persona",
        "influence": "kernel_who_influence",
        "urgency": "kernel_when_urgency",
        "timing_signal": "kernel_when_timing_signal",
        "hook": "kernel_what_hook",
        
        # Content fields
        "email_subject": "email_subject",
        "email_preview": "email_body_preview",
        "best_call_variant": "best_call_variant_number",
        
        # Product/ICP fields
        "product": "assigned_product",
        "icp_score": "icp_match_score",
    }
    
    # JSONB fallback paths (column, *keys)
    JSONB_FALLBACK = {
        "company_name": [
            ("enrichment_data", "company_name"),
            ("enrichment_data", "quick_enrich", "company_name"),
            ("hubspot_metadata", "hs_company_name"),
        ],
        "company_industry": [
            ("enrichment_data", "industry"),
            ("enrichment_data", "quick_enrich", "industry"),
        ],
        "company_revenue": [
            ("enrichment_data", "revenue"),
            ("enrichment_data", "quick_enrich", "revenue"),
        ],
        "person_title": [
            ("enrichment_data", "job_title"),
            ("enrichment_data", "quick_enrich", "job_title"),
            ("hubspot_metadata", "jobtitle"),
        ],
        "persona": [
            ("enrichment_data", "persona_type"),
            ("enrichment_data", "quick_enrich", "persona_type"),
            ("kernel_analysis", "who", "persona"),
        ],
        "urgency": [
            ("enrichment_data", "urgency"),
            ("kernel_analysis", "when", "urgency"),
        ],
        "hook": [
            ("enrichment_data", "hook"),
            ("kernel_analysis", "what", "hook"),
        ],
    }
    
    def __init__(self, supabase_client):
        """
        Initialize FieldAccessor with Supabase client.
        
        Args:
            supabase_client: Initialized Supabase client instance
        """
        self.supabase = supabase_client
        self._cache: Dict[str, Dict[str, Any]] = {}  # contact_id -> contact data
    
    def get_field(self, contact_id: UUID, field_name: str) -> Optional[str]:
        """
        Get single field value for a contact.
        
        Checks denormalized column first, then falls back to JSONB.
        Results are cached for repeated access to same contact.
        
        Args:
            contact_id: UUID of the contact
            field_name: Name of the field to retrieve (e.g., "company_name", "persona")
        
        Returns:
            Field value as string, or None if not found
        
        Example:
            >>> accessor.get_field(contact_id, "company_name")
            "Wells Fargo"
        """
        contact_id_str = str(contact_id)
        
        # Get contact data (from cache or DB)
        contact = self._get_contact(contact_id)
        if not contact:
            logger.warning(f"Contact not found: {contact_id}")
            return None
        
        # Try denormalized column first
        column_name = self.FIELD_MAP.get(field_name)
        if column_name:
            value = contact.get(column_name)
            if value is not None and value != "":
                return str(value)
        
        # Try JSONB fallback paths
        value = self._get_jsonb_value(contact, field_name)
        if value is not None:
            return str(value)
        
        logger.debug(f"Field '{field_name}' not found for contact {contact_id}")
        return None
    
    def get_multiple_fields(self, contact_id: UUID, field_names: List[str]) -> Dict[str, Optional[str]]:
        """
        Batch fetch multiple fields for a contact.
        
        More efficient than calling get_field() multiple times since
        it only fetches the contact once.
        
        Args:
            contact_id: UUID of the contact
            field_names: List of field names to retrieve
        
        Returns:
            Dict mapping field_name -> value (or None if not found)
        
        Example:
            >>> accessor.get_multiple_fields(contact_id, ["first_name", "company_name", "persona"])
            {"first_name": "Garrett", "company_name": "Wells Fargo", "persona": "Manager"}
        """
        result = {}
        for field_name in field_names:
            result[field_name] = self.get_field(contact_id, field_name)
        return result
    
    def get_all_available_fields(self, contact_id: UUID) -> Dict[str, str]:
        """
        Get all non-null fields for a contact.
        
        Useful for template variable previews and debugging.
        
        Args:
            contact_id: UUID of the contact
        
        Returns:
            Dict of all available field_name -> value pairs (excludes None values)
        
        Example:
            >>> accessor.get_all_available_fields(contact_id)
            {"first_name": "Garrett", "company_name": "Wells Fargo", ...}
        """
        result = {}
        
        for field_name in self.FIELD_MAP.keys():
            value = self.get_field(contact_id, field_name)
            if value is not None:
                result[field_name] = value
        
        return result
    
    def _get_contact(self, contact_id: UUID) -> Optional[Dict[str, Any]]:
        """
        Fetch contact from database or cache.
        
        Caches result to avoid repeated queries for same contact.
        """
        contact_id_str = str(contact_id)
        
        # Check cache first
        if contact_id_str in self._cache:
            return self._cache[contact_id_str]
        
        # Fetch from database
        try:
            response = (
                self.supabase.table("contacts")
                .select("*")
                .eq("id", contact_id_str)
                .single()
                .execute()
            )
            
            if response.data:
                self._cache[contact_id_str] = response.data
                return response.data
            
            return None
            
        except Exception as e:
            logger.error(f"Error fetching contact {contact_id}: {e}")
            return None
    
    def _get_jsonb_value(self, contact: Dict[str, Any], field_name: str) -> Optional[str]:
        """
        Try to extract value from JSONB columns using fallback paths.
        """
        paths = self.JSONB_FALLBACK.get(field_name, [])
        
        for path in paths:
            column_name = path[0]
            keys = path[1:]
            
            # Get the JSONB column
            jsonb_data = contact.get(column_name)
            if not isinstance(jsonb_data, dict):
                continue
            
            # Navigate the path
            value = jsonb_data
            for key in keys:
                if isinstance(value, dict):
                    value = value.get(key)
                else:
                    value = None
                    break
            
            if value is not None and value != "":
                return str(value)
        
        return None
    
    def clear_cache(self):
        """Clear the in-memory cache."""
        self._cache.clear()
    
    def clear_contact_cache(self, contact_id: UUID):
        """Clear cache for a specific contact."""
        contact_id_str = str(contact_id)
        if contact_id_str in self._cache:
            del self._cache[contact_id_str]
