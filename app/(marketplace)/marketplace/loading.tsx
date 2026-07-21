export default function MarketplaceLoading() {
  return (
    <div className="min-h-screen bg-surface">
      <div className="h-28 bg-primary" />
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl overflow-hidden border border-border animate-pulse">
              <div className="aspect-square bg-surface" />
              <div className="p-3 space-y-2">
                <div className="h-3 bg-surface rounded w-1/2" />
                <div className="h-4 bg-surface rounded w-full" />
                <div className="h-4 bg-surface rounded w-2/3" />
                <div className="h-5 bg-surface rounded w-1/3 mt-2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
