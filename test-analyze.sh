#!/bin/bash

# Test script for the analyze-text API endpoint
# Usage: ./test-analyze.sh "your-openai-api-key" "chicken caesar salad with extra dressing"

API_KEY="${1:-$OPENAI_API_KEY}"
DESCRIPTION="${2:-chicken caesar salad with croutons}"

if [ -z "$API_KEY" ]; then
    echo "Error: Please provide an OpenAI API key as the first argument or set OPENAI_API_KEY env var"
    echo "Usage: ./test-analyze.sh <api-key> <food-description>"
    exit 1
fi

echo "Testing food analysis with description: \"$DESCRIPTION\""
echo "---"

curl -s -X POST http://localhost:3000/api/analyze-text \
  -H "Content-Type: application/json" \
  -d "{
    \"apiKey\": \"$API_KEY\",
    \"description\": \"$DESCRIPTION\"
  }" | jq .

echo ""
echo "---"
echo "Check the terminal running 'npm run dev' to see detailed logs"
