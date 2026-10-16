export default function ContactLoading() {
  return (
    <main className="mx-auto w-full max-w-3xl animate-pulse px-5 pt-4 lg:pt-6" aria-busy="true">
      <div className="h-4 w-28 rounded bg-muted" />
      <div className="mt-5 mb-7 flex items-center gap-4 sm:gap-5">
        <div className="size-16 rounded-full bg-muted" />
        <div className="flex flex-col gap-2">
          <div className="h-3 w-40 rounded bg-muted" />
          <div className="h-8 w-56 rounded bg-muted lg:h-10" />
        </div>
      </div>
      <div className="h-72 rounded-2xl bg-muted" />
      <div className="mt-4 h-64 rounded-2xl bg-muted" />
    </main>
  );
}
