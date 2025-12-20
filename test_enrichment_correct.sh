#!/bin/bash
# test_enrichment_correct.sh
# Fixed: Skips CSV import, creates contacts directly + enriches

set -e

API_URL="https://latticeiq-backend.onrender.com"

echo "=== LATTICEIQ ENRICHMENT TEST (CORRECTED) ==="
echo ""

# ============================================================================
# STEP 0: Verify Authentication
# ============================================================================
echo "Step 0: Checking authentication..."
if [ -z "$JWT_TOKEN" ]; then
  echo "❌ JWT_TOKEN not set. Export it first:"
  echo "   export JWT_TOKEN=\"your_token_here\""
  exit 1
fi
echo "✅ JWT_TOKEN present"
echo ""

# ============================================================================
# STEP 1: Test Backend Health
# ============================================================================
echo "Step 1: Testing backend health..."
HEALTH=$(curl -s "$API_URL/health")
echo "Health Response: $HEALTH"
if echo "$HEALTH" | jq -e '.status' > /dev/null 2>&1; then
  echo "✅ Backend is healthy"
else
  echo "❌ Backend health check failed"
  exit 1
fi
echo ""

# ============================================================================
# STEP 2: List Existing Contacts
# ============================================================================
echo "Step 2: Listing existing contacts..."
EXISTING=$(curl -s -X GET "$API_URL/api/contacts" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json")

echo "Response (raw):"
echo "$EXISTING" | head -c 200
echo ""
echo ""

# Try to parse as JSON
if echo "$EXISTING" | jq '.' > /dev/null 2>&1; then
  COUNT=$(echo "$EXISTING" | jq 'length')
  echo "✅ Successfully fetched contacts (count: $COUNT)"
else
  echo "⚠️  Could not parse response as JSON"
  echo "Full response:"
  echo "$EXISTING"
fi
echo ""

# ============================================================================
# STEP 3: Create Test Contact (Direct POST)
# ============================================================================
echo "Step 3: Creating test contact..."
CREATE_RESPONSE=$(curl -s -X POST "$API_URL/api/contacts" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "firstname": "Test",
    "lastname": "User",
    "email": "test.user@example.com",
    "company": "Test Company",
    "title": "VP Sales",
    "phone": "+1-555-1234"
  }')

echo "Create Response:"
echo "$CREATE_RESPONSE" | jq '.'
echo ""

# Extract contact ID
CONTACT_ID=$(echo "$CREATE_RESPONSE" | jq -r '.id // .contact_id // empty' 2>/dev/null)

if [ -z "$CONTACT_ID" ] || [ "$CONTACT_ID" = "null" ]; then
  echo "❌ Failed to create contact or extract ID"
  echo "Response was: $CREATE_RESPONSE"
  exit 1
fi

echo "✅ Contact created with ID: $CONTACT_ID"
echo ""

# ============================================================================
# STEP 4: Verify Contact Created
# ============================================================================
echo "Step 4: Verifying contact was created..."
GET_RESPONSE=$(curl -s -X GET "$API_URL/api/contacts/$CONTACT_ID" \
  -H "Authorization: Bearer $JWT_TOKEN")

echo "Get Contact Response:"
echo "$GET_RESPONSE" | jq '.'
echo ""

if echo "$GET_RESPONSE" | jq -e '.id' > /dev/null 2>&1; then
  echo "✅ Contact verified"
else
  echo "⚠️  Could not verify contact"
fi
echo ""

# ============================================================================
# STEP 5: Trigger Enrichment
# ============================================================================
echo "Step 5: Triggering enrichment for contact $CONTACT_ID..."
ENRICH_REQUEST="{\"contact_id\": \"$CONTACT_ID\", \"synthesize\": true}"
echo "Request payload: $ENRICH_REQUEST"
echo ""

ENRICH_RESPONSE=$(curl -s -X POST "$API_URL/api/v3/enrichment/enrich" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$ENRICH_REQUEST")

echo "Enrich Response:"
echo "$ENRICH_RESPONSE" | jq '.'
echo ""

# ============================================================================
# STEP 6: Poll Enrichment Status
# ============================================================================
echo "Step 6: Polling enrichment status (max 60 seconds)..."
echo ""

MAX_ATTEMPTS=30
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
  ATTEMPT=$((ATTEMPT + 1))
  
  STATUS_RESPONSE=$(curl -s -X GET "$API_URL/api/v3/enrichment/$CONTACT_ID/status" \
    -H "Authorization: Bearer $JWT_TOKEN")
  
  STATUS=$(echo "$STATUS_RESPONSE" | jq -r '.status // "unknown"' 2>/dev/null)
  
  echo "[$ATTEMPT/$MAX_ATTEMPTS] Status: $STATUS"
  
  if [ "$STATUS" = "completed" ]; then
    echo "✅ Enrichment completed!"
    break
  elif [ "$STATUS" = "failed" ]; then
    echo "❌ Enrichment failed!"
    echo "Full response:"
    echo "$STATUS_RESPONSE" | jq '.'
    break
  fi
  
  sleep 2
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
  echo "⚠️  Timeout: Enrichment still processing"
fi
echo ""

# ============================================================================
# STEP 7: Fetch Enrichment Profile
# ============================================================================
echo "Step 7: Fetching enrichment profile..."
PROFILE_RESPONSE=$(curl -s -X GET "$API_URL/api/v3/enrichment/$CONTACT_ID/profile" \
  -H "Authorization: Bearer $JWT_TOKEN")

echo "Profile Response (first 500 chars):"
echo "$PROFILE_RESPONSE" | jq '.' | head -c 500
echo ""
echo "..."
echo ""

if echo "$PROFILE_RESPONSE" | jq -e '.summary' > /dev/null 2>&1; then
  echo "✅ Enrichment profile retrieved successfully"
  SUMMARY=$(echo "$PROFILE_RESPONSE" | jq -r '.summary' 2>/dev/null)
  echo ""
  echo "Summary preview:"
  echo "$SUMMARY" | head -c 200
  echo "..."
else
  echo "⚠️  Could not extract summary from profile"
fi
echo ""

# ============================================================================
# STEP 8: Fetch Updated Contact
# ============================================================================
echo "Step 8: Fetching updated contact with enrichment data..."
FINAL_CONTACT=$(curl -s -X GET "$API_URL/api/contacts/$CONTACT_ID" \
  -H "Authorization: Bearer $JWT_TOKEN")

echo "Contact fields:"
echo "$FINAL_CONTACT" | jq '{
  id: .id,
  firstname: .firstname,
  lastname: .lastname,
  email: .email,
  enrichment_status: .enrichment_status,
  apex_score: .apex_score,
  enriched_at: .enriched_at
}'
echo ""

if echo "$FINAL_CONTACT" | jq -e '.enrichment_status == "completed"' > /dev/null 2>&1; then
  echo "✅ Contact enrichment_status = completed"
  SCORE=$(echo "$FINAL_CONTACT" | jq -r '.apex_score // "N/A"')
  echo "✅ APEX Score: $SCORE"
else
  echo "⚠️  Contact enrichment_status not completed"
fi
echo ""

# ============================================================================
# STEP 9: List All Contacts (Final)
# ============================================================================
echo "Step 9: Final contacts list..."
FINAL_LIST=$(curl -s -X GET "$API_URL/api/contacts" \
  -H "Authorization: Bearer $JWT_TOKEN")

echo "Total contacts:"
echo "$FINAL_LIST" | jq 'length'
echo ""

echo "Contact summary:"
echo "$FINAL_LIST" | jq '.[] | {firstname, lastname, email, enrichment_status, apex_score}'
echo ""

echo "="
echo "="
echo "✅ ENRICHMENT TEST COMPLETE!"
echo "="
