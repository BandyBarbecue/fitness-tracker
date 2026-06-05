import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { EXTRACTION_PROMPT, parseExtractionResponse } from '@/lib/anthropic/extract-macros'
import type { Json } from '@/types/database'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { imagePath, screenshotId } = await request.json() as { imagePath: string; screenshotId: string }

  // Generate a short-lived signed URL to fetch the image server-side
  const { data: signedData, error: signedError } = await supabase.storage
    .from('screenshots')
    .createSignedUrl(imagePath, 60)

  if (signedError || !signedData) {
    return NextResponse.json({ error: 'Could not access image' }, { status: 500 })
  }

  // Fetch image and convert to base64
  const imageResponse = await fetch(signedData.signedUrl)
  const imageBuffer = await imageResponse.arrayBuffer()
  const base64 = Buffer.from(imageBuffer).toString('base64')
  const mediaType = (imageResponse.headers.get('content-type') ?? 'image/jpeg') as
    'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 256,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
        { type: 'text', text: EXTRACTION_PROMPT },
      ],
    }],
  })

  const text = (response.content[0] as { type: string; text?: string }).text ?? ''

  try {
    const extracted = parseExtractionResponse(text)

    // Save extracted data back to food_screenshots row
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('food_screenshots') as any).update({ extracted_json: extracted }).eq('id', screenshotId)

    return NextResponse.json(extracted)
  } catch {
    return NextResponse.json(
      { error: 'Could not parse nutrition from this image. Try manual entry.' },
      { status: 422 }
    )
  }
}
