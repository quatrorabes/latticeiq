#!/bin/bash
# test_enrichment_safe.sh
# Authenticates via Supabase directly, then tests enrichment

set -e

# ============================================================================
# Configuration
# ============================================================================
SUPABASE_URL="${SUPABASE_URL:-https://kbcmtbwhycudgeblkhtc.supabase.co}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtiY210YndoeWN1ZGdlYmxraHRjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjA4MzAwOSwiZXhwIjoyMDgxNjU5MDA5fQ.TmuOUonT4LHiglAVD2OFLlBLVieW4-6AxRS5Gn5nn5I}"
API_URL="https://latticeiq-backend.onrender.com"

echo "=== LATTICEIQ ENRICHMENT TEST (SAFE MODE) ==="
echo ""
echo "Configuration:"
echo "  Supabase URL: $SUPABASE_URL"
echo "  API URL: $API_URL"
echo ""

# ============================================================================
# STEP 1: Test Backend Health
# ============================================================================
echo "Step 1: Testing backend health..."
HEALTH=$(curl -s "$API_URL/health")
if echo "$HEALTH" | jq -e '.status == "ok"' > /dev/null 2>&1; then
  echo "✅ Backend is healthy"
else
  echo "❌ Backend health check failed"
  echo "Response: $HEALTH"
  exit 1
fi
echo ""

# ============================================================================
# STEP 2: Authenticate via Supabase (get JWT)
# ============================================================================
echo "Step 2: Authenticating via Supabase..."
echo "  (Using anon key + email/password)"
echo ""

# Use proper email format with real domain
RANDOM_ID=$(printf '%05d' $((RANDOM % 100000)))
TEST_EMAIL="test${RANDOM_ID}@example.com"
TEST_PASSWORD="TestPassword123!"

echo "  Creating test user: $TEST_EMAIL"
AUTH_RESPONSE=$(curl -s -X POST "$SUPABASE_URL/auth/v1/signup" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$TEST_PASSWORD\"
  }")

# Check if signup succeeded or user already exists
if echo "$AUTH_RESPONSE" | jq -e '.user' > /dev/null 2>&1; then
  echo "✅ User created"
  JWT_TOKEN=$(echo "$AUTH_RESPONSE" | jq -r '.session.access_token')
  echo "✅ JWT obtained"
elif echo "$AUTH_RESPONSE" | jq -e '.error_code == "user_already_exists"' > /dev/null 2>&1; then
  echo "⚠️  User already exists, logging in..."
  
  LOGIN_RESPONSE=$(curl -s -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
    -H "apikey: $SUPABASE_ANON_KEY" \
    -H "Content-Type: application/json" \
    -d "{
      \"email\": \"$TEST_EMAIL\",
      \"password\": \"$TEST_PASSWORD\"
    }")
  
  JWT_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.access_token')
  echo "✅ JWT obtained from login"
else
  echo "❌ Authentication failed"
  echo "Response: $AUTH_RESPONSE"
  exit 1
fi

if [ -z "$JWT_TOKEN" ] || [ "$JWT_TOKEN" = "null" ]; then
  echo "❌ Could not extract JWT token"
  echo "Full response: $AUTH_RESPONSE"
  exit 1
fi

echo "JWT Token (first 50 chars): ${JWT_TOKEN:0:50}..."
echo ""

