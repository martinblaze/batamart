export default function MostBoughtLoading() {
  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 sm:py-7">
        <div className="bg-card rounded-xl border border-border p-4 sm:p-5 mb-4 animate-pulse">
          <div className="h-7 bg-surface rounded w-56 mb-2" />
          <div className="h-4 bg-surface rounded w-72" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="bg-card rounded-xl border border-border overflow-hidden animate-pulse">
              <div className="aspect-square bg-surface" />
              <div className="p-3 space-y-2">
                <div className="h-3 bg-surface rounded" />
                <div className="h-3 bg-surface rounded w-2/3" />
                <div className="h-4 bg-surface rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
