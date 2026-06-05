export const EXTRACTION_PROMPT = `You are extracting nutrition summary data from a screenshot of a food tracking app (e.g. MyFitnessPal, Cronometer, Nutracheck).

Extract the TOTAL daily summary values — not individual food items.

Return ONLY valid JSON in this exact format, with no other text:
{
  "calories": number | null,
  "protein_g": number | null,
  "fat_g": number | null,
  "carbs_g": number | null,
  "confidence": "high" | "medium" | "low"
}

Rules:
- Set a field to null if you cannot read it with confidence
- calories should be the total calories for the day, not a single food
- protein_g, fat_g, carbs_g are in grams
- confidence = "high" if you can clearly read all 4 values, "medium" if 2-3, "low" if 0-1`

export interface ExtractedMacros {
  calories: number | null
  protein_g: number | null
  fat_g: number | null
  carbs_g: number | null
  confidence: 'high' | 'medium' | 'low'
}

export function parseExtractionResponse(text: string): ExtractedMacros {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('No JSON found in response')
  const parsed = JSON.parse(match[0])
  return {
    calories: parsed.calories ?? null,
    protein_g: parsed.protein_g ?? null,
    fat_g: parsed.fat_g ?? null,
    carbs_g: parsed.carbs_g ?? null,
    confidence: parsed.confidence ?? 'low',
  }
}
