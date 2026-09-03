import { redirect } from 'next/navigation'

/**
 * Legacy plural route. The canonical product surface is /product/[id], so this
 * forwards rather than maintaining a second, divergent reviews screen.
 */
export default async function ProductReviewsRedirectPage({
  params,
}: {
  params: Promise<{ productId: string }>
}) {
  const { productId } = await params
  redirect(`/product/${productId}/reviews`)
}
