"""
VariableSubstitutor - Replace {{variable}} placeholders with contact values.

This class handles template variable substitution for personalized emails
and call scripts.

Usage:
    from app.templates.variable_substitutor import VariableSubstitutor
    from app.fields.field_accessor import FieldAccessor
    
    accessor = FieldAccessor(supabase_client)
    substitutor = VariableSubstitutor(accessor)
    
    result = substitutor.substitute("Hi {{first_name}}!", contact_id)
    # "Hi Garrett!"
"""

import re
from typing import Dict, List, Optional
from uuid import UUID
import logging

logger = logging.getLogger(__name__)


class VariableSubstitutor:
    """
    Replace {{variable}} placeholders with actual contact field values.
    
    Supports:
    - Simple variables: {{first_name}}
    - Compound names: {{enrichment_company_name}}
    - Default values: {{phone|default:N/A}}
    """
    
    # Regex to find {{variable}} or {{variable|default:value}} patterns
    VARIABLE_PATTERN = re.compile(r'\{\{([a-zA-Z_][a-zA-Z0-9_]*(?:\|default:[^}]*)?)\}\}')
    
    def __init__(self, field_accessor):
        """
        Initialize VariableSubstitutor.
        
        Args:
            field_accessor: FieldAccessor instance for retrieving contact values
        """
        self.field_accessor = field_accessor
    
    def substitute(
        self,
        template_text: str,
        contact_id: UUID,
        extra_values: Optional[Dict[str, str]] = None
    ) -> str:
        """
        Replace all {{variable}} placeholders with actual values.
        
        Args:
            template_text: Text containing {{variable}} placeholders
            contact_id: UUID of contact to get values from
            extra_values: Optional dict of additional values (e.g., sender name)
        
        Returns:
            Fully personalized text with all variables replaced
        
        Example:
            >>> substitutor.substitute("Hi {{first_name}}!", contact_id)
            "Hi Garrett!"
        """
        extra_values = extra_values or {}
        
        def replace_variable(match: re.Match) -> str:
            full_match = match.group(1)
            
            # Check for default value syntax: {{var|default:value}}
            if "|default:" in full_match:
                var_name, default_value = full_match.split("|default:", 1)
            else:
                var_name = full_match
                default_value = ""
            
            var_name = var_name.strip()
            
            # Check extra_values first
            if var_name in extra_values:
                return extra_values[var_name]
            
            # Get from contact fields
            value = self.field_accessor.get_field(contact_id, var_name)
            
            if value is not None and value != "":
                return value
            
            # Use default or return placeholder indicator
            if default_value:
                return default_value
            
            logger.warning(f"Variable '{var_name}' not found for contact {contact_id}")
            return f"[{var_name}]"  # Visible indicator of missing variable
        
        return self.VARIABLE_PATTERN.sub(replace_variable, template_text)
    
    def extract_variables(self, template_text: str) -> List[str]:
        """
        Extract all variable names from template.
        
        Args:
            template_text: Text containing {{variable}} placeholders
        
        Returns:
            List of variable names (without braces)
        
        Example:
            >>> substitutor.extract_variables("Hi {{first_name}} at {{company_name}}")
            ["first_name", "company_name"]
        """
        matches = self.VARIABLE_PATTERN.findall(template_text)
        
        # Strip default values if present
        variables = []
        for match in matches:
            var_name = match.split("|default:")[0].strip()
            variables.append(var_name)
        
        return variables
    
    def validate_template(
        self,
        template_text: str,
        contact_id: UUID
    ) -> Dict[str, bool]:
        """
        Check which variables can be filled for a specific contact.
        
        Args:
            template_text: Text containing {{variable}} placeholders
            contact_id: UUID of contact to validate against
        
        Returns:
            Dict mapping variable_name -> True if value exists, False if missing
        
        Example:
            >>> substitutor.validate_template("Hi {{first_name}} {{phone}}", contact_id)
            {"first_name": True, "phone": False}
        """
        variables = self.extract_variables(template_text)
        result = {}
        
        for var_name in variables:
            value = self.field_accessor.get_field(contact_id, var_name)
            result[var_name] = value is not None and value != ""
        
        return result
    
    def preview_substitution(
        self,
        template_id: UUID,
        contact_id: UUID,
        supabase_client
    ) -> Dict[str, any]:
        """
        Preview email template with substituted variables.
        
        Args:
            template_id: UUID of email_template to preview
            contact_id: UUID of contact for personalization
            supabase_client: Supabase client for template lookup
        
        Returns:
            {
                "subject": "Personalized subject",
                "body": "Personalized body",
                "variables_used": ["first_name", "company_name"],
                "variables_missing": ["phone"]
            }
        """
        # Fetch template
        try:
            response = (
                supabase_client.table("email_templates")
                .select("subject, body")
                .eq("id", str(template_id))
                .single()
                .execute()
            )
            template = response.data
        except Exception as e:
            logger.error(f"Error fetching template {template_id}: {e}")
            return {"error": str(e)}
        
        if not template:
            return {"error": "Template not found"}
        
        # Get all variables from both subject and body
        all_variables = set(
            self.extract_variables(template["subject"]) +
            self.extract_variables(template["body"])
        )
        
        # Check which are available
        validation = self.validate_template(
            template["subject"] + template["body"],
            contact_id
        )
        
        variables_used = [v for v, exists in validation.items() if exists]
        variables_missing = [v for v, exists in validation.items() if not exists]
        
        # Generate personalized content
        subject = self.substitute(template["subject"], contact_id)
        body = self.substitute(template["body"], contact_id)
        
        return {
            "subject": subject,
            "body": body,
            "variables_used": variables_used,
            "variables_missing": variables_missing
        }
    
    def get_available_variables(self, contact_id: UUID) -> List[str]:
        """
        List all variables available for a contact.
        
        Useful for template editor autocomplete.
        
        Args:
            contact_id: UUID of the contact
        
        Returns:
            List of variable names that have values for this contact
        """
        all_fields = self.field_accessor.get_all_available_fields(contact_id)
        return list(all_fields.keys())
