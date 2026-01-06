# backend/app/fields/field_accessor.py
"""
FieldAccessor: Universal field access for contacts
Handles both denormalized columns and JSONB enrichment data
"""

from typing import Any, Dict, List, Optional, Union
from datetime import datetime
import json
from pydantic import BaseModel
from enum import Enum


class FieldType(str, Enum):
    """Supported field data types"""
    STRING = "string"
    NUMBER = "number"
    DATE = "date"
    BOOLEAN = "boolean"
    LIST = "list"
    OBJECT = "object"


class FieldDefinition(BaseModel):
    """Definition of an accessible field"""
    name: str
    display_name: str
    field_type: FieldType
    path: str  # Dot notation path: "enrichment_data.company_overview.industry"
    is_denormalized: bool = False
    default_value: Any = None
    description: Optional[str] = None


class FieldAccessResult(BaseModel):
    """Result of accessing a field"""
    field_name: str
    value: Any
    raw_value: Any
    field_type: FieldType
    found: bool
    path_used: str


class FieldAccessor:
    """
    Universal field accessor for contact data.
    
    Provides unified access to:
    - Denormalized columns (firstname, lastname, etc.)
    - JSONB enrichment data (enrichment_data.company_overview.industry)
    - Computed fields (full_name, days_since_contact)
    
    Usage:
        accessor = FieldAccessor()
        
        # Get a single field
        result = accessor.get_field(contact, "company_industry")
        
        # Get multiple fields
        results = accessor.get_fields(contact, ["company_industry", "funding_total"])
        
        # Get all available fields
        fields = accessor.list_available_fields(contact)
    """
    
    # ============================================================
    # FIELD REGISTRY: All accessible fields
    # ============================================================
    
    FIELD_REGISTRY: Dict[str, FieldDefinition] = {
        # Core contact fields (denormalized)
        "id": FieldDefinition(
            name="id", display_name="Contact ID", field_type=FieldType.STRING,
            path="id", is_denormalized=True
        ),
        "email": FieldDefinition(
            name="email", display_name="Email", field_type=FieldType.STRING,
            path="email", is_denormalized=True
        ),
        "firstname": FieldDefinition(
            name="firstname", display_name="First Name", field_type=FieldType.STRING,
            path="firstname", is_denormalized=True, default_value=""
        ),
        "lastname": FieldDefinition(
            name="lastname", display_name="Last Name", field_type=FieldType.STRING,
            path="lastname", is_denormalized=True, default_value=""
        ),
        "company": FieldDefinition(
            name="company", display_name="Company", field_type=FieldType.STRING,
            path="company", is_denormalized=True, default_value=""
        ),
        "job_title": FieldDefinition(
            name="job_title", display_name="Job Title", field_type=FieldType.STRING,
            path="job_title", is_denormalized=True, default_value=""
        ),
        "phone": FieldDefinition(
            name="phone", display_name="Phone", field_type=FieldType.STRING,
            path="phone", is_denormalized=True, default_value=""
        ),
        
        # Engagement fields (denormalized)
        "engagement_score": FieldDefinition(
            name="engagement_score", display_name="Engagement Score", field_type=FieldType.NUMBER,
            path="engagement_score", is_denormalized=True, default_value=0
        ),
        "engagement_status": FieldDefinition(
            name="engagement_status", display_name="Engagement Status", field_type=FieldType.STRING,
            path="engagement_status", is_denormalized=True, default_value="cold"
        ),
        "last_interaction": FieldDefinition(
            name="last_interaction", display_name="Last Interaction", field_type=FieldType.DATE,
            path="last_interaction", is_denormalized=True
        ),
        
        # Scoring fields (denormalized)
        "mdcp_score": FieldDefinition(
            name="mdcp_score", display_name="MDCP Score", field_type=FieldType.NUMBER,
            path="mdcp_score", is_denormalized=True, default_value=0
        ),
        "mdcp_tier": FieldDefinition(
            name="mdcp_tier", display_name="MDCP Tier", field_type=FieldType.STRING,
            path="mdcp_tier", is_denormalized=True, default_value="D"
        ),
        "bant_score": FieldDefinition(
            name="bant_score", display_name="BANT Score", field_type=FieldType.NUMBER,
            path="bant_score", is_denormalized=True, default_value=0
        ),
        "bant_tier": FieldDefinition(
            name="bant_tier", display_name="BANT Tier", field_type=FieldType.STRING,
            path="bant_tier", is_denormalized=True, default_value="D"
        ),
        "spice_score": FieldDefinition(
            name="spice_score", display_name="SPICE Score", field_type=FieldType.NUMBER,
            path="spice_score", is_denormalized=True, default_value=0
        ),
        "spice_tier": FieldDefinition(
            name="spice_tier", display_name="SPICE Tier", field_type=FieldType.STRING,
            path="spice_tier", is_denormalized=True, default_value="D"
        ),
        
        # Company Overview (from enrichment_data JSONB)
        "company_description": FieldDefinition(
            name="company_description", display_name="Company Description", field_type=FieldType.STRING,
            path="enrichment_data.company_overview.description"
        ),
        "company_industry": FieldDefinition(
            name="company_industry", display_name="Industry", field_type=FieldType.STRING,
            path="enrichment_data.company_overview.industry"
        ),
        "company_founded": FieldDefinition(
            name="company_founded", display_name="Founded", field_type=FieldType.STRING,
            path="enrichment_data.company_overview.founded"
        ),
        "company_headquarters": FieldDefinition(
            name="company_headquarters", display_name="Headquarters", field_type=FieldType.STRING,
            path="enrichment_data.company_overview.headquarters"
        ),
        "company_employee_count": FieldDefinition(
            name="company_employee_count", display_name="Employee Count", field_type=FieldType.STRING,
            path="enrichment_data.company_overview.employee_count"
        ),
        "company_website": FieldDefinition(
            name="company_website", display_name="Website", field_type=FieldType.STRING,
            path="enrichment_data.company_overview.website"
        ),
        
        # Market Position (from enrichment_data JSONB)
        "market_share": FieldDefinition(
            name="market_share", display_name="Market Share", field_type=FieldType.STRING,
            path="enrichment_data.market_position.market_share"
        ),
        "competitors": FieldDefinition(
            name="competitors", display_name="Competitors", field_type=FieldType.LIST,
            path="enrichment_data.market_position.competitors"
        ),
        "value_proposition": FieldDefinition(
            name="value_proposition", display_name="Value Proposition", field_type=FieldType.STRING,
            path="enrichment_data.market_position.unique_value_proposition"
        ),
        "growth_trajectory": FieldDefinition(
            name="growth_trajectory", display_name="Growth Trajectory", field_type=FieldType.STRING,
            path="enrichment_data.market_position.growth_trajectory"
        ),
        
        # Key Financials (from enrichment_data JSONB)
        "revenue": FieldDefinition(
            name="revenue", display_name="Revenue", field_type=FieldType.STRING,
            path="enrichment_data.key_financials.revenue"
        ),
        "funding_total": FieldDefinition(
            name="funding_total", display_name="Total Funding", field_type=FieldType.STRING,
            path="enrichment_data.key_financials.funding_total"
        ),
        "last_funding_round": FieldDefinition(
            name="last_funding_round", display_name="Last Funding Round", field_type=FieldType.STRING,
            path="enrichment_data.key_financials.last_funding_round"
        ),
        "valuation": FieldDefinition(
            name="valuation", display_name="Valuation", field_type=FieldType.STRING,
            path="enrichment_data.key_financials.valuation"
        ),
        
        # Executive Team (from enrichment_data JSONB)
        "ceo": FieldDefinition(
            name="ceo", display_name="CEO", field_type=FieldType.STRING,
            path="enrichment_data.executive_team.ceo"
        ),
        "cto": FieldDefinition(
            name="cto", display_name="CTO", field_type=FieldType.STRING,
            path="enrichment_data.executive_team.cto"
        ),
        "cfo": FieldDefinition(
            name="cfo", display_name="CFO", field_type=FieldType.STRING,
            path="enrichment_data.executive_team.cfo"
        ),
        "key_decision_makers": FieldDefinition(
            name="key_decision_makers", display_name="Key Decision Makers", field_type=FieldType.LIST,
            path="enrichment_data.executive_team.key_decision_makers"
        ),
        
        # Engagement Signals (from enrichment_data JSONB)
        "buying_signals": FieldDefinition(
            name="buying_signals", display_name="Buying Signals", field_type=FieldType.LIST,
            path="enrichment_data.engagement_signals.buying_signals"
        ),
        "pain_points": FieldDefinition(
            name="pain_points", display_name="Pain Points", field_type=FieldType.LIST,
            path="enrichment_data.engagement_signals.pain_points"
        ),
        "technology_stack": FieldDefinition(
            name="technology_stack", display_name="Technology Stack", field_type=FieldType.LIST,
            path="enrichment_data.engagement_signals.technology_stack"
        ),
        "recommended_approach": FieldDefinition(
            name="recommended_approach", display_name="Recommended Approach", field_type=FieldType.STRING,
            path="enrichment_data.engagement_signals.recommended_approach"
        ),
    }
    
    # ============================================================
    # COMPUTED FIELDS: Derived at runtime
    # ============================================================
    
    COMPUTED_FIELDS = {
        "full_name": lambda c: f"{c.get('firstname', '')} {c.get('lastname', '')}".strip(),
        "days_since_contact": lambda c: FieldAccessor._days_since(c.get('last_interaction')),
        "is_hot_lead": lambda c: c.get('engagement_status') == 'hot' or c.get('engagement_score', 0) >= 70,
        "avg_score": lambda c: round((
            (c.get('mdcp_score') or 0) + 
            (c.get('bant_score') or 0) + 
            (c.get('spice_score') or 0)
        ) / 3, 1),
    }
    
    # ============================================================
    # CORE METHODS
    # ============================================================
    
    @staticmethod
    def _days_since(date_value: Optional[str]) -> Optional[int]:
        """Calculate days since a date"""
        if not date_value:
            return None
        try:
            if isinstance(date_value, str):
                dt = datetime.fromisoformat(date_value.replace('Z', '+00:00'))
            else:
                dt = date_value
            return (datetime.now(dt.tzinfo) - dt).days
        except Exception:
            return None
    
    @staticmethod
    def _get_nested_value(data: Dict, path: str) -> Any:
        """
        Get a value from nested dict using dot notation.
        
        Example: _get_nested_value(contact, "enrichment_data.company_overview.industry")
        """
        keys = path.split('.')
        value = data
        
        for key in keys:
            if isinstance(value, dict):
                value = value.get(key)
            elif hasattr(value, key):
                value = getattr(value, key)
            else:
                return None
            
            if value is None:
                return None
        
        return value
    
    def get_field(
        self, 
        contact: Dict[str, Any], 
        field_name: str,
        default: Any = None
    ) -> FieldAccessResult:
        """
        Get a single field value from a contact.
        
        Args:
            contact: Contact data dictionary
            field_name: Name of the field to retrieve
            default: Default value if field not found
            
        Returns:
            FieldAccessResult with value and metadata
        """
        # Check computed fields first
        if field_name in self.COMPUTED_FIELDS:
            try:
                computed_value = self.COMPUTED_FIELDS[field_name](contact)
                return FieldAccessResult(
                    field_name=field_name,
                    value=computed_value if computed_value is not None else default,
                    raw_value=computed_value,
                    field_type=FieldType.STRING,  # Computed fields default to string
                    found=computed_value is not None,
                    path_used="[computed]"
                )
            except Exception:
                return FieldAccessResult(
                    field_name=field_name,
                    value=default,
                    raw_value=None,
                    field_type=FieldType.STRING,
                    found=False,
                    path_used="[computed:error]"
                )
        
        # Check registered fields
        if field_name in self.FIELD_REGISTRY:
            field_def = self.FIELD_REGISTRY[field_name]
            raw_value = self._get_nested_value(contact, field_def.path)
            
            # Use field default, then method default
            final_default = field_def.default_value if default is None else default
            
            return FieldAccessResult(
                field_name=field_name,
                value=raw_value if raw_value is not None else final_default,
                raw_value=raw_value,
                field_type=field_def.field_type,
                found=raw_value is not None,
                path_used=field_def.path
            )
        
        # Try direct access as fallback
        raw_value = contact.get(field_name)
        return FieldAccessResult(
            field_name=field_name,
            value=raw_value if raw_value is not None else default,
            raw_value=raw_value,
            field_type=FieldType.STRING,
            found=raw_value is not None,
            path_used=field_name
        )
    
    def get_fields(
        self, 
        contact: Dict[str, Any], 
        field_names: List[str]
    ) -> Dict[str, FieldAccessResult]:
        """
        Get multiple fields from a contact.
        
        Args:
            contact: Contact data dictionary
            field_names: List of field names to retrieve
            
        Returns:
            Dictionary mapping field names to results
        """
        return {
            field_name: self.get_field(contact, field_name)
            for field_name in field_names
        }
    
    def get_all_values(
        self, 
        contact: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Get all registered field values from a contact.
        
        Returns:
            Dictionary mapping field names to values
        """
        result = {}
        
        # Get all registered fields
        for field_name in self.FIELD_REGISTRY:
            field_result = self.get_field(contact, field_name)
            if field_result.found:
                result[field_name] = field_result.value
        
        # Get all computed fields
        for field_name in self.COMPUTED_FIELDS:
            field_result = self.get_field(contact, field_name)
            if field_result.found:
                result[field_name] = field_result.value
        
        return result
    
    def list_available_fields(self) -> List[Dict[str, Any]]:
        """
        List all available fields with metadata.
        
        Returns:
            List of field definitions
        """
        fields = []
        
        # Registered fields
        for name, field_def in self.FIELD_REGISTRY.items():
            fields.append({
                "name": name,
                "display_name": field_def.display_name,
                "type": field_def.field_type.value,
                "path": field_def.path,
                "is_denormalized": field_def.is_denormalized,
                "is_computed": False
            })
        
        # Computed fields
        for name in self.COMPUTED_FIELDS:
            fields.append({
                "name": name,
                "display_name": name.replace('_', ' ').title(),
                "type": "computed",
                "path": "[computed]",
                "is_denormalized": False,
                "is_computed": True
            })
        
        return fields
    
    def search_fields(self, query: str) -> List[Dict[str, Any]]:
        """
        Search available fields by name or display name.
        
        Args:
            query: Search string
            
        Returns:
            List of matching field definitions
        """
        query_lower = query.lower()
        all_fields = self.list_available_fields()
        
        return [
            f for f in all_fields
            if query_lower in f['name'].lower() 
            or query_lower in f['display_name'].lower()
        ]


# ============================================================
# SINGLETON INSTANCE
# ============================================================

field_accessor = FieldAccessor()


# ============================================================
# CONVENIENCE FUNCTIONS
# ============================================================

def get_contact_field(contact: Dict[str, Any], field_name: str, default: Any = None) -> Any:
    """Convenience function to get a single field value"""
    result = field_accessor.get_field(contact, field_name, default)
    return result.value


def get_contact_fields(contact: Dict[str, Any], field_names: List[str]) -> Dict[str, Any]:
    """Convenience function to get multiple field values"""
    results = field_accessor.get_fields(contact, field_names)
    return {name: r.value for name, r in results.items()}
