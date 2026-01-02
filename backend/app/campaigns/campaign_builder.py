"""
CampaignBuilder - Orchestrate campaign creation with ICP targeting.

This class combines ICP matching, template selection, and variable
substitution to create personalized campaigns.

Usage:
    from app.campaigns.campaign_builder import CampaignBuilder
    
    builder = CampaignBuilder(supabase, accessor, matcher, substitutor)
    campaign_id = builder.build_campaign(
        workspace_id=workspace_id,
        icp_id=icp_id,
        template_id=template_id,
        campaign_name="Q1 Outreach"
    )
"""

from typing import List, Dict, Optional, Any
from uuid import UUID, uuid4
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class CampaignBuilder:
    """
    Orchestrate campaign creation with ICP targeting and personalization.
    
    Workflow:
    1. Match contacts to ICP (via ICPMatcher)
    2. Load email template
    3. Generate personalized emails (via VariableSubstitutor)
    4. Create campaign record
    5. Link contacts to campaign
    """
    
    def __init__(
        self,
        supabase_client,
        field_accessor,
        icp_matcher,
        variable_substitutor
    ):
        """
        Initialize CampaignBuilder.
        
        Args:
            supabase_client: Initialized Supabase client
            field_accessor: FieldAccessor instance
            icp_matcher: ICPMatcher instance
            variable_substitutor: VariableSubstitutor instance
        """
        self.supabase = supabase_client
        self.field_accessor = field_accessor
        self.icp_matcher = icp_matcher
        self.substitutor = variable_substitutor
    
    def build_campaign(
        self,
        workspace_id: UUID,
        icp_id: UUID,
        template_id: UUID,
        campaign_name: str,
        min_icp_score: int = 60,
        scheduled_at: Optional[datetime] = None
    ) -> UUID:
        """
        Create a campaign targeting contacts matching an ICP.
        
        Args:
            workspace_id: UUID of the workspace
            icp_id: UUID of the ICP to target
            template_id: UUID of the email template
            campaign_name: Human-readable campaign name
            min_icp_score: Minimum ICP score to include (default 60)
            scheduled_at: Optional scheduled send time
        
        Returns:
            UUID of the created campaign
        
        Side Effects:
            - Creates campaign record
            - Updates matched contacts with campaign_id
            - Generates personalized email subject/preview for each contact
        """
        campaign_id = uuid4()
        
        # Step 1: Find matching contacts
        matching_contacts = self.icp_matcher.find_matching_contacts(
            icp_id,
            min_score=min_icp_score,
            limit=1000
        )
        
        logger.info(f"Found {len(matching_contacts)} contacts matching ICP {icp_id}")
        
        # Step 2: Load template
        template = self._get_template(template_id)
        if not template:
            raise ValueError(f"Template not found: {template_id}")
        
        # Step 3: Create campaign record
        self.supabase.table("campaigns").insert({
            "id": str(campaign_id),
            "workspace_id": str(workspace_id),
            "name": campaign_name,
            "icp_id": str(icp_id),
            "email_template_id": str(template_id),
            "status": "draft",
            "target_count": len(matching_contacts),
            "sent_count": 0,
            "opened_count": 0,
            "clicked_count": 0,
            "replied_count": 0,
            "created_at": datetime.utcnow().isoformat(),
            "scheduled_at": scheduled_at.isoformat() if scheduled_at else None
        }).execute()
        
        # Step 4: Generate personalized content for each contact
        for contact_id in matching_contacts:
            try:
                # Substitute variables
                subject = self.substitutor.substitute(template["subject"], contact_id)
                body_preview = self.substitutor.substitute(template["body"], contact_id)[:200]
                
                # Update contact with campaign assignment
                self.supabase.table("contacts").update({
                    "campaign_id": str(campaign_id),
                    "email_subject": subject,
                    "email_body_preview": body_preview
                }).eq("id", str(contact_id)).execute()
                
            except Exception as e:
                logger.error(f"Error processing contact {contact_id}: {e}")
        
        logger.info(f"Campaign {campaign_id} created with {len(matching_contacts)} contacts")
        return campaign_id
    
    def get_campaign_preview(
        self,
        campaign_id: UUID,
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Preview personalized emails for a campaign.
        
        Args:
            campaign_id: UUID of the campaign
            limit: Number of emails to preview (default 5)
        
        Returns:
            List of preview objects:
            [
                {
                    "contact_id": "uuid",
                    "contact_name": "Garrett Golden",
                    "email_subject": "Garrett, quick question...",
                    "email_body_preview": "Hi Garrett, ...",
                    "icp_match_score": 70
                }
            ]
        """
        try:
            response = (
                self.supabase.table("contacts")
                .select("id, first_name, last_name, email, email_subject, email_body_preview, icp_match_score")
                .eq("campaign_id", str(campaign_id))
                .order("icp_match_score", desc=True)
                .limit(limit)
                .execute()
            )
            
            previews = []
            for contact in response.data:
                previews.append({
                    "contact_id": contact["id"],
                    "contact_name": f"{contact.get('first_name', '')} {contact.get('last_name', '')}".strip(),
                    "email": contact.get("email"),
                    "email_subject": contact.get("email_subject"),
                    "email_body_preview": contact.get("email_body_preview"),
                    "icp_match_score": contact.get("icp_match_score", 0)
                })
            
            return previews
            
        except Exception as e:
            logger.error(f"Error getting campaign preview: {e}")
            return []
    
    def get_campaign_stats(self, campaign_id: UUID) -> Dict[str, Any]:
        """
        Get campaign statistics.
        
        Args:
            campaign_id: UUID of the campaign
        
        Returns:
            Campaign stats including target_count, sent_count, rates, etc.
        """
        try:
            response = (
                self.supabase.table("campaigns")
                .select("*")
                .eq("id", str(campaign_id))
                .single()
                .execute()
            )
            
            campaign = response.data
            if not campaign:
                return {"error": "Campaign not found"}
            
            # Calculate rates
            target = campaign.get("target_count", 0)
            sent = campaign.get("sent_count", 0)
            opened = campaign.get("opened_count", 0)
            clicked = campaign.get("clicked_count", 0)
            replied = campaign.get("replied_count", 0)
            
            return {
                "campaign_id": str(campaign_id),
                "name": campaign.get("name"),
                "status": campaign.get("status"),
                "target_count": target,
                "sent_count": sent,
                "opened_count": opened,
                "clicked_count": clicked,
                "replied_count": replied,
                "open_rate": (opened / sent * 100) if sent > 0 else 0,
                "click_rate": (clicked / sent * 100) if sent > 0 else 0,
                "reply_rate": (replied / sent * 100) if sent > 0 else 0,
                "created_at": campaign.get("created_at"),
                "scheduled_at": campaign.get("scheduled_at")
            }
            
        except Exception as e:
            logger.error(f"Error getting campaign stats: {e}")
            return {"error": str(e)}
    
    def activate_campaign(self, campaign_id: UUID) -> bool:
        """
        Activate a draft campaign (mark ready for sending).
        
        Args:
            campaign_id: UUID of the campaign
        
        Returns:
            True if successful, False otherwise
        """
        try:
            self.supabase.table("campaigns").update({
                "status": "active",
                "scheduled_at": datetime.utcnow().isoformat()
            }).eq("id", str(campaign_id)).execute()
            
            logger.info(f"Campaign {campaign_id} activated")
            return True
            
        except Exception as e:
            logger.error(f"Error activating campaign: {e}")
            return False
    
    def _get_template(self, template_id: UUID) -> Optional[Dict[str, Any]]:
        """Fetch email template from database."""
        try:
            response = (
                self.supabase.table("email_templates")
                .select("*")
                .eq("id", str(template_id))
                .single()
                .execute()
            )
            return response.data
        except Exception as e:
            logger.error(f"Error fetching template {template_id}: {e}")
            return None
