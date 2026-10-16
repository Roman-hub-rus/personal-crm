export default function ContactsLoading() {
  return (
    <main className="mx-auto w-full max-w-3xl animate-pulse px-5 pt-4 lg:pt-6" aria-busy="true">
      <div className="h-3 w-28 rounded bg-muted" />
      <div className="mt-2 h-8 w-44 rounded bg-muted lg:h-10" />
      <div className="mt-5 h-12 rounded-full bg-muted" />
      <div className="mt-6 flex flex-col gap-3">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="flex items-center gap-3 px-3">
            <div className="size-10 rounded-full bg-muted" />
            <div className="flex flex-col gap-1.5">
              <div className="h-4 w-48 rounded bg-muted" />
              <div className="h-3 w-32 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
