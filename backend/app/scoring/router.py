# Add these imports at the top
from .calculators import calculate_mdcp_score, calculate_bant_score, calculate_spice_score
import os
from supabase import create_client

# Initialize Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY) if SUPABASE_URL and SUPABASE_SERVICE_KEY else None

# Add this endpoint AFTER the existing GET endpoints

@router.post("/score-all")
async def score_all_contacts(
    framework: str = "mdcp",
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Score all contacts for a user using specified framework"""
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    if framework.lower() not in ["mdcp", "bant", "spice"]:
        raise HTTPException(status_code=400, detail="Invalid framework. Must be 'mdcp', 'bant', or 'spice'")
    
    try:
        # 1. Fetch all contacts for user
        response = supabase.table("contacts")\
            .select("*")\
            .eq("user_id", user["id"])\
            .execute()
        
        if not response.data:
            return {
                "framework": framework,
                "scored": 0,
                "errors": [],
                "message": "No contacts found"
            }
        
        contacts = response.data
        
        # 2. Get scoring config
        config = SCORING_CONFIGS.get(framework.lower(), {})
        
        # 3. Calculate scores for each contact
        scored_count = 0
        errors = []
        
        for contact in contacts:
            try:
                # Calculate score based on framework
                if framework.lower() == "mdcp":
                    result = calculate_mdcp_score(contact, config)
                    update_data = {
                        "mdcp_score": result["score"],
                        "mdcp_tier": result["tier"]
                    }
                elif framework.lower() == "bant":
                    result = calculate_bant_score(contact, config)
                    update_data = {
                        "bant_score": result["score"],
                        "bant_tier": result["tier"]
                    }
                else:  # spice
                    result = calculate_spice_score(contact, config)
                    update_data = {
                        "spice_score": result["score"],
                        "spice_tier": result["tier"]
                    }
                
                # Update contact in database
                supabase.table("contacts")\
                    .update(update_data)\
                    .eq("id", contact["id"])\
                    .execute()
                
                scored_count += 1
                
            except Exception as e:
                errors.append({
                    "contact_id": contact.get("id"),
                    "error": str(e)
                })
        
        return {
            "framework": framework,
            "scored": scored_count,
            "total": len(contacts),
            "errors": errors,
            "message": f"Successfully scored {scored_count}/{len(contacts)} contacts using {framework.upper()}"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scoring failed: {str(e)}")


@router.post("/{contact_id}/score")
async def score_single_contact(
    contact_id: str,
    framework: str = "mdcp",
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Score a single contact"""
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    if framework.lower() not in ["mdcp", "bant", "spice"]:
        raise HTTPException(status_code=400, detail="Invalid framework")
    
    try:
        # Fetch contact
        response = supabase.table("contacts")\
            .select("*")\
            .eq("id", contact_id)\
            .eq("user_id", user["id"])\
            .execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Contact not found")
        
        contact = response.data[0]
        config = SCORING_CONFIGS.get(framework.lower(), {})
        
        # Calculate score
        if framework.lower() == "mdcp":
            result = calculate_mdcp_score(contact, config)
            update_data = {
                "mdcp_score": result["score"],
                "mdcp_tier": result["tier"]
            }
        elif framework.lower() == "bant":
            result = calculate_bant_score(contact, config)
            update_data = {
                "bant_score": result["score"],
                "bant_tier": result["tier"]
            }
        else:
            result = calculate_spice_score(contact, config)
            update_data = {
                "spice_score": result["score"],
                "spice_tier": result["tier"]
            }
        
        # Update database
        supabase.table("contacts")\
            .update(update_data)\
            .eq("id", contact_id)\
            .execute()
        
        return {
            "contact_id": contact_id,
            "framework": framework,
            **result
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scoring failed: {str(e)}")
