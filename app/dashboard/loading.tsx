export default function Loading() {
  return <div className="space-y-4 p-6" aria-busy="true" aria-label="Loading dashboard"><div className="h-8 w-64 animate-pulse rounded bg-slate-200 dark:bg-slate-800"/><div className="grid gap-4 md:grid-cols-3">{Array.from({length:6}).map((_,i)=><div key={i} className="h-32 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800"/>)}</div></div>;
}
