// Shared OpenAI prompt + schema for food analysis. Used by both the synchronous
// preview routes (`/api/analyze-text`, `/api/analyze-food`) and the async worker
// (`/api/food/[id]/process`). Single source of truth for the schema.

const SCHEMA = {
  type: 'object',
  properties: {
    dish_name: { type: 'string', description: 'Overall dish or meal name' },
    components: {
      type: 'array',
      description: 'Individual components/ingredients',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          brand: { type: ['string', 'null'] },
          portion_display: { type: 'string' },
          portion_grams: { type: ['integer', 'null'] },
          nutrition: {
            type: 'object',
            properties: {
              calories: { type: 'integer' },
              protein: { type: 'integer' },
              carbs: { type: 'integer' },
              fat: { type: 'integer' },
            },
            required: ['calories', 'protein', 'carbs', 'fat'],
            additionalProperties: false,
          },
          confidence: { type: 'integer' },
        },
        required: ['name', 'brand', 'portion_display', 'portion_grams', 'nutrition', 'confidence'],
        additionalProperties: false,
      },
    },
    total_nutrition: {
      type: 'object',
      properties: {
        calories: { type: 'integer' },
        protein: { type: 'integer' },
        carbs: { type: 'integer' },
        fat: { type: 'integer' },
      },
      required: ['calories', 'protein', 'carbs', 'fat'],
      additionalProperties: false,
    },
    overall_confidence: { type: 'integer' },
    clarifying_questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          question: { type: 'string' },
          relates_to_component: { type: ['string', 'null'] },
          options: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string' },
                value: { type: 'string' },
              },
              required: ['label', 'value'],
              additionalProperties: false,
            },
          },
          impact: { type: 'string' },
        },
        required: ['id', 'question', 'relates_to_component', 'options', 'impact'],
        additionalProperties: false,
      },
    },
  },
  required: ['dish_name', 'components', 'total_nutrition', 'overall_confidence', 'clarifying_questions'],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT = `You are an expert nutritionist who breaks down meals into components to estimate calories and macros.

When analyzing food:
1. Identify the dish name
2. Break it into individual components (proteins, carbs, fats, vegetables, sauces)
3. Estimate portion sizes (always metric: grams, ml, or units)
4. Calculate nutrition per component, then sum
5. If portion or preparation is ambiguous and significantly affects calories, ask ONE clarifying question

Always use grams (g), milliliters (ml), or count units. Never cups, tablespoons, or ounces.
Round all numbers to integers.

Clarifying questions (when used):
- SHORT (under 15 words). Option labels short (3-5 words).
- 0-1 questions only. Skip if confidence is high (>=80).
- Examples: "How big was the portion?" with options "Small", "Medium", "Large".
`;

export interface FoodAnalysisInput {
  apiKey: string;
  description?: string;        // user's text description
  photoDataUrl?: string;       // base64 data URL for image analysis
  additionalContext?: string;  // free-text comment from the user
  priorAnswer?: string;        // user's response to a previous clarifying question
}

export interface FoodAnalysisResult {
  dishName: string;
  components: Array<{
    name: string;
    brand: string | null;
    portionDisplay: string;
    portionGrams: number | null;
    nutrition: { calories: number; protein: number; carbs: number; fat: number };
    confidence: number;
  }>;
  totalNutrition: { calories: number; protein: number; carbs: number; fat: number };
  overallConfidence: number;
  clarifyingQuestions: Array<{
    id: string;
    question: string;
    options: { label: string; value: string }[];
    impact: string;
  }>;
}

export async function analyzeFood(input: FoodAnalysisInput): Promise<FoodAnalysisResult> {
  if (!input.description && !input.photoDataUrl) {
    throw new Error('analyzeFood requires either description or photoDataUrl');
  }

  let userPrompt = input.photoDataUrl
    ? 'Analyze this food image. Break it into components with nutrition info.'
    : `Analyze this food and break it into components: "${input.description}"`;

  if (input.description && input.photoDataUrl) {
    userPrompt += `\n\nUser's description of the meal: "${input.description}"`;
  }
  if (input.additionalContext?.trim()) {
    userPrompt += `\n\nAdditional context: "${input.additionalContext}"`;
  }
  if (input.priorAnswer?.trim()) {
    userPrompt += `\n\nThe user just answered a clarifying question: "${input.priorAnswer}"\nUse this answer to refine your estimate. Do NOT ask another clarifying question unless absolutely necessary.`;
  }

  const userContent = input.photoDataUrl
    ? [
        { type: 'text', text: userPrompt },
        { type: 'image_url', image_url: { url: input.photoDataUrl, detail: 'high' } },
      ]
    : userPrompt;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${input.apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-5.5',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'food_analysis', strict: true, schema: SCHEMA },
      },
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `OpenAI request failed: ${response.status}`);
  }

  const data = await response.json();
  const choice = data.choices?.[0];
  if (choice?.message?.refusal) {
    throw new Error('Model refused to analyze this food');
  }
  const content = choice?.message?.content;
  if (!content) throw new Error('Empty response from model');

  const parsed = JSON.parse(content);
  return {
    dishName: parsed.dish_name,
    components: parsed.components.map((c: any) => ({
      name: c.name,
      brand: c.brand,
      portionDisplay: c.portion_display,
      portionGrams: c.portion_grams,
      nutrition: c.nutrition,
      confidence: c.confidence,
    })),
    totalNutrition: parsed.total_nutrition,
    overallConfidence: parsed.overall_confidence,
    clarifyingQuestions: parsed.clarifying_questions.map((q: any) => ({
      id: q.id,
      question: q.question,
      options: q.options,
      impact: q.impact,
    })),
  };
}
