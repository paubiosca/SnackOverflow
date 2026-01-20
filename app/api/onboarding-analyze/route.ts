import { NextRequest, NextResponse } from 'next/server';

interface OnboardingAnalysisRequest {
  gender: 'male' | 'female';
  ageRange: string | null;
  age: number | null;
  heightCm: number;
  weightKg: number;
  activityLevel: string;
  eatingHabits: string;
  mealFrequency: string;
  snackingHabit: string;
  drinkHabits: string;
  goalType: 'lose' | 'maintain' | 'gain';
  weeklyGoal: number;
  bmr: number;
  tdee: number;
  apiKey?: string;
}

const analysisResponseSchema = {
  type: "object",
  properties: {
    estimatedCurrentIntake: { type: "number" },
    explanation: { type: "string" },
    tips: {
      type: "array",
      items: { type: "string" }
    }
  },
  required: ["estimatedCurrentIntake", "explanation", "tips"],
  additionalProperties: false
};

export async function POST(req: NextRequest) {
  try {
    const data: OnboardingAnalysisRequest = await req.json();

    // Calculate recommended intake based on goal
    let deficit = 0;
    if (data.goalType === 'lose') {
      deficit = (data.weeklyGoal || 0.5) * 1100;
    } else if (data.goalType === 'gain') {
      deficit = -(data.weeklyGoal || 0.25) * 1100;
    }
    const recommendedIntake = Math.max(1200, Math.round(data.tdee - deficit));

    // If no API key, return calculated fallback
    if (!data.apiKey) {
      return NextResponse.json(calculateFallbackAnalysis(data, recommendedIntake));
    }

    // Use AI to provide more personalized analysis
    const prompt = `You are a nutrition expert analyzing a user's profile to estimate their current calorie intake and provide recommendations.

User Profile:
- Gender: ${data.gender}
- Age: ${data.age || data.ageRange}
- Height: ${data.heightCm} cm
- Weight: ${data.weightKg} kg
- Activity Level: ${data.activityLevel}
- BMR (Basal Metabolic Rate): ${data.bmr} calories
- TDEE (Total Daily Energy Expenditure): ${data.tdee} calories

Eating Habits:
- Portion sizes: ${formatHabit(data.eatingHabits)}
- Meal frequency: ${formatMealFrequency(data.mealFrequency)}
- Snacking: ${formatSnacking(data.snackingHabit)}
- Beverages: ${formatDrinks(data.drinkHabits)}

Goal: ${formatGoal(data.goalType, data.weeklyGoal)}
Calculated recommended intake: ${recommendedIntake} calories/day

Based on this profile, estimate their current daily calorie intake and provide actionable tips. Be realistic - someone with large portions and frequent snacking likely eats 20-40% above their TDEE. Someone with small portions might be at or slightly below TDEE.`;

    console.log('[onboarding-analyze] Calling OpenAI API with gpt-5.2...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${data.apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-5.2',
        messages: [
          { role: 'user', content: prompt }
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'calorie_analysis',
            strict: true,
            schema: analysisResponseSchema
          }
        }
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('[onboarding-analyze] OpenAI API error:', error);
      // Fall back to calculated analysis
      return NextResponse.json(calculateFallbackAnalysis(data, recommendedIntake));
    }

    const responseData = await response.json();
    console.log('[onboarding-analyze] Response received');

    // Extract the structured output from chat completions format
    const choice = responseData.choices?.[0];
    if (choice?.message?.refusal) {
      console.error('[onboarding-analyze] Model refused:', choice.message.refusal);
      return NextResponse.json(calculateFallbackAnalysis(data, recommendedIntake));
    }

    const content = choice?.message?.content;
    if (!content) {
      console.error('[onboarding-analyze] No content in response');
      return NextResponse.json(calculateFallbackAnalysis(data, recommendedIntake));
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      console.error('[onboarding-analyze] Failed to parse AI response:', content);
      return NextResponse.json(calculateFallbackAnalysis(data, recommendedIntake));
    }

    return NextResponse.json({
      estimatedCurrentIntake: parsed.estimatedCurrentIntake,
      recommendedIntake,
      explanation: parsed.explanation,
      tips: (parsed.tips || []).slice(0, 3),
    });

  } catch (error) {
    console.error('Onboarding analysis error:', error);

    // Return fallback on error
    try {
      const data = await req.clone().json();
      let deficit = 0;
      if (data.goalType === 'lose') {
        deficit = (data.weeklyGoal || 0.5) * 1100;
      } else if (data.goalType === 'gain') {
        deficit = -(data.weeklyGoal || 0.25) * 1100;
      }
      const recommendedIntake = Math.max(1200, Math.round((data.tdee || 2000) - deficit));

      return NextResponse.json(calculateFallbackAnalysis(data, recommendedIntake));
    } catch {
      return NextResponse.json({
        estimatedCurrentIntake: 2200,
        recommendedIntake: 1800,
        explanation: 'We estimated your intake based on typical patterns. Track your food for a week to get more accurate data.',
        tips: ['Track consistently for accurate baseline data', 'Focus on whole foods', 'Stay hydrated'],
      });
    }
  }
}

