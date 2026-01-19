import { NextRequest, NextResponse } from 'next/server';

const ingredientAnalysisSchema = {
  type: "object",
  properties: {
    ingredients: {
      type: "array",
      description: "List of identified ingredients",
      items: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Unique identifier for the ingredient"
          },
          name: {
            type: "string",
            description: "Name of the ingredient (e.g., 'Chicken breast', 'Roma tomatoes')"
          },
          amount: {
            type: "string",
            description: "Estimated amount in metric units (e.g., '500g', '3 pieces', '200ml')"
          },
          category: {
            type: "string",
            enum: ["protein", "vegetable", "fruit", "grain", "dairy", "fat", "seasoning", "other"],
            description: "Category of the ingredient"
          }
        },
        required: ["id", "name", "amount", "category"],
        additionalProperties: false
      }
    },
    confidence: {
      type: "integer",
      description: "Overall confidence in the ingredient identification (0-100)"
    },
    suggestions: {
      type: "array",
      description: "Suggestions for common ingredients that might go well with what was identified",
      items: {
        type: "string"
      }
    }
  },
  required: ["ingredients", "confidence", "suggestions"],
  additionalProperties: false
};

export async function POST(request: NextRequest) {
  try {
    const { imageData, textInput, apiKey } = await request.json();

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 400 }
      );
    }

    if (!imageData && !textInput) {
      return NextResponse.json(
        { error: 'Either image or text input is required' },
        { status: 400 }
      );
    }

    const systemPrompt = `You are a kitchen assistant that identifies ingredients from photos or text descriptions.

When analyzing:
1. Identify all visible ingredients or ingredients mentioned
2. Estimate realistic amounts in metric units (grams, ml, pieces)
3. Categorize each ingredient appropriately
4. Be comprehensive - include obvious staples that might be present (oil, salt, etc.) if they seem likely

Categories:
- protein: meat, fish, eggs, tofu, legumes
- vegetable: all vegetables
- fruit: all fruits
- grain: rice, pasta, bread, flour, oats
- dairy: milk, cheese, yogurt, butter
- fat: oils, nuts, avocado
- seasoning: herbs, spices, sauces, condiments
- other: anything that doesn't fit above

Always use metric measurements. Be realistic with quantities.`;

    let userContent: Array<{ type: string; text?: string; image_url?: string; detail?: string }>;

    if (imageData && textInput) {
      userContent = [
        { type: 'input_text', text: `Identify the ingredients in this photo. Additional context: "${textInput}"` },
        { type: 'input_image', image_url: imageData, detail: 'high' },
      ];
    } else if (imageData) {
      userContent = [
        { type: 'input_text', text: 'Identify all the ingredients visible in this photo of a fridge, pantry, or kitchen counter.' },
        { type: 'input_image', image_url: imageData, detail: 'high' },
      ];
    } else {
      userContent = [
        { type: 'input_text', text: `Identify and categorize these ingredients: "${textInput}". Estimate reasonable amounts for a home cook.` },
      ];
    }

    console.log('[analyze-ingredients] Calling OpenAI Chat Completions API...');

    // Convert user content to OpenAI chat completions format
    const messageContent = userContent.map((c: { type: string; text?: string; image_url?: string; detail?: string }) => {
      if (c.type === 'input_text') {
        return { type: 'text', text: c.text };
      } else if (c.type === 'input_image') {
        return { type: 'image_url', image_url: { url: c.image_url, detail: c.detail || 'high' } };
      }
      return c;
    });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: messageContent },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'ingredient_analysis',
            strict: true,
            schema: ingredientAnalysisSchema
          }
        }
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('[analyze-ingredients] OpenAI API error:', error);
      return NextResponse.json(
        { error: error.error?.message || 'Failed to analyze ingredients' },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('[analyze-ingredients] Response received');

    const choice = data.choices?.[0];
    if (choice?.message?.refusal) {
      console.error('[analyze-ingredients] Model refused:', choice.message.refusal);
      return NextResponse.json(
        { error: 'Could not analyze the ingredients' },
        { status: 400 }
      );
    }

    const content = choice?.message?.content;
    if (!content) {
      console.error('[analyze-ingredients] No content in response');
      return NextResponse.json(
        { error: 'No response from AI' },
        { status: 500 }
      );
    }

    const analysis = JSON.parse(content);
    console.log('[analyze-ingredients] Identified', analysis.ingredients.length, 'ingredients');

    return NextResponse.json(analysis);
  } catch (error) {
    console.error('[analyze-ingredients] Error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze ingredients' },
      { status: 500 }
    );
  }
}
