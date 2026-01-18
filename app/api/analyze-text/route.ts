import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { description, apiKey, answers } = await request.json();

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 400 }
      );
    }

    if (!description) {
      return NextResponse.json(
        { error: 'Description is required' },
        { status: 400 }
      );
    }

    // Build the prompt
    let prompt = `You are a nutrition expert. Analyze this food description and extract nutritional information.

User's description: "${description}"

${answers ? `User provided these clarifications:
${Object.entries(answers).map(([id, answer]) => `- ${id}: ${answer}`).join('\n')}
` : ''}

Return a JSON object with this exact structure:
{
  "foods": [
    {
      "name": "descriptive name of the food item",
      "nutrition": {
        "calories": number,
        "protein": number (grams),
        "carbs": number (grams),
        "fat": number (grams)
      },
      "confidence": number (0-100)
    }
  ],
  "clarifyingQuestions": [
    {
      "id": "unique_snake_case_id",
      "question": "the question to ask",
      "options": [
        {"label": "Option 1", "value": "option1"},
        {"label": "Option 2", "value": "option2"},
        {"label": "Option 3", "value": "option3"}
      ]
    }
  ]
}

Guidelines:
- Parse EACH food item mentioned separately
- Be specific with names (e.g., "Grilled Chicken Sandwich" not just "sandwich")
- If portion size is unclear, ask about it
- If preparation method is unclear and affects calories significantly, ask
- If a drink size is mentioned vaguely, ask for clarification
- Only include clarifyingQuestions if you need more info for accuracy
- If the user already provided answers, don't ask those questions again
- Round all numbers to whole values
- Common reference portions:
  - Small fries: ~230 cal, Medium: ~340 cal, Large: ~490 cal
  - Small soda: ~150 cal, Medium: ~210 cal, Large: ~310 cal
  - Chicken sandwich: ~400-500 cal depending on preparation`;

    // Use GPT-4o for text analysis
    console.log('[analyze-text] Calling OpenAI API...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1500,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('[analyze-text] OpenAI error:', error);
      return NextResponse.json(
        { error: error.error?.message || 'Failed to analyze text' },
        { status: response.status }
      );
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    console.log('[analyze-text] Got response, parsing...');

    if (!content) {
      console.error('[analyze-text] No content in response');
      return NextResponse.json(
        { error: 'No response from AI' },
        { status: 500 }
      );
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[analyze-text] Could not parse JSON from:', content.substring(0, 200));
      return NextResponse.json(
        { error: 'Could not parse AI response' },
        { status: 500 }
      );
    }

    console.log('[analyze-text] Success');
    return NextResponse.json(JSON.parse(jsonMatch[0]));
  } catch (error) {
    console.error('Text analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze food description' },
      { status: 500 }
    );
  }
}