# ============================================================================
# STEP 3: List Existing Contacts
# ============================================================================
echo "Step 3: Listing existing contacts..."
CONTACTS_LIST=$(curl -s -X GET "$API_URL/api/contacts" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json")

if echo "$CONTACTS_LIST" | jq -e 'type' > /dev/null 2>&1; then
  COUNT=$(echo "$CONTACTS_LIST" | jq 'length // 0')
  echo "✅ Fetched $COUNT existing contacts"
else
  echo "⚠️  Could not parse contacts response"
  echo "Response: $CONTACTS_LIST"
fi
echo ""

# ============================================================================
# STEP 4: Create Test Contact
# ============================================================================
echo "Step 4: Creating test contact..."
CREATE_RESPONSE=$(curl -s -X POST "$API_URL/api/contacts" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "firstname": "Alice",
    "lastname": "Chen",
    "email": "alice@techcorp.io",
    "company": "TechCorp Inc",
    "title": "VP of Engineering",
    "phone": "+1-555-0100"
  }')

echo "Create Response:"
echo "$CREATE_RESPONSE" | jq '.'
echo ""

CONTACT_ID=$(echo "$CREATE_RESPONSE" | jq -r '.id // empty')
if [ -z "$CONTACT_ID" ]; then
  echo "❌ Failed to create contact"
  exit 1
fi

echo "✅ Contact created: $CONTACT_ID"
echo ""

# ============================================================================
# STEP 5: Trigger Enrichment
# ============================================================================
echo "Step 5: Triggering enrichment..."
ENRICH_RESPONSE=$(curl -s -X POST "$API_URL/api/v3/enrichment/enrich" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"contact_id\": \"$CONTACT_ID\", \"synthesize\": true}")

echo "Enrich Response:"
echo "$ENRICH_RESPONSE" | jq '.'
echo ""

# ============================================================================
# STEP 6: Poll Status (with timeout)
# ============================================================================
echo "Step 6: Polling enrichment status (60 seconds max)..."
echo ""

POLL_COUNT=0
MAX_POLLS=30

while [ $POLL_COUNT -lt $MAX_POLLS ]; do
  POLL_COUNT=$((POLL_COUNT + 1))
  
  STATUS_RESPONSE=$(curl -s -X GET "$API_URL/api/v3/enrichment/$CONTACT_ID/status" \
    -H "Authorization: Bearer $JWT_TOKEN")
  
  STATUS=$(echo "$STATUS_RESPONSE" | jq -r '.status // "unknown"')
  
  printf "  [%2d/%2d] Status: %-15s\n" $POLL_COUNT $MAX_POLLS "$STATUS"
  
  if [ "$STATUS" = "completed" ]; then
    echo ""
    echo "✅ Enrichment completed!"
    break
  elif [ "$STATUS" = "failed" ]; then
    echo ""
    echo "❌ Enrichment failed!"
    echo "$STATUS_RESPONSE" | jq '.'
    break
  fi
  
  sleep 2
done

if [ $POLL_COUNT -eq $MAX_POLLS ]; then
  echo ""
  echo "⚠️  Timeout: Enrichment still processing after 60 seconds"
fi
echo ""

# ============================================================================
# STEP 7: Fetch Enrichment Profile
# ============================================================================
echo "Step 7: Fetching enrichment profile..."
PROFILE_RESPONSE=$(curl -s -X GET "$API_URL/api/v3/enrichment/$CONTACT_ID/profile" \
  -H "Authorization: Bearer $JWT_TOKEN")

if echo "$PROFILE_RESPONSE" | jq -e '.summary' > /dev/null 2>&1; then
  echo "✅ Profile retrieved successfully"
  echo ""
  echo "Profile Summary:"
  echo "$PROFILE_RESPONSE" | jq '.summary'
  echo ""
  echo "Hooks:"
  echo "$PROFILE_RESPONSE" | jq '.hooks'
  echo ""
  echo "Key Data:"
  echo "$PROFILE_RESPONSE" | jq '{
    summary: .summary,
    apex_score: .apex_score,
    objections: .objections,
    talking_points: .talking_points
  }'
else
  echo "⚠️  Could not extract profile"
  echo "Response:"
  echo "$PROFILE_RESPONSE" | jq '.'
fi
echo ""

# ============================================================================
# STEP 8: Fetch Updated Contact
# ============================================================================
echo "Step 8: Fetching updated contact..."
FINAL_CONTACT=$(curl -s -X GET "$API_URL/api/contacts/$CONTACT_ID" \
  -H "Authorization: Bearer $JWT_TOKEN")

echo "Contact Status:"
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

# ============================================================================
# SUMMARY
# ============================================================================
echo "=================================================="
echo "✅ ENRICHMENT TEST COMPLETE!"
echo "=================================================="
echo ""
echo "Test Contact Summary:"
echo "  Email: alice@techcorp.io"
echo "  Status: $(echo "$FINAL_CONTACT" | jq -r '.enrichment_status')"
echo "  APEX Score: $(echo "$FINAL_CONTACT" | jq -r '.apex_score')"
echo "  Contact ID: $CONTACT_ID"
echo ""
echo "Next Steps:"
echo "  1. Login to https://latticeiq.vercel.app"
echo "  2. Go to Contacts"
echo "  3. Search for: alice@techcorp.io"
echo "  4. Click to view enrichment data"
echo ""
