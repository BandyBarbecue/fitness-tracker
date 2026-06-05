import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { buildCheckinPrompt } from '@/lib/anthropic/weekly-checkin'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { periodStart, periodEnd } = await request.json() as { periodStart: string; periodEnd: string }

  const [{ data: logs }, { data: targets }] = await Promise.all([
    supabase.from('daily_logs').select('*')
      .eq('user_id', user.id)
      .gte('date', periodStart).lte('date', periodEnd)
      .order('date', { ascending: false }),
    supabase.from('targets').select('*').eq('user_id', user.id).maybeSingle(),
  ])

  if (!targets) return new Response('No targets configured — set up your targets in Settings first', { status: 422 })

  const prompt = buildCheckinPrompt(targets, logs ?? [])

  const encoder = new TextEncoder()
  let fullText = ''

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const anthropicStream = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          stream: true,
          messages: [{ role: 'user', content: prompt }],
        })

        for await (const event of anthropicStream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            fullText += event.delta.text
            controller.enqueue(encoder.encode(event.delta.text))
          }
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: insertError } = await (supabase.from('ai_checkins') as any).insert({
          user_id: user.id,
          period_start: periodStart,
          period_end: periodEnd,
          summary_text: fullText,
        })
        if (insertError) console.error('[weekly-checkin] DB insert failed:', insertError)

        controller.close()
      } catch (err) {
        controller.error(err)
      }
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Transfer-Encoding': 'chunked' },
  })
}
