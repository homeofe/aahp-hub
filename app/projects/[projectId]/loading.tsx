export default function LoadingProject(): React.ReactElement {
  return (
    <main className="mx-auto w-full max-w-[1500px] flex-1 animate-pulse px-5 py-5 2xl:px-9">
      <div className="h-4 w-48 rounded bg-[var(--c2)]" />
      <div className="mt-5 h-52 rounded-[var(--r-lg)] border border-br bg-[var(--c1)]" />
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => <div key={index} className="h-24 rounded-[var(--r)] border border-br bg-[var(--c1)]" />)}
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(310px,0.8fr)]">
        <div className="h-96 rounded-[var(--r-lg)] border border-br bg-[var(--c1)]" />
        <div className="h-80 rounded-[var(--r-lg)] border border-br bg-[var(--c1)]" />
      </div>
    </main>
  );
}