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
            description: "Estimated portion size in metric units (e.g., '150g', '30ml', '2 eggs', '1 slice')"
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
    const { imageData, apiKey, previousAnalysis, answers, additionalContext } = await request.json();

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

IMPORTANT: Always use metric measurements (grams, ml). Never use cups, tablespoons, or ounces.
- Use grams (g) for solid foods: "150g chicken", "30g cheese"
- Use milliliters (ml) for liquids: "200ml milk", "15ml oil"
- Use units for countable items: "2 eggs", "1 slice", "3 cookies"

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

    // Add additional context if provided (Image + Text mode)
    if (additionalContext && additionalContext.trim()) {
      userPrompt += `\n\nAdditional context from the user about this meal: "${additionalContext}"
Use this information to improve your analysis - it may include details about ingredients, portion sizes, cooking methods, restaurant/brand names, or other relevant info that isn't visible in the image.`;
    }

    if (previousAnalysis && answers && Object.keys(answers).length > 0) {
      userPrompt += `\n\nPrevious analysis identified this as: ${previousAnalysis.dish_name || previousAnalysis.foodName}
User provided these clarifications:
${Object.entries(answers).map(([id, answer]) => `- ${id}: ${answer}`).join('\n')}

Please update your estimates based on these answers and don't ask these questions again.`;
    }

    console.log('[analyze-food] Calling OpenAI Chat Completions API with gpt-5.2...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-5.2',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: userPrompt },
              {
                type: 'image_url',
                image_url: { url: imageData, detail: 'high' },
              },
            ],
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'food_image_analysis',
            strict: true,
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
    console.log('[analyze-food] Raw response received');

    // Handle refusal
    const choice = data.choices?.[0];
    if (choice?.message?.refusal) {
      console.error('[analyze-food] Model refused:', choice.message.refusal);
      return NextResponse.json(
        { error: 'The AI could not analyze this image' },
        { status: 400 }
      );
    }

    // Extract the content
    const content = choice?.message?.content;
    if (!content) {
      console.error('[analyze-food] No content in response');
      return NextResponse.json(
        { error: 'No response from AI' },
        { status: 500 }
      );
    }

    const analysis = JSON.parse(content);
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
