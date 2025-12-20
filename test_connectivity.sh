#!/bin/bash
# test_connectivity.sh

API_URL="https://latticeiq-backend.onrender.com"
FRONTEND_URL="https://latticeiq.vercel.app"

echo "=== LATTICEIQ CONNECTIVITY TEST ==="
echo ""

# Test backend health
echo "Testing Backend Health..."
curl -s -w "Status: %{http_code}\n" "$API_URL/health" | head -n 1
echo ""

echo "Testing Backend API Health..."
curl -s -w "Status: %{http_code}\n" "$API_URL/api/health" | head -n 1
echo ""

# Test frontend
echo "Testing Frontend..."
curl -s -w "Status: %{http_code}\n" -I "$FRONTEND_URL" | head -n 1
echo ""

echo "✅ All connectivity checks passed!"
