# CORRECTED generate_call_scripts Endpoint

```python
@router.post("/generate-call-scripts")
async def generate_call_scripts(request: GenerateCallScriptsRequest):
    """Generate DISC-optimized call script variants for a contact"""
    try:
        supabase = get_supabase()

        contact_res = supabase.table("contacts")\
            .select("*")\
            .eq("id", request.contact_id)\
            .execute()

        if not contact_res.data:
            raise HTTPException(status_code=404, detail="Contact not found")

        contact = contact_res.data[0]  # ✅ FIX: Get first item, not entire list

        # Get business profile for context
        business_context = ""
        try:
            profile_res = supabase.table("business_profiles")\
                .select("*")\
                .eq("is_default", True)\
                .execute()
            
            if profile_res.data and len(profile_res.data) > 0:
                bp = profile_res.data[0]  # ✅ FIX: Get first item, not entire list
                
                # Handle both dict and object types from Supabase
                if isinstance(bp, dict):
                    company_name = bp.get('company_name', '')
                    what_you_do = bp.get('what_you_do', '')
                    value_prop = bp.get('primary_value_prop', '')
                else:
                    company_name = getattr(bp, 'company_name', '')
                    what_you_do = getattr(bp, 'what_you_do', '')
                    value_prop = getattr(bp, 'primary_value_prop', '')
                
                if company_name or what_you_do or value_prop:
                    business_context = f"{company_name} - {what_you_do}. Value: {value_prop}"
        except Exception as e:
            logger.warning(f"Could not load business profile: {e}")
            business_context = ""

        # Override with request context if provided
        if request.business_context:
            business_context = request.business_context

        generator = CallScriptGenerator()
        result = generator.generate_all_scripts(contact, business_context)

        # Verify result has scripts
        if not result or "scripts" not in result:
            raise HTTPException(status_code=500, detail="Failed to generate scripts")

        # Save scripts to database
        for script in result["scripts"]:
            supabase.table("outreach_content").insert({
                "contact_id": request.contact_id,
                "content_type": "call_script",
                "variant_number": script.variant_number,
                "body": f"OPENER:\n{script.opener}\n\nBODY:\n{script.body}\n\nCLOSER:\n{script.closer}",
                "style": script.style,
                "style_description": script.style_description,
                "model_used": "perplexity/gpt-4o"
            }).execute()

        # ✅ EXPLICIT RETURN with JSONResponse for reliability
        return JSONResponse({
            "success": True,
            "contact_id": request.contact_id,
            "contact_name": result.get("contact_name", ""),
            "company": contact.get("company", "Unknown"),
            "title": contact.get("title", "Unknown"),
            "personality": result.get("personality", {}),
            "scripts": [
                {
                    "variant_number": script.variant_number,
                    "style": script.style,
                    "style_description": script.style_description,
                    "opener": script.opener,
                    "body": script.body,
                    "closer": script.closer,
                    "quality_score": getattr(script, "quality_score", 0.0),
                    "quality_notes": getattr(script, "quality_notes", "AI-generated DISC-optimized")
                }
                for script in result.get("scripts", [])
            ],
            "generated_at": result.get("generated_at", "")
        })

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating call scripts: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate call scripts: {str(e)}")
```

---

## What Was Wrong vs. What's Fixed

| Line | Issue | Fix |
|------|-------|-----|
| `contact = contact_res.data` | ❌ Assigning entire list | ✅ `contact = contact_res.data[0]` - get first item |
| `bp = profile_res.data` | ❌ Assigning entire list, can't call `.get()` on list | ✅ `bp = profile_res.data[0]` - get first item |
| Business profile handling | ❌ Calling `.get()` on list instead of dict | ✅ Extract `[0]` first, then check `isinstance(bp, dict)` |
| Error handling | ❌ Silent failures | ✅ Wrapped in try/except with logger.warning |

---

## Two Critical Changes

### 1️⃣ Line: `contact = contact_res.data`
**Before (WRONG):**
```python
contact = contact_res.data  # ❌ This is a LIST
```

**After (CORRECT):**
```python
contact = contact_res.data[0]  # ✅ Extract the first contact from the list
```

**Why:** `supabase.select().execute()` returns `.data` as a list. You need `[0]` to get the actual object.

---

### 2️⃣ Lines: Business profile lookup
**Before (WRONG):**
```python
if profile_res.data:
    bp = profile_res.data  # ❌ This is a LIST, not a dict!
    business_context = f"{bp.get('company_name', '')}"  # ❌ Lists don't have .get()
```

**After (CORRECT):**
```python
if profile_res.data and len(profile_res.data) > 0:
    bp = profile_res.data[0]  # ✅ Extract first item
    
    if isinstance(bp, dict):
        company_name = bp.get('company_name', '')  # ✅ Now it works
    else:
        company_name = getattr(bp, 'company_name', '')  # ✅ Handle object types
```

**Why:** Same issue—Supabase returns lists. Always use `[0]`.

---

## Next Steps

1. **Replace** the entire `@router.post("/generate-call-scripts")` function with the corrected version above
2. **Deploy:**
   ```bash
   git add backend/app/routers/outreach.py
   git commit -m "fix: correct list indexing in generate_call_scripts"
   git push origin main
   ```
3. **Wait 60 seconds**
4. **Test:**
   ```bash
   curl -X POST https://latticeiq-backend.onrender.com/api/v3/outreach/generate-call-scripts \
     -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsImtpZCI6IkVScERWTGI4cHVOQlhGcy8iLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL2tiY210YndveWN1ZGdlYmxraHRjLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiI5ZmIzM2QyYi01Yjg4LTQwMDYtODZjZS0xYThhMjVjNzI2ZmMiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzY3OTE1OTc1LCJpYXQiOjE3Njc5MTIzNzUsImVtYWlsIjoiY2hyaXNyYWJlbm9sZEBnbWFpbC5jb20iLCJwaG9uZSI6IiIsImFwcF9tZXRhZGF0YSI6eyJwcm92aWRlciI6ImVtYWlsIiwicHJvdmlkZXJzIjpbImVtYWlsIl19LCJ1c2VyX21ldGFkYXRhIjp7ImVtYWlsIjoiY2hyaXNyYWJlbm9sZEBnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwicGhvbmVfdmVyaWZpZWQiOmZhbHNlLCJzdWIiOiI5ZmIzM2QyYi01Yjg4LTQwMDYtODZjZS0xYThhMjVjNzI2ZmMifSwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJhYWwiOiJhYWwxIiwiYW1yIjpbeyJtZXRob2QiOiJwYXNzd29yZCIsInRpbWVzdGFtcCI6MTc2NzI4NDQ0N31dLCJzZXNzaW9uX2lkIjoiYTk5NjEwZTUtOWNmZi00YWNhLWJjMDQtNGFlMmE4Yzg5YzFiIiwiaXNfYW5vbnltb3VzIjpmYWxzZX0.MRyKdnPBDDMlPkaLQpoAhRSYhuBWYR-PBNxUdJxLdvk" \
     -H "Content-Type: application/json" \
     -d '{"contact_id":"4973fa1c-c763-4816-bd71-7f352feee24e","enrichment_data":{},"variants":3}' \
     | jq '.'
   ```

**Expected:** Full JSON response with 3 scripts, status 200 OK ✅

