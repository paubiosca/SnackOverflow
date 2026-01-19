import { NextRequest, NextResponse } from 'next/server';

// JSON Schema for Structured Outputs - breaks down dishes into components
const foodAnalysisSchema = {
  type: "object",
  properties: {
    dish_name: {
      type: "string",
      description: "The overall name of the dish or meal"
    },
    components: {
      type: "array",
      description: "Individual components/ingredients of the dish",
      items: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Clean name without brand (e.g., 'Scottish salmon fillets', 'Hummus')"
          },
          brand: {
            type: ["string", "null"],
            description: "Brand or supermarket if mentioned (e.g., 'Marks & Spencer', 'Tesco', 'Whole Foods'). Null if homemade or no brand."
          },
          portion_display: {
            type: "string",
            description: "Human-friendly portion (e.g., '2 fillets', '1/2 pot', '1 slice', '1 handful')"
          },
          portion_grams: {
            type: ["integer", "null"],
            description: "Estimated weight in grams if applicable"
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
        required: ["name", "brand", "portion_display", "portion_grams", "nutrition", "confidence"],
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

    // Build the system prompt
    const systemPrompt = `You are an expert nutritionist who breaks down meals into their component parts to estimate calories and macros accurately.

When analyzing a dish:
1. Identify the main dish name
2. Break it down into individual components (proteins, carbs, fats, vegetables, sauces, etc.)
3. Estimate reasonable portion sizes for each component
4. Calculate nutrition for each component separately
5. Sum up the totals
6. If anything is ambiguous that significantly affects calories, add a clarifying question

Be specific about components - for example, a "Caesar salad" should break down into:
- Romaine lettuce (amount)
- Parmesan cheese (amount)
- Caesar dressing (amount)
- Croutons (amount)
- Grilled chicken if mentioned (amount)

Use realistic restaurant/homemade portion sizes. Round all numbers to whole values.

IMPORTANT for clarifying questions:
- Keep questions SHORT and simple (under 15 words)
- Keep option labels SHORT (3-5 words max)
- Only ask 1-2 questions maximum, focus on what matters most for calories
- Examples of good questions: "How big was the portion?" "Was it fried or grilled?"
- Examples of good options: "Small", "Medium", "Large" or "Light", "Regular", "Extra"
- Do NOT use technical terms or long explanations in questions`;

    // Build the user prompt
    let userPrompt = `Analyze this food and break it down into components: "${description}"`;

    if (answers && Object.keys(answers).length > 0) {
      userPrompt += `\n\nUser provided these clarifications:\n${Object.entries(answers).map(([id, answer]) => `- ${id}: ${answer}`).join('\n')}\n\nPlease update your estimates based on these answers and don't ask these questions again.`;
    }

    console.log('[analyze-text] Calling OpenAI Responses API with GPT-5.2...');
    console.log('[analyze-text] Description:', description);

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
          { role: 'user', content: userPrompt }
        ],
        text: {
          format: {
            type: 'json_schema',
            strict: true,
            name: 'food_analysis',
            schema: foodAnalysisSchema
          }
        }
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
    console.log('[analyze-text] Raw response:', JSON.stringify(data, null, 2));

    // Handle refusal
    const output = data.output?.[0];
    if (output?.content?.[0]?.type === 'refusal') {
      console.error('[analyze-text] Model refused:', output.content[0].refusal);
      return NextResponse.json(
        { error: 'The AI could not analyze this food description' },
        { status: 400 }
      );
    }

    // Extract the structured output - GPT-5.2 uses "output_text" type
    const textContent = output?.content?.find((c: { type: string }) => c.type === 'output_text' || c.type === 'text');
    if (!textContent?.text) {
      console.error('[analyze-text] No text content in response. Content types:', output?.content?.map((c: { type: string }) => c.type));
      return NextResponse.json(
        { error: 'No response from AI' },
        { status: 500 }
      );
    }

    const analysis = JSON.parse(textContent.text);
    console.log('[analyze-text] Parsed analysis:', analysis.dish_name);
    console.log('[analyze-text] Components:', analysis.components.length);
    console.log('[analyze-text] Total calories:', analysis.total_nutrition.calories);

    // Transform to match the expected frontend format while preserving component detail
    const transformedResponse = {
      foods: analysis.components.map((comp: {
        name: string;
        brand: string | null;
        portion_display: string;
        portion_grams: number | null;
        nutrition: { calories: number; protein: number; carbs: number; fat: number };
        confidence: number;
      }) => ({
        name: comp.name,
        brand: comp.brand,
        portion: comp.portion_display,
        portionGrams: comp.portion_grams,
        nutrition: comp.nutrition,
        confidence: comp.confidence
      })),
      // Include the detailed breakdown
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

    console.log('[analyze-text] Success - returning transformed response');
    return NextResponse.json(transformedResponse);
  } catch (error) {
    console.error('Text analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze food description' },
      { status: 500 }
    );
  }
}
