export default function ContactLoading() {
  return (
    <main className="mx-auto w-full max-w-3xl animate-pulse px-4 pt-6" aria-busy="true">
      <div className="h-4 w-28 rounded bg-muted" />
      <div className="mt-4 mb-6 flex items-center gap-4">
        <div className="size-14 rounded-full bg-muted" />
        <div className="flex flex-col gap-2">
          <div className="h-6 w-56 rounded bg-muted" />
          <div className="h-4 w-40 rounded bg-muted" />
        </div>
      </div>
      <div className="h-72 rounded-xl bg-muted" />
      <div className="mt-4 h-64 rounded-xl bg-muted" />
    </main>
  );
}
