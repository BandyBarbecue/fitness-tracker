import { redirect } from 'next/navigation'
import { format } from 'date-fns'
import { LogForm } from '@/components/log/log-form'
import { isValidLogDate, isFutureLogDate } from '@/lib/utils/log-date'

export default async function LogDatePage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params
  const today = format(new Date(), 'yyyy-MM-dd')

  if (!isValidLogDate(date) || isFutureLogDate(date, today)) {
    redirect('/log')
  }

  return <LogForm date={date} />
}