function calculateFallbackAnalysis(data: OnboardingAnalysisRequest, recommendedIntake: number) {
  // Estimate current intake based on eating habits
  let intakeMultiplier = 1.0;

  if (data.eatingHabits === 'large_portions') intakeMultiplier += 0.2;
  if (data.eatingHabits === 'often_overeat') intakeMultiplier += 0.3;
  if (data.mealFrequency === 'irregular') intakeMultiplier += 0.1;
  if (data.snackingHabit === 'frequent') intakeMultiplier += 0.15;
  if (data.snackingHabit === 'constant') intakeMultiplier += 0.25;
  if (data.drinkHabits === 'sugary_drinks') intakeMultiplier += 0.15;
  if (data.drinkHabits === 'alcohol_regular') intakeMultiplier += 0.1;
  if (data.eatingHabits === 'small_portions') intakeMultiplier -= 0.1;

  const estimatedCurrentIntake = Math.round((data.tdee || 2000) * intakeMultiplier);

  const tips: string[] = [];

  if (data.snackingHabit === 'frequent' || data.snackingHabit === 'constant') {
    tips.push('Try to be more mindful of snacking - consider keeping a snack log');
  }
  if (data.drinkHabits === 'sugary_drinks') {
    tips.push('Switching to water or unsweetened drinks could save 200-400 calories daily');
  }
  if (data.drinkHabits === 'alcohol_regular') {
    tips.push('Reducing alcohol can significantly help - a beer or glass of wine is 150+ calories');
  }
  if (data.eatingHabits === 'large_portions' || data.eatingHabits === 'often_overeat') {
    tips.push('Try using smaller plates and eating more slowly to feel satisfied with less');
  }
  if (data.mealFrequency === 'irregular') {
    tips.push('Establishing regular meal times can help regulate hunger and prevent overeating');
  }

  tips.push('Track consistently for the first 2 weeks to get accurate baseline data');

  return {
    estimatedCurrentIntake,
    recommendedIntake,
    explanation: `Based on your ${data.activityLevel || 'moderate'} activity level and eating habits, we estimate you're currently consuming around ${estimatedCurrentIntake.toLocaleString()} calories daily. ${data.goalType === 'lose' ? `To lose ${data.weeklyGoal} kg per week, you'll need to reduce to ${recommendedIntake.toLocaleString()} calories daily.` : data.goalType === 'gain' ? `To gain ${data.weeklyGoal} kg per week, aim for ${recommendedIntake.toLocaleString()} calories daily.` : `To maintain your weight, target ${recommendedIntake.toLocaleString()} calories daily.`}`,
    tips: tips.slice(0, 3),
  };
}

function formatHabit(habit: string): string {
  const habits: Record<string, string> = {
    small_portions: 'Small portions, often leaves food on plate',
    normal_portions: 'Normal portions, eats until satisfied',
    large_portions: 'Large portions, tends to eat a lot in one sitting',
    often_overeat: 'Often overeats past the point of fullness',
  };
  return habits[habit] || habit || 'Normal portions';
}

function formatMealFrequency(freq: string): string {
  const freqs: Record<string, string> = {
    '1-2': '1-2 meals per day, often skips meals',
    '3': '3 regular meals per day',
    '4+': '4+ smaller meals throughout the day',
    'irregular': 'Irregular eating pattern',
  };
  return freqs[freq] || freq || '3 meals per day';
}

function formatSnacking(snack: string): string {
  const snacks: Record<string, string> = {
    rarely: 'Rarely snacks between meals',
    sometimes: '1-2 snacks on most days',
    frequent: 'Multiple snacks throughout the day',
    constant: 'Constantly snacking',
  };
  return snacks[snack] || snack || 'Sometimes snacks';
}

function formatDrinks(drink: string): string {
  const drinks: Record<string, string> = {
    water_mostly: 'Mostly water, tea, black coffee',
    some_calories: 'Some caloric drinks like coffee with milk',
    sugary_drinks: 'Regular sugary drinks (soda, energy drinks)',
    alcohol_regular: 'Regular alcohol consumption',
  };
  return drinks[drink] || drink || 'Mixed beverages';
}

function formatGoal(goalType: string, weeklyGoal: number): string {
  if (goalType === 'lose') return `Lose ${weeklyGoal} kg per week`;
  if (goalType === 'gain') return `Gain ${weeklyGoal} kg per week`;
  return 'Maintain current weight';
}
