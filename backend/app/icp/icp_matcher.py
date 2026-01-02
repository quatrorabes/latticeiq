"""
ICPMatcher - Match contacts to Ideal Client Profiles.

This class evaluates contacts against ICP criteria and calculates
weighted match scores (0-100).

Usage:
    from app.icp.icp_matcher import ICPMatcher
    from app.fields.field_accessor import FieldAccessor
    
    accessor = FieldAccessor(supabase_client)
    matcher = ICPMatcher(supabase_client, accessor)
    
    score = matcher.match_contact_to_icp(contact_id, icp_id)
    matches = matcher.find_matching_contacts(icp_id, min_score=60)
"""

from typing import List, Dict, Optional, Any
from uuid import UUID
import logging

logger = logging.getLogger(__name__)


class ICPMatcher:
    """
    Match contacts to Ideal Client Profiles and calculate scores.
    
    Scoring Algorithm:
    - Industry match: 30 points (configurable)
    - Persona match: 40 points (configurable)
    - Company size match: 30 points (configurable)
    
    Total: 100 points maximum
    """
    
    def __init__(self, supabase_client, field_accessor):
        """
        Initialize ICPMatcher.
        
        Args:
            supabase_client: Initialized Supabase client
            field_accessor: FieldAccessor instance for retrieving contact fields
        """
        self.supabase = supabase_client
        self.field_accessor = field_accessor
        self._icp_cache: Dict[str, Dict[str, Any]] = {}
    
    def match_contact_to_icp(self, contact_id: UUID, icp_id: UUID) -> int:
        """
        Calculate ICP match score for a single contact.
        
        Args:
            contact_id: UUID of the contact to score
            icp_id: UUID of the ICP to match against
        
        Returns:
            Score from 0-100
        
        Side Effects:
            Updates contacts.icp_match_score and contacts.icp_id in database
        """
        icp = self._get_icp(icp_id)
        if not icp:
            logger.warning(f"ICP not found: {icp_id}")
            return 0
        
        contact_fields = self.field_accessor.get_multiple_fields(
            contact_id,
            ["company_industry", "persona", "company_employees", "influence"]
        )
        
        score = self._calculate_score(contact_fields, icp)
        self._update_contact_icp(contact_id, icp_id, score)
        
        logger.info(f"Contact {contact_id} matched to ICP {icp_id} with score {score}")
        return score
    
    def find_matching_contacts(
        self,
        icp_id: UUID,
        min_score: int = 60,
        limit: int = 100
    ) -> List[UUID]:
        """
        Find all contacts matching an ICP above a score threshold.
        
        Args:
            icp_id: UUID of the ICP to match
            min_score: Minimum score to include (default 60)
            limit: Maximum contacts to return (default 100)
        
        Returns:
            List of contact UUIDs sorted by score DESC
        """
        try:
            response = (
                self.supabase.table("contacts")
                .select("id, icp_match_score")
                .eq("icp_id", str(icp_id))
                .gte("icp_match_score", min_score)
                .order("icp_match_score", desc=True)
                .limit(limit)
                .execute()
            )
            
            return [UUID(row["id"]) for row in response.data]
            
        except Exception as e:
            logger.error(f"Error finding matching contacts: {e}")
            return []
    
    def bulk_match_contacts(
        self,
        icp_id: UUID,
        contact_ids: List[UUID]
    ) -> Dict[UUID, int]:
        """
        Batch process multiple contacts against an ICP.
        
        More efficient for large datasets as it loads ICP once.
        
        Args:
            icp_id: UUID of the ICP
            contact_ids: List of contact UUIDs to score
        
        Returns:
            Dict mapping contact_id -> score
        """
        results = {}
        
        icp = self._get_icp(icp_id)
        if not icp:
            logger.warning(f"ICP not found for bulk match: {icp_id}")
            return {cid: 0 for cid in contact_ids}
        
        for contact_id in contact_ids:
            contact_fields = self.field_accessor.get_multiple_fields(
                contact_id,
                ["company_industry", "persona", "company_employees", "influence"]
            )
            score = self._calculate_score(contact_fields, icp)
            self._update_contact_icp(contact_id, icp_id, score)
            results[contact_id] = score
        
        logger.info(f"Bulk matched {len(contact_ids)} contacts to ICP {icp_id}")
        return results
    
    def _get_icp(self, icp_id: UUID) -> Optional[Dict[str, Any]]:
        """Fetch ICP from database or cache."""
        icp_id_str = str(icp_id)
        
        if icp_id_str in self._icp_cache:
            return self._icp_cache[icp_id_str]
        
        try:
            response = (
                self.supabase.table("ideal_client_profiles")
                .select("*")
                .eq("id", icp_id_str)
                .single()
                .execute()
            )
            
            if response.data:
                self._icp_cache[icp_id_str] = response.data
                return response.data
            
            return None
            
        except Exception as e:
            logger.error(f"Error fetching ICP {icp_id}: {e}")
            return None
    
    def _calculate_score(self, contact_fields: Dict[str, Optional[str]], icp: Dict[str, Any]) -> int:
        """
        Calculate weighted ICP match score with fuzzy matching.
        
        Scoring:
        - Industry match: 30 points (default)
        - Persona match: 40 points (default)
        - Company size match: 30 points (default)
        """
        score = 0
        max_score = 0
        
        criteria = icp.get("criteria", {})
        weights = icp.get("scoring_weights", {})
        
        # Industry match with fuzzy logic (default 30 points)
        target_industries = criteria.get("industries", [])
        if target_industries:
            industry_weight = weights.get("industry_weight", 30)
            max_score += industry_weight
            
            contact_industry = contact_fields.get("company_industry")
            if self._match_industry(contact_industry, target_industries):
                score += industry_weight
                logger.debug(f"Industry match: {contact_industry}")
        
        # Persona match with fuzzy logic (default 40 points)
        target_personas = criteria.get("personas", [])
        if target_personas:
            persona_weight = weights.get("persona_weight", 40)
            max_score += persona_weight
            
            contact_persona = contact_fields.get("persona")
            if self._match_persona(contact_persona, target_personas):
                score += persona_weight
                logger.debug(f"Persona match: {contact_persona}")
        
        # Company size match (default 30 points)
        min_size = criteria.get("min_company_size")
        max_size = criteria.get("max_company_size", 999999)
        if min_size is not None:
            size_weight = weights.get("company_size_weight", 30)
            max_score += size_weight
            
            employees_str = contact_fields.get("company_employees")
            if employees_str:
                try:
                    employees = self._parse_employee_count(employees_str)
                    if employees and min_size <= employees <= max_size:
                        score += size_weight
                        logger.debug(f"Company size match: {employees}")
                except (ValueError, TypeError):
                    pass
        
        # Calculate percentage if we have criteria
        if max_score > 0:
            final_score = int((score / max_score) * 100)
        else:
            final_score = 0
        
        return min(final_score, 100)
    
    def _match_industry(self, contact_industry: Optional[str], icp_industries: List[str]) -> bool:
        """Match industry with fuzzy/substring logic."""
        if not contact_industry or not icp_industries:
            return False
        
        contact_industry_lower = contact_industry.lower().strip()
        
        for icp_industry in icp_industries:
            icp_lower = icp_industry.lower().strip()
            
            # Exact match
            if contact_industry_lower == icp_lower:
                return True
            
            # Substring match (either direction)
            if icp_lower in contact_industry_lower or contact_industry_lower in icp_lower:
                return True
            
            # Word-level match (e.g., "Technology" matches "Technology & Software")
            contact_words = set(contact_industry_lower.split())
            icp_words = set(icp_lower.split())
            if contact_words & icp_words:  # Any word overlap
                return True
        
        return False
    
    def _match_persona(self, contact_persona: Optional[str], icp_personas: List[str]) -> bool:
        """Match persona with fuzzy/substring logic."""
        if not contact_persona or not icp_personas:
            return False
        
        contact_persona_lower = contact_persona.lower().strip()
        
        for icp_persona in icp_personas:
            icp_lower = icp_persona.lower().strip()
            
            # Exact match
            if contact_persona_lower == icp_lower:
                return True
            
            # Substring match (either direction)
            if icp_lower in contact_persona_lower or contact_persona_lower in icp_lower:
                return True
            
            # Keyword match (e.g., "Manager" in "Senior Vice President" won't match, but "VP" would)
            # Check for common role keywords
            keywords = ["executive", "manager", "director", "vp", "president", "ceo", "cfo", "cto", "decision"]
            for keyword in keywords:
                if keyword in contact_persona_lower and keyword in icp_lower:
                    return True
        
        return False
    
    def _parse_employee_count(self, value: str) -> Optional[int]:
        """Parse employee count from various formats."""
        if not value:
            return None
        
        value = str(value).strip().lower()
        
        # Handle "50+" format
        if value.endswith("+"):
            return int(value[:-1])
        
        # Handle "50-200" format (take midpoint)
        if "-" in value:
            parts = value.split("-")
            return (int(parts[0]) + int(parts[1])) // 2
        
        # Handle plain number
        return int(value)
    
    def _update_contact_icp(self, contact_id: UUID, icp_id: UUID, score: int):
        """Update contact with ICP match results."""
        try:
            self.supabase.table("contacts").update({
                "icp_id": str(icp_id),
                "icp_match_score": score
            }).eq("id", str(contact_id)).execute()
        except Exception as e:
            logger.error(f"Error updating contact ICP: {e}")
    
    def clear_cache(self):
        """Clear ICP cache."""
        self._icp_cache.clear()
