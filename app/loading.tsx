import { BriefingSkeleton, CardSkeleton } from './loading-skeleton';

export default function Loading(): React.ReactElement {
  return (
    <main className="flex-1 w-full mx-auto px-6 py-5 2xl:px-10">
      <div className="mb-4 pb-4 border-b border-br space-y-2">
        <div className="h-7 w-40 rounded bg-[var(--c3)] animate-pulse" />
        <div className="h-3 w-72 max-w-full rounded bg-[var(--c2)] animate-pulse" />
      </div>
      <BriefingSkeleton />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {Array.from({ length: 6 }, (_, index) => (
          <CardSkeleton key={index} />
        ))}
      </div>
    </main>
  );
}
