'use client'
import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { v4 as uuid } from 'uuid'

interface UploadResult {
  screenshotId: string
  imagePath: string
}

interface Props {
  dailyLogId: string | null
  date: string
  onUploaded: (result: UploadResult) => void
}

export function ScreenshotUploader({ dailyLogId, date, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File) {
    setUploading(true)
    setError(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setUploading(false); return }

    const ext = file.name.split('.').pop() ?? 'jpg'
    const imagePath = `${user.id}/${uuid()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('screenshots')
      .upload(imagePath, file, { upsert: false })

    if (uploadError) {
      setError('Upload failed — check your connection')
      setUploading(false)
      return
    }

    // Ensure a daily_logs row exists before inserting the screenshot FK
    let logId = dailyLogId
    if (!logId) {
      const { data: log, error: logError } = await supabase
        .from('daily_logs')
        .upsert({ user_id: user.id, date } as any, { onConflict: 'user_id,date' })
        .select('id')
        .single() as any
      if (logError || !log) {
        setError('Could not create log entry')
        setUploading(false)
        return
      }
      logId = (log as { id: string }).id
    }

    const { data: screenshot, error: screenshotError } = await supabase
      .from('food_screenshots')
      .insert({ user_id: user.id, daily_log_id: logId, image_path: imagePath, confirmed: false } as any)
      .select('id')
      .single() as any

    if (screenshotError || !screenshot) {
      setError('Screenshot record failed')
      setUploading(false)
      return
    }

    setUploading(false)
    onUploaded({ screenshotId: (screenshot as { id: string }).id, imagePath })
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-opacity disabled:opacity-50"
        style={{ background: '#0f1f17', border: '1px dashed #34d39960' }}
      >
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#34d39920' }}>
          <Upload size={15} color="#34d399" />
        </div>
        <div className="text-left">
          <div className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>
            {uploading ? 'Uploading…' : 'Extract from screenshot'}
          </div>
          <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Tap to upload · AI fills macros</div>
        </div>
      </button>
      {error && <p className="text-xs mt-1.5" style={{ color: 'var(--red)' }}>{error}</p>}
    </div>
  )
}
