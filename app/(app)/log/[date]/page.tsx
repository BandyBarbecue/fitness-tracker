export default async function LogDatePage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params
  return <div className="p-4 pt-8"><h1 className="text-xl font-bold">Log — {date}</h1></div>
}
