export function OperationalPageLoading({ label }: { label: string }) {
  return (
    <div className="space-y-4" role="status" aria-label={label}>
      <span className="sr-only">{label}</span>
      <div className="flex items-end justify-between gap-4" aria-hidden="true">
        <div className="space-y-2">
          <div className="h-3 w-28 animate-pulse bg-muted motion-reduce:animate-none" />
          <div className="h-8 w-52 animate-pulse bg-muted motion-reduce:animate-none" />
          <div className="h-4 w-80 max-w-[70vw] animate-pulse bg-muted motion-reduce:animate-none" />
        </div>
        <div className="h-9 w-36 animate-pulse bg-muted motion-reduce:animate-none" />
      </div>
      <div className="flex gap-2 border bg-card p-3" aria-hidden="true">
        <div className="h-9 flex-1 animate-pulse bg-muted motion-reduce:animate-none" />
        <div className="h-9 w-28 animate-pulse bg-muted motion-reduce:animate-none" />
      </div>
      <div className="overflow-hidden border bg-card" aria-hidden="true">
        <div className="flex items-center justify-between border-b p-3">
          <div className="h-8 w-32 animate-pulse bg-muted motion-reduce:animate-none" />
          <div className="h-8 w-24 animate-pulse bg-muted motion-reduce:animate-none" />
        </div>
        <div className="grid grid-cols-[7rem_8rem_minmax(12rem,1fr)_7rem_7rem] gap-3 border-b px-3 py-3">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="h-3 animate-pulse bg-muted motion-reduce:animate-none" />
          ))}
        </div>
        {Array.from({ length: 7 }, (_, row) => (
          <div
            key={row}
            className="grid grid-cols-[7rem_8rem_minmax(12rem,1fr)_7rem_7rem] gap-3 border-b px-3 py-4 last:border-b-0"
          >
            {Array.from({ length: 5 }, (_, column) => (
              <div
                key={column}
                className="h-4 animate-pulse bg-muted motion-reduce:animate-none"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
