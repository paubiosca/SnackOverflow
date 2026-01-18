import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { imageData, apiKey, previousAnalysis, answers } = await request.json();

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 400 }
      );
    }

    if (!imageData) {
      return NextResponse.json(
        { error: 'Image data is required' },
        { status: 400 }
      );
    }

    // Build the prompt
    let prompt = `Analyze this food image and provide nutritional information.

Return a JSON object with this exact structure:
{
  "foodName": "descriptive name of the food",
  "nutrition": {
    "calories": number,
    "protein": number (grams),
    "carbs": number (grams),
    "fat": number (grams),
    "fiber": number (grams, optional),
    "sugar": number (grams, optional)
  },
  "confidence": number (0-100, how confident you are in the estimates),
  "needsClarification": boolean (true if you need more info for accuracy),
  "clarifyingQuestions": [
    {
      "id": "unique_id",
      "question": "the question to ask",
      "options": [
        {"label": "Option 1", "value": "option1"},
        {"label": "Option 2", "value": "option2"}
      ],
      "impact": "How this affects the calorie estimate, e.g., 'Could change calories by ~150'"
    }
  ]
}

Guidelines:
- Be specific with food names (e.g., "Grilled Chicken Caesar Salad" not just "Salad")
- If you can't clearly see portion size, add a clarifying question
- If ingredients are unclear (dressing, sauce, etc.), ask about them
- Only include clarifyingQuestions if needsClarification is true
- Confidence should be lower if portion is unclear or multiple items are hard to distinguish
- Round all numbers to whole values`;

    // If we have answers to previous questions, include them
    if (previousAnalysis && answers) {
      prompt += `\n\nPrevious analysis identified this as: ${previousAnalysis.foodName}
User provided these clarifications:
${Object.entries(answers).map(([id, answer]) => `- Question ${id}: ${answer}`).join('\n')}

Please update your nutritional estimates based on these clarifications. Set needsClarification to false and remove clarifyingQuestions.`;
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: imageData,
                  detail: 'high',
                },
              },
            ],
          },
        ],
        max_tokens: 1000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('OpenAI API error:', error);
      return NextResponse.json(
        { error: error.error?.message || 'Failed to analyze image' },
        { status: response.status }
      );
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      return NextResponse.json(
        { error: 'No response from AI' },
        { status: 500 }
      );
    }

    // Parse the JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: 'Could not parse AI response' },
        { status: 500 }
      );
    }

    const analysis = JSON.parse(jsonMatch[0]);

    return NextResponse.json(analysis);
  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze food image' },
      { status: 500 }
    );
  }
}
