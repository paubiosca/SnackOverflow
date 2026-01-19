import { NextRequest, NextResponse } from 'next/server';
import { OnboardingTopic, QuickReply, ExtractedProfileData, OnboardingCalculations } from '@/lib/types';
import { calculateBMR, calculateTDEE, calculateDeficit } from '@/lib/calories';

interface OnboardingChatRequest {
  message: string;
  currentTopic: OnboardingTopic;
  extractedData: ExtractedProfileData;
  conversationHistory: { role: 'user' | 'assistant'; content: string }[];
  apiKey: string;
}

interface OnboardingChatResponse {
  assistantMessage: string;
  extractedData: ExtractedProfileData;
  quickReplies: QuickReply[];
  nextTopic: OnboardingTopic;
  calculations: OnboardingCalculations;
  isComplete: boolean;
}

const SYSTEM_PROMPT = `You are a friendly onboarding assistant for SnackOverflow, a calorie tracking app. Your job is to have a natural conversation to collect the user's profile information while explaining how calorie tracking works.

You are collecting the following information in order:
1. greeting - Welcome the user warmly
2. name - Ask for their name
3. demographics - Ask for age and gender
4. body_metrics - Ask for height (cm) and weight (kg)
5. activity_approach - Explain the two approaches:
   - STATIC: Fixed daily goal based on activity level multiplier. Best for consistent routines.
   - DYNAMIC: Sedentary base + active calories added daily from Apple Watch. Exercise "earns" more food.
6. activity_level (if static) - Ask about their typical weekly activity
7. active_calorie_goal (if dynamic) - Ask about their daily active calorie target
8. goal_setting - Ask about their calorie deficit preference
9. summary - Summarize and confirm everything
10. complete - Done!

IMPORTANT RULES:
- Be conversational and friendly, but concise
- Calculate and share BMR/TDEE when you have the data (after body_metrics)
- Extract data from user messages even if they provide multiple pieces at once
- Always provide quick reply options when appropriate
- Use metric units (cm, kg)
- When explaining activity approaches, give a concrete example for dynamic: "Base 1,744 + 450 active = 2,194 eating budget"

You must respond with valid JSON matching this schema:
{
  "assistant_message": "Your friendly response to the user",
  "extracted_data": {
    "name": "string or null",
    "age": "number or null",
    "gender": "'male' or 'female' or null",
    "heightCm": "number or null",
    "weightKg": "number or null",
    "activityApproach": "'static' or 'dynamic' or null",
    "activityLevel": "'sedentary' | 'light' | 'moderate' | 'active' | 'very_active' or null",
    "activeCalorieGoal": "number or null",
    "goalType": "'deficit_fixed' or null",
    "goalValue": "number or null (negative for deficit)"
  },
  "quick_replies": [{"label": "Button text", "value": "value to send", "description": "optional tooltip"}],
  "next_topic": "the next topic to discuss",
  "is_complete": false
}

Only include fields in extracted_data that you've actually extracted from this message. Keep existing data.`;

function buildConversationContext(
  currentTopic: OnboardingTopic,
  extractedData: ExtractedProfileData,
  conversationHistory: { role: 'user' | 'assistant'; content: string }[]
): string {
  let context = `Current topic: ${currentTopic}\n`;
  context += `Already collected data: ${JSON.stringify(extractedData, null, 2)}\n`;

  if (extractedData.weightKg && extractedData.heightCm && extractedData.age && extractedData.gender) {
    const bmr = calculateBMR(extractedData.weightKg, extractedData.heightCm, extractedData.age, extractedData.gender);
    const sedentaryTdee = calculateTDEE(extractedData.weightKg, extractedData.heightCm, extractedData.age, extractedData.gender, 'sedentary');
    context += `\nCalculated values:\n- BMR: ${Math.round(bmr)} kcal\n- Sedentary TDEE: ${sedentaryTdee} kcal\n`;
  }

  return context;
}

function calculateOnboardingCalcs(data: ExtractedProfileData): OnboardingCalculations {
  if (!data.weightKg || !data.heightCm || !data.age || !data.gender) {
    return {};
  }

  const bmr = calculateBMR(data.weightKg, data.heightCm, data.age, data.gender);
  const sedentaryTdee = calculateTDEE(data.weightKg, data.heightCm, data.age, data.gender, 'sedentary');
  const activityLevel = data.activityLevel || 'moderate';
  const tdee = calculateTDEE(data.weightKg, data.heightCm, data.age, data.gender, activityLevel);

  let recommendedCalories: number | undefined;
  if (data.goalValue !== undefined) {
    const deficit = calculateDeficit(data.goalType || 'deficit_fixed', data.goalValue);
    if (data.activityApproach === 'dynamic') {
      recommendedCalories = Math.max(1200, sedentaryTdee + deficit);
    } else {
      recommendedCalories = Math.max(1200, tdee + deficit);
    }
  }

  return {
    bmr: Math.round(bmr),
    tdee,
    baseSedentaryCalories: sedentaryTdee,
    recommendedCalories,
  };
}

