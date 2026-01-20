import { NextRequest, NextResponse } from 'next/server';

const recipeSchema = {
  type: "object",
  properties: {
    recipes: {
      type: "array",
      description: "List of recipe suggestions",
      items: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Unique identifier for the recipe"
          },
          name: {
            type: "string",
            description: "Name of the recipe"
          },
          description: {
            type: "string",
            description: "Brief description of the dish (1-2 sentences)"
          },
          prepTime: {
            type: "string",
            description: "Estimated prep + cook time (e.g., '25 mins', '1 hour')"
          },
          difficulty: {
            type: "string",
            enum: ["easy", "medium", "hard"],
            description: "Difficulty level"
          },
          ingredientsUsed: {
            type: "array",
            description: "List of ingredients from the available list that this recipe uses",
            items: { type: "string" }
          },
          instructions: {
            type: "array",
            description: "Step-by-step cooking instructions",
            items: { type: "string" }
          },
          nutrition: {
            type: "object",
            properties: {
              calories: { type: "integer", description: "Calories per serving" },
              protein: { type: "integer", description: "Protein in grams per serving" },
              carbs: { type: "integer", description: "Carbs in grams per serving" },
              fat: { type: "integer", description: "Fat in grams per serving" },
              servings: { type: "integer", description: "Number of servings this recipe makes" }
            },
            required: ["calories", "protein", "carbs", "fat", "servings"],
            additionalProperties: false
          },
          tags: {
            type: "array",
            description: "Tags for the recipe (e.g., 'high-protein', 'low-carb', 'quick')",
            items: { type: "string" }
          }
        },
        required: ["id", "name", "description", "prepTime", "difficulty", "ingredientsUsed", "instructions", "nutrition", "tags"],
        additionalProperties: false
      }
    }
  },
  required: ["recipes"],
  additionalProperties: false
};

export async function POST(request: NextRequest) {
  try {
    const { ingredients, remainingBudget, apiKey, preferences } = await request.json();

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 400 }
      );
    }

    if (!ingredients || ingredients.length === 0) {
      return NextResponse.json(
        { error: 'Ingredients are required' },
        { status: 400 }
      );
    }

    const ingredientList = ingredients.map((i: { name: string; amount: string }) =>
      `${i.name} (${i.amount})`
    ).join(', ');

    let budgetContext = '';
    if (remainingBudget) {
      budgetContext = `
The user has the following remaining nutritional budget for the day:
- Calories: ${remainingBudget.calories} kcal
- Protein: ${remainingBudget.protein}g
- Carbs: ${remainingBudget.carbs}g
- Fat: ${remainingBudget.fat}g

Prioritize recipes that fit within this budget (per serving). If the budget is tight, suggest lighter options.`;
    }

    let preferenceContext = '';
    if (preferences) {
      if (preferences.mealType) {
        preferenceContext += `\nMeal type preference: ${preferences.mealType}`;
      }
      if (preferences.maxPrepTime) {
        preferenceContext += `\nMax prep time: ${preferences.maxPrepTime} minutes`;
      }
      if (preferences.dietary) {
        preferenceContext += `\nDietary preferences: ${preferences.dietary.join(', ')}`;
      }
    }

    const systemPrompt = `You are a creative home chef assistant that suggests practical, delicious recipes based on available ingredients.

Guidelines:
1. Suggest 3-5 recipes that can be made with the provided ingredients
2. Recipes should be realistic for a home cook
3. Prioritize recipes that use more of the available ingredients
4. Include a mix of quick/easy options and more involved dishes
5. Provide accurate nutritional information per serving
6. Instructions should be clear and numbered
7. If nutritional budget is provided, prioritize recipes that fit within it
8. Always assume basic pantry staples are available (salt, pepper, oil, common spices)

Be creative but practical. Focus on dishes that will taste good and be satisfying.`;

    const userPrompt = `Available ingredients: ${ingredientList}
${budgetContext}
${preferenceContext}

Suggest recipes I can make with these ingredients. Include variety in difficulty and prep time.`;

    console.log('[suggest-recipes] Calling OpenAI Chat Completions API with gpt-5.2...');

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
          { role: 'user', content: userPrompt },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'recipe_suggestions',
            strict: true,
            schema: recipeSchema
          }
        }
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('[suggest-recipes] OpenAI API error:', error);
      return NextResponse.json(
        { error: error.error?.message || 'Failed to suggest recipes' },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('[suggest-recipes] Response received');

    const choice = data.choices?.[0];
    if (choice?.message?.refusal) {
      console.error('[suggest-recipes] Model refused:', choice.message.refusal);
      return NextResponse.json(
        { error: 'Could not generate recipe suggestions' },
        { status: 400 }
      );
    }

    const content = choice?.message?.content;
    if (!content) {
      console.error('[suggest-recipes] No content in response');
      return NextResponse.json(
        { error: 'No response from AI' },
        { status: 500 }
      );
    }

    const suggestions = JSON.parse(content);
    console.log('[suggest-recipes] Generated', suggestions.recipes.length, 'recipes');

    return NextResponse.json(suggestions);
  } catch (error) {
    console.error('[suggest-recipes] Error:', error);
    return NextResponse.json(
      { error: 'Failed to suggest recipes' },
      { status: 500 }
    );
  }
}
