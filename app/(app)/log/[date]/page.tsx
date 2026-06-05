import { LogForm } from '@/components/log/log-form'

export default async function LogDatePage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params
  return <LogForm date={date} />
}
