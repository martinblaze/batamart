import { redirect } from 'next/navigation'

export default async function SellersProfileRedirectPage({
  params,
}: {
  params: Promise<{ sellerId: string }>
}) {
  const { sellerId } = await params
  redirect(`/seller/${sellerId}`)
}