// JSON Schema for structured outputs
const onboardingResponseSchema = {
  type: "object",
  properties: {
    assistant_message: {
      type: "string",
      description: "Your friendly response to the user"
    },
    extracted_data: {
      type: "object",
      properties: {
        name: { type: ["string", "null"] },
        age: { type: ["number", "null"] },
        gender: { type: ["string", "null"], enum: ["male", "female", null] },
        heightCm: { type: ["number", "null"] },
        weightKg: { type: ["number", "null"] },
        activityApproach: { type: ["string", "null"], enum: ["static", "dynamic", null] },
        activityLevel: { type: ["string", "null"], enum: ["sedentary", "light", "moderate", "active", "very_active", null] },
        activeCalorieGoal: { type: ["number", "null"] },
        goalType: { type: ["string", "null"], enum: ["deficit_fixed", null] },
        goalValue: { type: ["number", "null"] }
      },
      additionalProperties: false
    },
    quick_replies: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          value: { type: "string" },
          description: { type: ["string", "null"] }
        },
        required: ["label", "value"],
        additionalProperties: false
      }
    },
    next_topic: {
      type: "string",
      enum: ["greeting", "name", "demographics", "body_metrics", "activity_approach", "activity_level", "active_calorie_goal", "goal_setting", "summary", "complete"]
    },
    is_complete: { type: "boolean" }
  },
  required: ["assistant_message", "extracted_data", "quick_replies", "next_topic", "is_complete"],
  additionalProperties: false
};

export async function POST(request: NextRequest) {
  try {
    const body: OnboardingChatRequest = await request.json();
    const { message, currentTopic, extractedData, conversationHistory, apiKey } = body;

    if (!apiKey) {
      return NextResponse.json({ error: 'API key required' }, { status: 400 });
    }

    const contextMessage = buildConversationContext(currentTopic, extractedData, conversationHistory);

    // Build messages for the API
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'system', content: contextMessage },
      ...conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
      { role: 'user', content: message },
    ];

    console.log('[onboarding-chat] Calling OpenAI Chat Completions API...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'onboarding_response',
            strict: true,
            schema: onboardingResponseSchema
          }
        }
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('[onboarding-chat] OpenAI API error:', error);
      return NextResponse.json(
        { error: error.error?.message || 'Failed to process chat' },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('[onboarding-chat] Response received');

    // Handle refusal
    const choice = data.choices?.[0];
    if (choice?.message?.refusal) {
      console.error('[onboarding-chat] Model refused:', choice.message.refusal);
      return NextResponse.json(
        { error: 'The AI could not process this message' },
        { status: 400 }
      );
    }

    // Extract the content
    const content = choice?.message?.content;
    if (!content) {
      console.error('[onboarding-chat] No content in response');
      return NextResponse.json(
        { error: 'No response from AI' },
        { status: 500 }
      );
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      console.error('[onboarding-chat] Failed to parse AI response:', content);
      return NextResponse.json({ error: 'Invalid AI response' }, { status: 500 });
    }

    // Merge extracted data
    const mergedData: ExtractedProfileData = {
      ...extractedData,
      ...Object.fromEntries(
        Object.entries(parsed.extracted_data || {}).filter(([, v]) => v !== null && v !== undefined)
      ),
    };

    // Calculate values
    const calculations = calculateOnboardingCalcs(mergedData);

    const result: OnboardingChatResponse = {
      assistantMessage: parsed.assistant_message || "I'm sorry, I didn't understand that. Could you try again?",
      extractedData: mergedData,
      quickReplies: (parsed.quick_replies || []).map((qr: { label: string; value: string; description?: string }) => ({
        label: qr.label,
        value: qr.value,
        description: qr.description,
      })),
      nextTopic: parsed.next_topic || currentTopic,
      calculations,
      isComplete: parsed.is_complete || false,
    };

    console.log('[onboarding-chat] Success - next topic:', result.nextTopic);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Onboarding chat error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process chat' },
      { status: 500 }
    );
  }
}

// Initial greeting endpoint
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const apiKey = searchParams.get('apiKey');

  if (!apiKey) {
    return NextResponse.json({ error: 'API key required' }, { status: 400 });
  }

  try {
    console.log('[onboarding-chat] Getting initial greeting...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: 'Current topic: greeting\nAlready collected data: {}\n\nGenerate a warm, friendly greeting to start the onboarding conversation. Ask for the user\'s name.' },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'onboarding_response',
            strict: true,
            schema: onboardingResponseSchema
          }
        }
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to get greeting from AI');
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    const content = choice?.message?.content;

    if (!content) {
      throw new Error('No response from AI');
    }

    const parsed = JSON.parse(content);

    return NextResponse.json({
      assistantMessage: parsed.assistant_message || "Hey! I'm excited to help you set up SnackOverflow. What should I call you?",
      quickReplies: parsed.quick_replies || [],
      nextTopic: 'name',
    });
  } catch (error) {
    console.error('Greeting error:', error);
    // Return a fallback greeting if API fails
    return NextResponse.json({
      assistantMessage: "Hey! I'm excited to help you set up SnackOverflow. What should I call you?",
      quickReplies: [],
      nextTopic: 'name',
    });
  }
}
