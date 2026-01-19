import { NextRequest, NextResponse } from 'next/server';

// JSON Schema for Structured Outputs - breaks down dishes into components
const foodAnalysisSchema = {
  type: "object",
  properties: {
    dish_name: {
      type: "string",
      description: "The overall name of the dish or meal visible in the image"
    },
    components: {
      type: "array",
      description: "Individual components/ingredients visible in the image",
      items: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Name of the component (e.g., 'Grilled chicken breast', 'Caesar dressing')"
          },
          estimated_amount: {
            type: "string",
            description: "Estimated portion size based on visual (e.g., '150g', '2 tbsp', '1 cup')"
          },
          nutrition: {
            type: "object",
            properties: {
              calories: { type: "integer", description: "Calories for this component" },
              protein: { type: "integer", description: "Protein in grams" },
              carbs: { type: "integer", description: "Carbohydrates in grams" },
              fat: { type: "integer", description: "Fat in grams" }
            },
            required: ["calories", "protein", "carbs", "fat"],
            additionalProperties: false
          },
          confidence: {
            type: "integer",
            description: "Confidence in this estimate (0-100)"
          }
        },
        required: ["name", "estimated_amount", "nutrition", "confidence"],
        additionalProperties: false
      }
    },
    total_nutrition: {
      type: "object",
      description: "Sum of all components",
      properties: {
        calories: { type: "integer" },
        protein: { type: "integer" },
        carbs: { type: "integer" },
        fat: { type: "integer" }
      },
      required: ["calories", "protein", "carbs", "fat"],
      additionalProperties: false
    },
    overall_confidence: {
      type: "integer",
      description: "Overall confidence in the full analysis (0-100)"
    },
    clarifying_questions: {
      type: "array",
      description: "Questions to ask if more info would improve accuracy",
      items: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Unique identifier for the question"
          },
          question: {
            type: "string",
            description: "The question to ask the user"
          },
          relates_to_component: {
            type: ["string", "null"],
            description: "Which component this question relates to, or null if overall"
          },
          options: {
            type: "array",
            items: {
              type: "object",
              properties: {
                label: { type: "string" },
                value: { type: "string" }
              },
              required: ["label", "value"],
              additionalProperties: false
            }
          },
          impact: {
            type: "string",
            description: "How answering this could affect the calorie estimate"
          }
        },
        required: ["id", "question", "relates_to_component", "options", "impact"],
        additionalProperties: false
      }
    }
  },
  required: ["dish_name", "components", "total_nutrition", "overall_confidence", "clarifying_questions"],
  additionalProperties: false
};

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

    // Build the system prompt
    const systemPrompt = `You are an expert nutritionist who analyzes food images and breaks down meals into their component parts.

When analyzing an image:
1. Identify what food is shown
2. Break it down into individual visible components (proteins, carbs, fats, vegetables, sauces, etc.)
3. Estimate portion sizes based on visual cues (plate size, utensils, etc.)
4. Calculate nutrition for each component separately
5. Sum up the totals
6. If anything is visually ambiguous, add a clarifying question

Use realistic portion estimates. Round all numbers to whole values.

IMPORTANT for clarifying questions:
- Keep questions SHORT and simple (under 15 words)
- Keep option labels SHORT (3-5 words max)
- Only ask 1-2 questions maximum, focus on what matters most for calories
- Examples of good questions: "How big was the portion?" "Any sauce or dressing?"
- Examples of good options: "Small", "Medium", "Large" or "None", "A little", "Lots"
- Do NOT use technical terms or long explanations`;

    // Build the user prompt
    let userPrompt = `Analyze this food image and break it down into components with nutrition info.`;

    if (previousAnalysis && answers && Object.keys(answers).length > 0) {
      userPrompt += `\n\nPrevious analysis identified this as: ${previousAnalysis.dish_name || previousAnalysis.foodName}
User provided these clarifications:
${Object.entries(answers).map(([id, answer]) => `- ${id}: ${answer}`).join('\n')}

Please update your estimates based on these answers and don't ask these questions again.`;
    }

    console.log('[analyze-food] Calling OpenAI Responses API with GPT-5.2...');

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-5.2',
        input: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'input_text', text: userPrompt },
              {
                type: 'input_image',
                image_url: imageData,
                detail: 'high',
              },
            ],
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            strict: true,
            name: 'food_image_analysis',
            schema: foodAnalysisSchema
          }
        }
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('[analyze-food] OpenAI API error:', error);
      return NextResponse.json(
        { error: error.error?.message || 'Failed to analyze image' },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('[analyze-food] Raw response status:', data.status);

    // Handle refusal
    const output = data.output?.[0];
    if (output?.content?.[0]?.type === 'refusal') {
      console.error('[analyze-food] Model refused:', output.content[0].refusal);
      return NextResponse.json(
        { error: 'The AI could not analyze this image' },
        { status: 400 }
      );
    }

    // Extract the structured output - GPT-5.2 uses "output_text" type
    const textContent = output?.content?.find((c: { type: string }) => c.type === 'output_text' || c.type === 'text');
    if (!textContent?.text) {
      console.error('[analyze-food] No text content in response. Content types:', output?.content?.map((c: { type: string }) => c.type));
      return NextResponse.json(
        { error: 'No response from AI' },
        { status: 500 }
      );
    }

    const analysis = JSON.parse(textContent.text);
    console.log('[analyze-food] Parsed analysis:', analysis.dish_name);
    console.log('[analyze-food] Components:', analysis.components.length);
    console.log('[analyze-food] Total calories:', analysis.total_nutrition.calories);

    // Return both the legacy format (for backward compatibility) and the new breakdown
    const transformedResponse = {
      // Legacy format
      foodName: analysis.dish_name,
      nutrition: analysis.total_nutrition,
      confidence: analysis.overall_confidence,
      needsClarification: analysis.clarifying_questions.length > 0,
      // New component breakdown
      breakdown: {
        dish_name: analysis.dish_name,
        components: analysis.components,
        total_nutrition: analysis.total_nutrition,
        overall_confidence: analysis.overall_confidence
      },
      clarifyingQuestions: analysis.clarifying_questions.map((q: {
        id: string;
        question: string;
        relates_to_component: string | null;
        options: { label: string; value: string }[];
        impact: string;
      }) => ({
        id: q.id,
        question: q.question,  // Keep it simple, no brackets
        options: q.options,
        impact: q.impact
      }))
    };

    console.log('[analyze-food] Success - returning transformed response');
    return NextResponse.json(transformedResponse);
  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze food image' },
      { status: 500 }
    );
  }
}
