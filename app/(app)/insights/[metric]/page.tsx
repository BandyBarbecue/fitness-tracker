import { redirect } from 'next/navigation'
import { MetricDetailClient } from '@/components/analytics/metric-detail-client'
import { VALID_SLUGS, type MetricSlug } from '@/components/analytics/metric-config'

export default async function MetricDetailPage({
  params,
}: {
  params: Promise<{ metric: string }>
}) {
  const { metric } = await params
  if (!(VALID_SLUGS as readonly string[]).includes(metric)) {
    redirect('/insights')
  }
  return <MetricDetailClient slug={metric as MetricSlug} />
}
